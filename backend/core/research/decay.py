# core/research/decay.py
import numpy as np
import pandas as pd
from typing import Sequence, Dict, Any

def _safe_corr(x: pd.Series, y: pd.Series, method: str) -> float | None:
    x, y = x.align(y, join="inner")
    x, y = x.dropna(), y.dropna()
    x, y = x.align(y, join="inner")
    if len(x) < 5:
        return None
    return float(pd.Series(x).corr(pd.Series(y), method=method))

def compute_signal_decay(
    df: pd.DataFrame,
    signal_col: str,
    horizons: Sequence[int] = (1, 3, 5, 10, 20)
) -> Dict[str, Any]:
    """
    Expects df to contain forward-return columns: target_ret_{h}d for h in horizons.
    Returns Pearson & Spearman IC per horizon and simple top/bottom bucket means
    using rolling percentiles on the signal (single-ticker).
    """
    sig = pd.to_numeric(df.get(signal_col), errors="coerce")
    if sig is None or sig.dropna().empty:
        return {"error": f"Signal column '{signal_col}' not found or empty."}

    out_ic_p, out_ic_s = {}, {}
    top_avg, bot_avg = {}, {}

    for h in horizons:
        ret_col = f"target_ret_{h}d"
        if ret_col not in df.columns:
            continue
        ret = pd.to_numeric(df[ret_col], errors="coerce")
        out_ic_p[str(h)] = _safe_corr(sig, ret, "pearson")
        out_ic_s[str(h)] = _safe_corr(sig, ret, "spearman")

        # time-bucket thresholds
        roll = 252
        q_top = sig.rolling(roll, min_periods=60).quantile(0.8)
        q_bot = sig.rolling(roll, min_periods=60).quantile(0.2)
        m_top = (ret[sig >= q_top]).mean()
        m_bot = (ret[sig <= q_bot]).mean()
        top_avg[str(h)] = None if pd.isna(m_top) else float(m_top)
        bot_avg[str(h)] = None if pd.isna(m_bot) else float(m_bot)

    return {
        "signal": signal_col,
        "horizons": list(horizons),
        "ic_pearson": out_ic_p,
        "ic_spearman": out_ic_s,
        "avg_forward_return": {
            "top_bucket": top_avg,
            "bottom_bucket": bot_avg
        }
    }

def quantile_time_buckets(
    df: pd.DataFrame,
    signal_col: str,
    ret_col: str = "target_ret_1d",
    n_quantiles: int = 5,
    roll: int = 252
) -> Dict[str, Any]:
    """
    Single-ticker time-bucket quantiles:
      - Rolling thresholds on the signal
      - Assign each day to Q1..Qn
      - Report mean forward return per quantile
      - Generate a simple long-short (Qn - Q1) equity curve
    """
    sig = pd.to_numeric(df.get(signal_col), errors="coerce")
    ret = pd.to_numeric(df.get(ret_col), errors="coerce")
    if sig is None or ret is None or sig.dropna().empty or ret.dropna().empty:
        return {"error": "Signal or return column missing/empty."}

    # build rolling quantile thresholds q_1 .. q_{n-1} and NAME them
    qs = np.linspace(0, 1, n_quantiles + 1)[1:-1]
    thresh = {
        f"q_{i+1}": sig.rolling(roll, min_periods=60).quantile(q).rename(f"q_{i+1}")
        for i, q in enumerate(qs)
    }

    # concat with explicit names so row[...] is unambiguous
    cols = [sig.rename(signal_col), ret.rename(ret_col)] + [v for v in thresh.values()]
    tmp = pd.concat(cols, axis=1)

    # defensive scalar extraction (avoid "truth value of a Series is ambiguous")
    def _assign(row: pd.Series) -> float:
        val = row.get(signal_col)
        if isinstance(val, (pd.Series, np.ndarray, list)):
            if len(val) == 0:
                return np.nan
            x = val[0]
        else:
            x = val
        if pd.isna(x):
            return np.nan

        cnt = 1
        for i in range(1, n_quantiles):
            qv = row.get(f"q_{i}", np.nan)
            if pd.isna(qv):
                return np.nan
            if x > qv:
                cnt += 1
        return float(cnt)

    tmp["q"] = tmp.apply(_assign, axis=1)

    # mean forward return per quantile
    q_means = tmp.groupby("q", dropna=True)[ret_col].mean()
    q_table = {
        str(int(k)) if not pd.isna(k) else "nan": (None if pd.isna(v) else float(v))
        for k, v in q_means.items()
    }

    # Long-short series: Qn - Q1 (aligned to calendar)
    q1 = tmp.loc[tmp["q"] == 1.0, ret_col]
    qn = tmp.loc[tmp["q"] == float(n_quantiles), ret_col]
    ls = (qn.reindex(tmp.index).fillna(0) - q1.reindex(tmp.index).fillna(0)).fillna(0)
    ls_curve = (1.0 + ls).cumprod()
    ls_out = {idx.strftime("%Y-%m-%d"): float(v) for idx, v in ls_curve.dropna().tail(2000).items()}

    return {
        "signal": signal_col,
        "ret_col": ret_col,
        "n_quantiles": int(n_quantiles),
        "roll": int(roll),
        "mean_forward_return_by_quantile": q_table,
        "long_short_equity_curve": ls_out
    }
