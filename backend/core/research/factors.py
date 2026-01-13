# core/research/factors.py
import numpy as np
import pandas as pd
from typing import Dict, List, Any

# ---------------------------
# Small utilities
# ---------------------------
def _pct_change(s, n=1):
    return s.pct_change(n)

def _zscore(s, win: int):
    return (s - s.rolling(win).mean()) / (s.rolling(win).std(ddof=0) + 1e-12)

def _rolling_corr(a: pd.Series, b: pd.Series, win: int):
    return a.rolling(win).corr(b)

# --- replace helpers at the top ---
def _norm(s: str) -> str:
    # normalize for matching: lowercase, underscores for spaces
    return s.lower().replace(" ", "_")

def _find_like(df: pd.DataFrame, must_have: list[str], nice_to_have: list[str] = None) -> str | None:
    """
    Fuzzy column finder:
      - must_have: substrings that MUST appear in normalized column name
      - nice_to_have: optional substrings to prefer if multiple matches
    """
    if df is None or df.empty:
        return None

    cols = list(df.columns)
    norms = {_norm(c): c for c in cols}

    # First pass: all must-have present
    matches = []
    for n, orig in norms.items():
        if all(k in n for k in must_have):
            matches.append((n, orig))

    if not matches:
        return None

    # If we have a preference, try to pick one that includes all nice_to_have
    if nice_to_have:
        preferred = [orig for n, orig in matches if all(k in n for k in nice_to_have)]
        if preferred:
            return preferred[0]

    # Fallback: first match (stable)
    return matches[0][1]

def _price_col(df: pd.DataFrame) -> str:
    # Prefer adjusted close if available by fuzzy match, then close.
    col = _find_like(df, must_have=["adj", "close"]) \
        or _find_like(df, must_have=["adjusted", "close"]) \
        or _find_like(df, must_have=["adjclose"]) \
        or _find_like(df, must_have=["close"])
    if col is None:
        raise KeyError("No Close/Adj Close column in price DataFrame.")
    return col

def _high_col(df: pd.DataFrame) -> str | None:
    return _find_like(df, must_have=["high"])

def _low_col(df: pd.DataFrame) -> str | None:
    return _find_like(df, must_have=["low"])

def _volume_col(df: pd.DataFrame) -> str | None:
    # yfinance sometimes uses 'Volume', others 'vol'
    return _find_like(df, must_have=["volume"]) or _find_like(df, must_have=["vol"])

# --- replace compute_base_cols ---
def compute_base_cols(df: pd.DataFrame) -> pd.DataFrame:
    """
    Returns a tidy frame with canonical lowercase columns:
      close (required), high/low/volume (if present),
      ret_1d, ret_5d, ret_20d, log_ret_1d, rng, vwap_proxy
    Works with columns like:
      'Close', 'Adj Close', 'aapl_close', 'close_aapl', 'AAPL Adj Close', etc.
    """
    if df is None or df.empty:
        return pd.DataFrame(index=pd.Index([], dtype="datetime64[ns]"))

    df = df.sort_index().copy()

    pcol = _price_col(df)
    hcol = _high_col(df)
    lcol = _low_col(df)
    vcol = _volume_col(df)

    # Canonicalize names we will use downstream
    rename_map = {pcol: "close"}
    if hcol: rename_map[hcol] = "high"
    if lcol: rename_map[lcol] = "low"
    if vcol: rename_map[vcol] = "volume"
    df = df.rename(columns=rename_map)

    # Ensure numeric types
    for c in ["close", "high", "low", "volume"]:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")

    df["ret_1d"]     = df["close"].pct_change(1)
    df["ret_5d"]     = df["close"].pct_change(5)
    df["ret_20d"]    = df["close"].pct_change(20)
    df["log_ret_1d"] = np.log(df["close"]).diff(1)

    if "high" in df.columns and "low" in df.columns:
        df["rng"] = (df["high"] - df["low"]) / (df["close"].shift(1) + 1e-12)
        df["vwap_proxy"] = (df.get("high", df["close"]) +
                            df.get("low", df["close"]) +
                            df["close"]) / 3.0
    else:
        df["rng"] = np.nan
        df["vwap_proxy"] = df["close"]

    return df

# ---------------------------
# Alpha factors
# ---------------------------
def compute_alpha_factors(
    px: pd.DataFrame,
    spy: pd.Series | None = None,
    vix: pd.Series | None = None,
    sector: pd.Series | None = None
) -> pd.DataFrame:
    """
    Returns a DataFrame with engineered factors + forward targets.
    Adds:
      - Momentum: mom_3, mom_5, mom_10, mom_20, mom_60, mom_63
      - Volatility: vol_5, vol_10, vol_20, vol_60, rng_5, parkinson_20
      - Mean-reversion: mr_z_{5,10,20,50,60}, px_ma_{w}_dev
      - Volume: vol_chg_1d, vol_z_20, vol_spike_20, abn_vol_60
      - Cross-asset: corr_spy_20/60, corr_vix_20/60, corr_sector_20/60, beta_spy_60
      - Higher moments: ret_skew_20, ret_kurt_20
      - Targets: target_ret_{1,3,5,10,20}d + y_up_{1,5,20}
    """
    df = compute_base_cols(px)

    # Price column is now canonical "close"
    pcol = "close"

    # ---------------- Momentum ----------------
    df["mom_3"]   = (df[pcol] / df[pcol].shift(3)) - 1
    df["mom_5"]   = (df[pcol] / df[pcol].shift(5)) - 1
    df["mom_10"]  = (df[pcol] / df[pcol].shift(10)) - 1
    df["mom_20"]  = (df[pcol] / df[pcol].shift(20)) - 1
    df["mom_60"]  = (df[pcol] / df[pcol].shift(60)) - 1
    df["mom_63"]  = (df[pcol] / df[pcol].shift(63)) - 1

    # ------------- Mean reversion -------------
    for w in (5, 10, 20, 50, 60):
        ma = df[pcol].rolling(w).mean()
        df[f"mr_z_{w}"] = _zscore(df[pcol], w)
        df[f"px_ma_{w}_dev"] = (df[pcol] - ma) / (ma + 1e-12)

    # -------- Bollinger bandwidth (20) --------
    m = df[pcol].rolling(20).mean()
    s = df[pcol].rolling(20).std(ddof=0)
    df["boll_bw_20"] = ((m + 2*s) - (m - 2*s)) / (m + 1e-12)

    # --------------- Volatility ----------------
    df["vol_5"]   = df["log_ret_1d"].rolling(5).std(ddof=0)
    df["vol_10"]  = df["log_ret_1d"].rolling(10).std(ddof=0)
    df["vol_20"]  = df["log_ret_1d"].rolling(20).std(ddof=0)
    df["vol_60"]  = df["log_ret_1d"].rolling(60).std(ddof=0)
    df["rng_5"]   = df["rng"].rolling(5).mean()

    # Parkinson volatility (if high/low present)
    if "high" in df.columns and "low" in df.columns:
        hl = (np.log(df["high"]) - np.log(df["low"])) ** 2
        df["parkinson_20"] = np.sqrt((1.0 / (4 * np.log(2))) * hl.rolling(20).mean())
    else:
        df["parkinson_20"] = np.nan

    # ----------------- Volume ------------------
    if "volume" in df.columns:
        vol = pd.to_numeric(df["volume"], errors="coerce").reindex(df.index)
    else:
        vol = pd.Series(index=df.index, dtype="float")

    df["vol_chg_1d"] = _pct_change(vol.astype("float"), 1)
    df["vol_z_20"]   = _zscore(vol.astype("float"), 20)

    vol_mean_20 = vol.rolling(20).mean()
    df["vol_spike_20"] = (vol / (vol_mean_20 + 1e-12)) - 1

    vol_mean_60 = vol.rolling(60).mean()
    df["abn_vol_60"] = (vol / (vol_mean_60 + 1e-12)) - 1

    # ------------- Cross-asset corr ------------
    if spy is not None:
        spy = spy.reindex(df.index).ffill()
        spy_lr = np.log(spy).diff()
        df["corr_spy_20"] = _rolling_corr(df["log_ret_1d"], spy_lr, 20)
        df["corr_spy_60"] = _rolling_corr(df["log_ret_1d"], spy_lr, 60)
        df["beta_spy_60"] = (
            df["log_ret_1d"].rolling(60).cov(spy_lr) /
            (spy_lr.rolling(60).var(ddof=0) + 1e-12)
        )

    if vix is not None:
        vix = vix.reindex(df.index).ffill()
        vix_lr = np.log(vix).diff()
        df["corr_vix_20"] = _rolling_corr(df["log_ret_1d"], vix_lr, 20)
        df["corr_vix_60"] = _rolling_corr(df["log_ret_1d"], vix_lr, 60)

    if sector is not None:
        sector = sector.reindex(df.index).ffill()
        sector_lr = np.log(sector).diff()
        df["corr_sector_20"] = _rolling_corr(df["log_ret_1d"], sector_lr, 20)
        df["corr_sector_60"] = _rolling_corr(df["log_ret_1d"], sector_lr, 60)

    # -------- Higher-moment risk (20) ---------
    df["ret_skew_20"] = df["log_ret_1d"].rolling(20).skew()
    df["ret_kurt_20"] = df["log_ret_1d"].rolling(20).kurt()

    # --------- Forward-looking targets --------
    df["target_ret_1d"]   = np.log(df[pcol].shift(-1)   / df[pcol])
    df["target_ret_3d"]   = np.log(df[pcol].shift(-3)   / df[pcol])
    df["target_ret_5d"]   = np.log(df[pcol].shift(-5)   / df[pcol])
    df["target_ret_10d"]  = np.log(df[pcol].shift(-10)  / df[pcol])
    df["target_ret_20d"]  = np.log(df[pcol].shift(-20)  / df[pcol])

    df["y_up_1d"]  = (df["target_ret_1d"]  > 0).astype(int)
    df["y_up_5d"]  = (df["target_ret_5d"]  > 0).astype(int)
    df["y_up_20d"] = (df["target_ret_20d"] > 0).astype(int)
    return df

# ---------------------------
# PCA diagnostics (JSON-friendly)
# ---------------------------
def compute_pca_diagnostics(
    df: pd.DataFrame,
    feature_cols: List[str],
    n_components: int = 8,
    topk_loadings: int = 8
) -> Dict[str, Any]:
    """
    Standardizes features, runs PCA, and returns:
      - explained_variance_ratio
      - per-component top loadings (feature, signed loading, abs loading for rank)
    Skips rows with NaNs across selected features.
    """
    from sklearn.preprocessing import StandardScaler
    from sklearn.decomposition import PCA

    if not feature_cols:
        return {"error": "No features provided for PCA."}

    X = df[feature_cols].copy()
    X = X.dropna(how="any")
    if X.empty:
        return {"error": "No rows available for PCA after dropping NaNs."}

    scaler = StandardScaler(with_mean=True, with_std=True)
    Xs = scaler.fit_transform(X.values)

    k = min(n_components, Xs.shape[1])
    pca = PCA(n_components=k, svd_solver="auto", random_state=42)
    pca.fit(Xs)

    explained = [float(v) for v in pca.explained_variance_ratio_.tolist()]
    comps = []
    loadings = pca.components_  # shape: (k, n_features)

    for i in range(k):
        row = loadings[i]
        idx = np.argsort(np.abs(row))[::-1][:topk_loadings]
        top = []
        for j in idx:
            top.append({
                "feature": feature_cols[j],
                "loading": float(row[j]),
                "abs_loading": float(abs(row[j])),
            })
        comps.append({"component": i + 1, "top_loadings": top})

    return {
        "n_samples": int(Xs.shape[0]),
        "n_features": int(Xs.shape[1]),
        "explained_variance_ratio": explained,
        "components": comps,
        "features_used": feature_cols,
    }
