# core/research/ff.py
import numpy as np
import pandas as pd
from typing import Dict, Literal
from pandas_datareader import data as pdr
import statsmodels.api as sm

FFSet = Literal["ff3", "ff5"]


def _robust_to_datetime(idx_like) -> pd.DatetimeIndex:
    """
    Normalize a variety of FF index formats into a tz-naive DatetimeIndex:
      - int yyyymmdd
      - str "yyyymmdd"
      - str "yyyy-mm-dd"
      - already DatetimeIndex
    """
    if isinstance(idx_like, pd.DatetimeIndex):
        return idx_like.tz_localize(None)

    # First: exact yyyymmdd (classic FF)
    try:
        return pd.to_datetime(idx_like, format="%Y%m%d").tz_localize(None)
    except Exception:
        pass

    # Second: general parser (handles "yyyy-mm-dd")
    dt = pd.to_datetime(idx_like, errors="coerce", utc=False)
    if isinstance(dt, pd.DatetimeIndex) and dt.notna().any():
        return dt.tz_localize(None)

    # Last: strip dashes then parse yyyymmdd
    try:
        as_str = pd.Index(str(x).replace("-", "") for x in idx_like)
        return pd.to_datetime(as_str, format="%Y%m%d").tz_localize(None)
    except Exception:
        dt = pd.to_datetime(idx_like, errors="coerce", utc=False)
        return dt.tz_localize(None)


def get_ff_factors_daily(which: FFSet = "ff5") -> pd.DataFrame:
    """
    Download daily Fama-French factors as DECIMAL returns (not %) with a clean DatetimeIndex.
    ff5 columns: ['Mkt-RF','SMB','HML','RMW','CMA','RF']
    ff3 columns: ['Mkt-RF','SMB','HML','RF']
    """
    try:
        if which == "ff5":
            ds = pdr.DataReader("F-F_Research_Data_5_Factors_2x3_Daily", "famafrench")[0]
        else:
            ds = pdr.DataReader("F-F_Research_Data_Factors_Daily", "famafrench")[0]

        df = ds.copy()
        df.index = _robust_to_datetime(df.index)
        df = df.astype(float) / 100.0  # percent -> decimal
        return df
    except Exception as e:
        print(f"[FF] Error downloading Fama-French factors: {e}")
        return pd.DataFrame()


def fama_french_exposure(strategy_ret: pd.Series, bench_ret: pd.Series | None = None):
    """
    Minimal alpha/beta regression: strategy ~ const + benchmark
    Returns JSON-ready dict: {"betas": {"alpha": ..., "beta": ...}, "tstats": {...}}
    """
    if bench_ret is None or bench_ret.empty:
        return {"betas": {}, "tstats": {}}

    df = pd.DataFrame({"strategy": strategy_ret, "bench": bench_ret}).dropna()
    if df.empty or len(df) < 2:
        return {"betas": {}, "tstats": {}}

    try:
        X = sm.add_constant(df["bench"])
        model = sm.OLS(df["strategy"].astype(float), X.astype(float)).fit()

        return {
            "betas": {
                "alpha": float(model.params.get("const", float("nan"))),
                "beta": float(model.params.get("bench", float("nan"))),
            },
            "tstats": {
                "alpha": float(model.tvalues.get("const", float("nan"))),
                "beta": float(model.tvalues.get("bench", float("nan"))),
            }
        }
    except Exception as e:
        print(f"[FF] Error in regression: {e}")
        return {"betas": {}, "tstats": {}}