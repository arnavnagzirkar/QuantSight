from datetime import date, timedelta

import pandas as pd
import yfinance as yf


class MarketDataError(RuntimeError):
    pass


def normalize_ohlcv(frame: pd.DataFrame, ticker: str) -> pd.DataFrame:
    if frame is None or frame.empty:
        return pd.DataFrame()

    normalized = frame.copy()
    if isinstance(normalized.columns, pd.MultiIndex):
        extracted = None
        for level in range(normalized.columns.nlevels):
            if ticker in normalized.columns.get_level_values(level):
                extracted = normalized.xs(ticker, axis=1, level=level, drop_level=True)
                break
        if extracted is not None:
            normalized = extracted
        if isinstance(normalized.columns, pd.MultiIndex):
            first_level = normalized.columns.get_level_values(0)
            if set(first_level).intersection({"Open", "High", "Low", "Close", "Adj Close", "Volume"}):
                normalized.columns = first_level
            else:
                normalized.columns = ["|".join(map(str, column)) for column in normalized.columns]

    normalized = normalized.rename(columns=lambda column: str(column).strip().title())
    available = [
        column
        for column in ("Open", "High", "Low", "Close", "Adj Close", "Volume")
        if column in normalized.columns
    ]
    normalized = normalized[available]
    normalized.index = pd.to_datetime(normalized.index, errors="coerce", utc=True).tz_localize(None)
    normalized = normalized.loc[normalized.index.notna()].sort_index()
    return normalized[~normalized.index.duplicated(keep="last")]


def fetch_ohlcv(ticker: str, start_date: date, end_date: date | None = None) -> pd.DataFrame:
    inclusive_end = end_date + timedelta(days=1) if end_date is not None else None
    try:
        raw = yf.download(
            ticker,
            start=start_date.isoformat(),
            end=inclusive_end.isoformat() if inclusive_end is not None else None,
            auto_adjust=True,
            progress=False,
            threads=False,
        )
    except Exception as error:
        raise MarketDataError(f"Market data is unavailable for {ticker}") from error

    normalized = normalize_ohlcv(raw, ticker)
    if normalized.empty:
        raise MarketDataError(f"No market data found for {ticker}")
    if "Close" not in normalized.columns and "Adj Close" not in normalized.columns:
        raise MarketDataError(f"Market data for {ticker} has no closing price")
    return normalized


def fetch_close(ticker: str, start_date: date, end_date: date | None = None) -> pd.Series:
    frame = fetch_ohlcv(ticker, start_date, end_date)
    column = "Close" if "Close" in frame.columns else "Adj Close"
    close = pd.to_numeric(frame[column], errors="coerce").dropna()
    close.name = ticker
    if close.empty:
        raise MarketDataError(f"No closing prices found for {ticker}")
    return close