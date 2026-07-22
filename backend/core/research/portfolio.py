# core/research/portfolio.py
import numpy as np
import pandas as pd
import yfinance as yf
from typing import List, Dict, Optional, Literal

from .factors import compute_alpha_factors
from .experiment import run_walkforward_xgb

Rebalance = Literal["daily", "weekly", "monthly"]

# ---- local helpers (duplicated on purpose to avoid circular imports) ----
def _flatten_ohlcv(df: pd.DataFrame, ticker: str) -> pd.DataFrame:
    if df is None or df.empty:
        return df
    out = df.copy()
    if isinstance(out.columns, pd.MultiIndex):
        extracted = None
        for lvl in range(out.columns.nlevels):
            vals = out.columns.get_level_values(lvl)
            if ticker in vals:
                try:
                    extracted = out.xs(ticker, axis=1, level=lvl, drop_level=True)
                    break
                except Exception:
                    pass
        out = extracted if extracted is not None else out
        if isinstance(out.columns, pd.MultiIndex):
            try:
                level0 = out.columns.get_level_values(0)
                if set(level0).intersection({"Open","High","Low","Close","Adj Close","Volume"}):
                    out.columns = level0
                else:
                    out.columns = ["|".join(map(str, tpl)) for tpl in out.columns]
            except Exception:
                out.columns = ["|".join(map(str, tpl)) for tpl in out.columns]
    out = out.rename(columns=lambda c: str(c).strip().title())
    keep = [c for c in ["Open","High","Low","Close","Adj Close","Volume"] if c in out.columns]
    if keep:
        out = out[keep]
    out.index = pd.to_datetime(out.index).tz_localize(None)
    return out

def _get_close_series(ticker: str, start: str, end: str | None = None) -> pd.Series:
    df = yf.download(ticker, start=start, end=end, auto_adjust=True, progress=False)
    if df is None or df.empty:
        raise RuntimeError(f"No data for {ticker}")
    if isinstance(df.columns, pd.MultiIndex):
        try:
            s = df.xs("Close", axis=1, level=0, drop_level=False)
            if isinstance(s, pd.DataFrame):
                s = s.iloc[:, 0]
        except Exception:
            s = None
        if s is None:
            try:
                s = df.xs("Adj Close", axis=1, level=0, drop_level=False)
                if isinstance(s, pd.DataFrame):
                    s = s.iloc[:, 0]
            except Exception:
                flat = df.copy()
                flat.columns = ["|".join(map(str, c)) for c in flat.columns]
                candidates = [c for c in flat.columns if c.lower().startswith("close")]
                if not candidates:
                    candidates = [c for c in flat.columns if "adj close" in c.lower()]
                if not candidates:
                    raise KeyError("No Close/Adj Close column found (multiindex).")
                s = flat[candidates[0]]
    else:
        col = "Close" if "Close" in df.columns else ("Adj Close" if "Adj Close" in df.columns else None)
        if col is None:
            raise KeyError("No Close/Adj Close column found.")
        s = df[col]
    s = pd.to_numeric(s, errors="coerce").dropna()
    s.index = pd.to_datetime(s.index).tz_localize(None)
    s.name = ticker
    return s

def _price_col(df: pd.DataFrame) -> str:
    if "Adj Close" in df.columns:
        return "Adj Close"
    if "Close" in df.columns:
        return "Close"
    if "Adj close" in df.columns:
        return "Adj close"
    if "close" in df.columns:
        return "close"
    raise KeyError("No Close/Adj Close column in price DataFrame.")

# ------------------------------------------------------------------------

def _rebalance_dates(ix: pd.DatetimeIndex, rebalance: Rebalance) -> pd.DatetimeIndex:
    if rebalance == "daily":
        return ix
    if rebalance == "weekly":
        # last business day each week in the index
        return ix.to_series().resample("W-FRI").last().dropna().index.intersection(ix)
    if rebalance == "monthly":
        return ix.to_series().resample("M").last().dropna().index.intersection(ix)
    # fallback
    return ix

def _weights_equal(names: List[str]) -> pd.Series:
    if not names:
        return pd.Series(dtype="float")
    w = 1.0 / len(names)
    return pd.Series({n: w for n in names}, dtype="float")

def _weights_risk_parity(returns: pd.DataFrame, lookback: int = 63) -> pd.Series:
    # inverse volatility on last 'lookback' days, long-only, normalized
    if returns.empty:
        return _weights_equal(list(returns.columns))
    sub = returns.tail(lookback).dropna(how="all")
    if sub.empty:
        return _weights_equal(list(returns.columns))
    vol = sub.std(ddof=0).replace(0.0, np.nan)
    inv = 1.0 / vol
    inv = inv.replace([np.inf, -np.inf], np.nan).fillna(0.0)
    if inv.sum() <= 0:
        return _weights_equal(list(returns.columns))
    w = inv / inv.sum()
    return w

def _weights_mean_variance(returns: pd.DataFrame, lookback: int = 252, ridge: float = 1e-3) -> pd.Series:
    # unconstrained mean-variance with ridge, then clip to long-only and renormalize
    if returns.empty:
        return _weights_equal(list(returns.columns))
    sub = returns.tail(lookback).dropna(how="all")
    if sub.empty:
        return _weights_equal(list(returns.columns))
    mu = sub.mean().values  # daily mean
    cov = sub.cov().values
    n = cov.shape[0]
    cov_r = cov + ridge * np.eye(n)
    try:
        inv = np.linalg.inv(cov_r)
    except np.linalg.LinAlgError:
        inv = np.linalg.pinv(cov_r)
    raw = inv @ mu
    if not np.isfinite(raw).all() or raw.sum() == 0:
        return _weights_equal(list(sub.columns))
    w = raw / np.sum(np.abs(raw))  # scale
    w = np.clip(w, 0.0, None)
    if w.sum() == 0:
        return _weights_equal(list(sub.columns))
    w = w / w.sum()
    return pd.Series(w, index=sub.columns, dtype="float")

def _signal_series_for_ticker(
    ticker: str,
    start: str,
    signal_col: str,
    end: str | None = None,
) -> pd.DataFrame:
    """
    Returns a DataFrame with at least [signal_col, 'log_ret'] indexed by date.
    If signal_col starts with 'prob_up', we train walk-forward XGB to get predictions.
    Otherwise we compute alpha factors and pull the requested factor column.
    """
    # download OHLCV
    px_raw = yf.download(ticker, start=start, end=end, auto_adjust=True, progress=False)
    if px_raw is None or px_raw.empty:
        raise RuntimeError(f"No data for {ticker}")
    px = _flatten_ohlcv(px_raw, ticker)
    pcol = _price_col(px)

    if signal_col.startswith("prob_up"):
        # derive horizon from name, e.g., prob_up_1d / prob_up_5d ...
        horizon = signal_col.replace("prob_up_", "")
        # also get SPY/VIX for cross-asset factors used in model
        spy = _get_close_series("SPY", start, end)
        vix = _get_close_series("^VIX", start, end)
        res = run_walkforward_xgb(px, spy=spy, vix=vix, sector=None, horizon=horizon)
        sig = res.get("predictions", pd.DataFrame()).copy()
        if isinstance(sig, pd.DataFrame) and not sig.empty:
            sig = sig.rename(columns={sig.columns[0]: signal_col})
    else:
        df = compute_alpha_factors(px)
        if signal_col not in df.columns:
            raise KeyError(f"Signal '{signal_col}' not in factors for {ticker}.")
        sig = df[[signal_col]]

    # log returns
    log_ret = np.log(px[pcol]).diff().rename("log_ret")
    out = sig.join(log_ret, how="left")
    return out

def _weights_signal_weighted(sig: pd.Series) -> pd.Series:
    """Long-only weights ~ normalized positive signal; fall back to equal if all <=0."""
    s = sig.copy().astype(float).replace([np.inf, -np.inf], np.nan).fillna(0.0)
    s = s.clip(lower=0.0)
    if s.sum() <= 0:
        return _weights_equal(list(s.index))
    w = s / s.sum()
    return w

def _weights_quantile(sig: pd.Series, n_quantiles:int=5, long_q:int=5, short_q:int=1) -> pd.Series:
    """Cross-sectional long/short by quantiles, dollar neutral."""
    s = sig.copy().astype(float).replace([np.inf, -np.inf], np.nan).dropna()
    if s.empty:
        return pd.Series(0.0, index=sig.index)
    # rank into quantiles (1..n)
    q = pd.qcut(s.rank(method="first"), n_quantiles, labels=False) + 1
    q = pd.Series(q, index=s.index)
    longs  = q[q == long_q].index
    shorts = q[q == short_q].index
    w = pd.Series(0.0, index=sig.index, dtype=float)
    if len(longs):  w.loc[longs]  =  1.0 / len(longs)
    if len(shorts): w.loc[shorts] = -1.0 / len(shorts)
    if w.abs().sum() > 0:
        w /= w.abs().sum()
    return w

def backtest_portfolio(
    tickers: List[str],
    start: str,
    signal: str,
    end: str | None = None,
    allocator: Literal["equal_weight", "risk_parity", "mean_variance", "signal_weighted", "quantile"] = "equal_weight",
    rebalance: Rebalance = "weekly",
    cost_bps: float = 5.0,
    # extra knobs (harmless if not supplied)
    n_quantiles: int | None = None,
    long_q: int | None = None,
    short_q: int | None = None,
    benchmark: str = "SPY",
    **kwargs,  # swallow unknown keys from JSON payload without failing
) -> Dict[str, object]:
    """
    Cross-sectional backtest with configurable allocator.
    Returns keys consumed by /api/report: daily, equity_curve, bench_equity, weights, asset_returns, universe
    """
    if not tickers:
        raise ValueError("tickers must be a non-empty list.")

    # --- gather per-ticker signal + log_ret ---
    frames = {}
    for t in tickers:
        df = _signal_series_for_ticker(t, start=start, signal_col=signal, end=end)
        frames[t] = df

    # aligned panel
    all_ix = None
    for df in frames.values():
        all_ix = df.index if all_ix is None else all_ix.union(df.index)
    all_ix = pd.DatetimeIndex(sorted(all_ix))

    sig_mat = pd.DataFrame(index=all_ix, columns=tickers, dtype="float")
    ret_mat = pd.DataFrame(index=all_ix, columns=tickers, dtype="float")
    for t in tickers:
        s = frames[t].reindex(all_ix)
        sig_mat[t] = s[signal]
        ret_mat[t] = s["log_ret"]

    # ---------------- rebalance schedule ----------------
    rb_dates = _rebalance_dates(all_ix, rebalance)
    rb_set = set(rb_dates)

    weights = pd.DataFrame(0.0, index=all_ix, columns=tickers, dtype="float")
    current_weights = pd.Series(0.0, index=tickers, dtype="float")
    daily_pnl = pd.Series(index=all_ix, dtype="float")
    turnover_series = pd.Series(0.0, index=all_ix, dtype="float")
    transaction_costs = pd.Series(0.0, index=all_ix, dtype="float")

    # ----- for /api/report attribution -----
    asset_returns = ret_mat.copy()  # wide daily log returns by asset

    for dt in all_ix:
        # Weights selected using today's close can only earn returns after today.
        weights.loc[dt] = current_weights.values
        r = ret_mat.loc[dt]
        gross_return = float(np.nansum(current_weights.values * r.values))

        if dt in rb_set:
            srow = sig_mat.loc[dt]
            valid = srow.dropna()
            names = list(valid.index)

            if not names:
                next_weights = pd.Series(0.0, index=tickers, dtype="float")
            else:
                if allocator == "equal_weight":
                    w_base = _weights_equal(names)
                elif allocator == "risk_parity":
                    hist = ret_mat.loc[:dt].dropna(how="all")
                    w_base = _weights_risk_parity(hist[names])
                elif allocator == "mean_variance":
                    hist = ret_mat.loc[:dt].dropna(how="all")
                    w_base = _weights_mean_variance(hist[names])
                elif allocator == "signal_weighted":
                    w_base = _weights_signal_weighted(valid)
                else:  # "quantile"
                    w_base = _weights_quantile(valid,
                                               n_quantiles=n_quantiles or 5,
                                               long_q=long_q or (n_quantiles or 5),
                                               short_q=short_q or 1)

                next_weights = pd.Series(0.0, index=tickers, dtype="float")
                next_weights.loc[w_base.index] = w_base.values

            turnover = float(np.nansum(np.abs(next_weights.values - current_weights.values)))
            cost = (cost_bps / 1e4) * turnover
            turnover_series.loc[dt] = turnover
            transaction_costs.loc[dt] = cost
            current_weights = next_weights

        daily_pnl.loc[dt] = gross_return - transaction_costs.loc[dt]

    daily_pnl = daily_pnl.replace([np.inf, -np.inf], np.nan).fillna(0.0)
    equity = daily_pnl.cumsum().apply(np.exp)

    # ---- optional benchmark (for IR/beta cards in /api/report) ----
    try:
        benchmark_prices = _get_close_series(benchmark, start, end).reindex(all_ix).ffill()
        benchmark_returns = np.log(benchmark_prices / benchmark_prices.shift(1)).fillna(0.0)
        benchmark_equity = benchmark_returns.cumsum().apply(np.exp)
    except Exception:
        benchmark_returns = pd.Series(0.0, index=all_ix, dtype="float")
        benchmark_equity = pd.Series(1.0, index=all_ix, dtype="float")

    benchmark_returns = benchmark_returns.replace([np.inf, -np.inf], np.nan).fillna(0.0)
    benchmark_equity = benchmark_equity.replace([np.inf, -np.inf], np.nan).ffill().fillna(1.0)

    # /api/report expects "daily" as records with ret & bench_ret
    daily_df = pd.DataFrame({"ret": daily_pnl, "bench_ret": benchmark_returns}).fillna(0.0)

    daily_records = [
        {
            "date": d.strftime("%Y-%m-%d"),
            "ret": float(daily_df.at[d, "ret"]),
            "bench_ret": float(daily_df.at[d, "bench_ret"]),
        }
        for d in daily_df.index
    ]

    return {
        "daily": daily_records,
        "daily_returns": daily_pnl,
        "benchmark_returns": benchmark_returns,
        "equity_curve": equity,
        "bench_equity": benchmark_equity,
        "weights": weights,
        "turnover": turnover_series,
        "transaction_costs": transaction_costs,
        "turnover_annual": float(turnover_series.mean() * 252.0),
        "asset_returns": asset_returns,
        "universe": tickers,
    }