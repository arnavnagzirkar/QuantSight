# core/research/stats.py
import numpy as np
import pandas as pd
from typing import Dict

TRADING_DAYS = 252

def _to_series(x) -> pd.Series:
    if isinstance(x, pd.Series):
        return x
    if isinstance(x, pd.DataFrame):
        if x.shape[1] == 1:
            return x.iloc[:, 0]
        raise ValueError(f"Expected 1D data; got DataFrame with shape {x.shape}")
    arr = np.asarray(x)
    if arr.ndim == 2:
        # squeeze single-column / single-row cases
        if 1 in arr.shape:
            arr = arr.reshape(-1)
        else:
            raise ValueError(f"Expected 1D data; got ndarray with shape {arr.shape}")
    return pd.Series(arr)

def excess(returns: pd.Series, rf_daily: float = 0.0) -> pd.Series:
    r = _to_series(returns)
    return r - rf_daily

def sharpe_ratio(returns: pd.Series, rf_daily: float = 0.0) -> float:
    r = excess(returns, rf_daily)
    if r.std(ddof=0) == 0 or r.dropna().empty:
        return float("nan")
    return float(np.sqrt(TRADING_DAYS) * r.mean() / (r.std(ddof=0) + 1e-12))

def sortino_ratio(returns: pd.Series, rf_daily: float = 0.0) -> float:
    r = excess(returns, rf_daily)
    dn = r[r < 0]
    denom = dn.std(ddof=0)
    if denom == 0 or r.dropna().empty:
        return float("nan")
    return float(np.sqrt(TRADING_DAYS) * r.mean() / (denom + 1e-12))

def information_ratio(returns, benchmark) -> float:
    r = _to_series(returns).dropna()
    b = _to_series(benchmark).reindex_like(r).dropna()
    # align indexes after drops
    idx = r.index.intersection(b.index)
    if len(idx) == 0:
        return float("nan")
    r = r.loc[idx]
    b = b.loc[idx]
    diff = r - b
    denom = diff.std(ddof=0)
    if denom == 0 or np.isnan(denom):
        return float("nan")
    # daily IR (annualize elsewhere if you need)
    return float(diff.mean() / denom)

def alpha_beta(returns: pd.Series, benchmark: pd.Series) -> Dict[str, float]:
    """OLS on daily returns: r = a + b * m + e; annualize alpha."""
    r = _to_series(returns)
    m = _to_series(benchmark)
    df = pd.DataFrame({"r": r, "m": m}).dropna()
    if df.empty:
        return {"alpha": float("nan"), "beta": float("nan")}
    x = df["m"].values
    y = df["r"].values
    # add intercept
    X = np.column_stack([np.ones_like(x), x])
    coef = np.linalg.lstsq(X, y, rcond=None)[0]
    a_daily, b = float(coef[0]), float(coef[1])
    a_annual = (1 + a_daily) ** TRADING_DAYS - 1
    return {"alpha": a_annual, "beta": b}

def max_drawdown(equity_curve: pd.Series) -> float:
    eq = _to_series(equity_curve)
    if eq.empty:
        return float("nan")
    cummax = eq.cummax()
    dd = eq / (cummax + 1e-12) - 1.0
    return float(dd.min())

def cagr_from_equity(equity_curve: pd.Series) -> float:
    eq = _to_series(equity_curve)
    if eq.empty:
        return float("nan")
    start, end = eq.iloc[0], eq.iloc[-1]
    years = max(1e-9, len(eq) / TRADING_DAYS)
    return float((end / (start + 1e-12)) ** (1 / years) - 1)

def rolling_sharpe(returns: pd.Series, window: int = 63) -> pd.Series:
    r = _to_series(returns)
    # annualized Sharpe for each window
    rs = np.sqrt(TRADING_DAYS) * r.rolling(window).mean() / (r.rolling(window).std(ddof=0) + 1e-12)
    return rs

def rolling_vol(returns: pd.Series, window: int = 63) -> pd.Series:
    r = _to_series(returns)
    return np.sqrt(TRADING_DAYS) * r.rolling(window).std(ddof=0)
