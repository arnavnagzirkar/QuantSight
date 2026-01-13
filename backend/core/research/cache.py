# core/research/cache.py
from __future__ import annotations
import os
import pandas as pd
import yfinance as yf

CACHE_DIR = os.path.join("data", "cache")
os.makedirs(CACHE_DIR, exist_ok=True)

# Detect parquet availability once
try:
    import pyarrow  # noqa: F401
    _PARQUET_OK = True
except Exception:
    try:
        import fastparquet  # noqa: F401
        _PARQUET_OK = True
    except Exception:
        _PARQUET_OK = False

def _base_path(ticker: str) -> str:
    safe = "".join(ch for ch in ticker if ch.isalnum() or ch in ("-", "_")).strip()
    return os.path.join(CACHE_DIR, safe)

def _cache_path(ticker: str) -> str:
    base = _base_path(ticker)
    return base + (".parquet" if _PARQUET_OK else ".pkl")

def _save(df: pd.DataFrame, path: str) -> None:
    if _PARQUET_OK and path.endswith(".parquet"):
        df.to_parquet(path)
    else:
        df.to_pickle(path)

def _load(path: str) -> pd.DataFrame:
    if _PARQUET_OK and path.endswith(".parquet"):
        return pd.read_parquet(path)
    return pd.read_pickle(path)

def load_prices(ticker: str, start: str, auto_adjust: bool = True, force_refresh: bool = False) -> pd.DataFrame:
    """
    Cached daily OHLCV for a ticker; incremental updates if a cache exists.
    """
    path = _cache_path(ticker)
    df_cached = None

    if (not force_refresh) and os.path.exists(path):
        try:
            df_cached = _load(path)
        except Exception:
            df_cached = None

    if df_cached is None or df_cached.empty:
        df_dl = yf.download(ticker, start=start, auto_adjust=auto_adjust, progress=False)
        if df_dl is None or df_dl.empty:
            raise ValueError(f"No data for {ticker}")
        df_dl.index = pd.to_datetime(df_dl.index)
        _save(df_dl, path)
        return df_dl

    # Incremental update from last cached date + 1 day
    last_dt = pd.to_datetime(df_cached.index).max()
    fetch_start = (pd.Timestamp(last_dt) + pd.Timedelta(days=1)).strftime("%Y-%m-%d")
    df_new = yf.download(ticker, start=fetch_start, auto_adjust=auto_adjust, progress=False)

    if df_new is not None and not df_new.empty:
        df_new.index = pd.to_datetime(df_new.index)
        df_out = pd.concat([df_cached, df_new]).sort_index()
        # Drop exact duplicate index rows if any
        df_out = df_out[~df_out.index.duplicated(keep="last")]
    else:
        df_out = df_cached

    _save(df_out, path)
    return df_out

def clear_cache(ticker: str | None = None) -> int:
    """
    Remove cached file(s). Returns count removed.
    """
    if ticker:
        p = _cache_path(ticker)
        if os.path.exists(p):
            os.remove(p)
            return 1
        return 0
    cnt = 0
    for f in os.listdir(CACHE_DIR):
        if f.endswith(".parquet") or f.endswith(".pkl"):
            try:
                os.remove(os.path.join(CACHE_DIR, f)); cnt += 1
            except Exception:
                pass
    return cnt
