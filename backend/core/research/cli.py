# core/research/cli.py
from __future__ import annotations
import os, json, sys, pathlib
import click
import pandas as pd
import numpy as np

# Local imports
from .cache import load_prices
from .factors import compute_alpha_factors
from .walkforward import walk_forward_splits
from .models import feature_columns, train_xgb_prob
from .backtest import backtest_prob_strategy
from .experiment import run_walkforward_xgb_sweep, persist_final_xgb_model
from .stats import sharpe_ratio

# ---------- helpers ----------
def _flatten_ohlcv(px_raw, ticker: str | None = None) -> pd.DataFrame:
    """
    Normalize a variety of yfinance/pandas OHLCV column shapes to a flat, lowercase set:
    ['open','high','low','close','volume'].
    Handles:
      - Plain Index of strings (e.g., 'Open', 'Adj Close', ...)
      - Tuple-like columns or MultiIndex columns (e.g., ('AAPL','Open') or ('Open',))
      - Multi-ticker downloads (filters to the provided ticker if present)
    """
    if px_raw is None or px_raw.empty:
        return pd.DataFrame(index=pd.Index([], dtype='datetime64[ns]'))

    df = px_raw.copy()

    # Convert any MultiIndex/tuple columns into strings like "AAPL_Open" or just "Open"
    if isinstance(df.columns, pd.MultiIndex):
        new_cols = []
        for tup in df.columns:
            # tup is a tuple; keep non-empty parts
            parts = [str(x) for x in tup if x not in (None, "", "None")]
            new_cols.append("_".join(parts))
        df.columns = new_cols
    else:
        # some pandas/yf versions may still yield tuple-ish entries in a plain Index
        def _col_to_str(c):
            if isinstance(c, tuple):
                parts = [str(x) for x in c if x not in (None, "", "None")]
                return "_".join(parts)
            return str(c)
        df.columns = [_col_to_str(c) for c in df.columns]

    # If this came from a multi-ticker pull and a ticker is provided, isolate that ticker's columns
    if ticker:
        prefix = f"{ticker}_"
        ticker_cols = [c for c in df.columns if c.startswith(prefix)]
        if ticker_cols:
            df = df[ticker_cols]
            # drop the ticker prefix -> leave bare field names
            df.columns = [c[len(prefix):] for c in df.columns]

    # standardize naming
    rename_map = {
        "open": "open",
        "high": "high",
        "low": "low",
        "close": "close",
        "adj_close": "close",   # prefer adjusted close if that's what we have
        "adjclose": "close",
        "volume": "volume",
    }

    def _norm(c: str) -> str:
        c_low = c.lower().replace(" ", "_")
        # common yf variations like "AAPL_Close", "Close_x", etc. handled above
        return rename_map.get(c_low, c_low)

    df.columns = [_norm(c) for c in df.columns]

    # If both 'close' and 'adj_close' ended up in cols, keep one 'close'
    if "adj_close" in px_raw.columns:
        # already mapped above; ensure single 'close' column if duplicates pop up
        if isinstance(df.columns, pd.Index):
            df = df.loc[:, ~df.columns.duplicated()]

    # keep known fields that actually exist
    keep = [c for c in ["open", "high", "low", "close", "volume"] if c in df.columns]
    if not keep:
        # fall back to whatever we have, at least return something
        return df

    df = df[keep].copy()
    df.index = pd.to_datetime(df.index)
    df = df.sort_index()
    return df

def _ensure_dir(path: str): pathlib.Path(path).mkdir(parents=True, exist_ok=True)

# ---------- CLI ----------
@click.group(help="Research pipeline CLI (train | backtest | report | fetch | factors)")
def cli():
    pass

@cli.command(help="Fetch & cache prices for a list of tickers.")
@click.option("--tickers", "-t", multiple=True, required=True, help="Tickers, repeat flag or comma-separated.")
@click.option("--start", default="2015-01-01", show_default=True)
@click.option("--force-refresh", is_flag=True, default=False)
def fetch(tickers, start, force_refresh):
    tickers = sum([t.split(",") for t in tickers], [])
    for tk in tickers:
        df = load_prices(tk, start=start, force_refresh=force_refresh)
        click.echo(f"Fetched {tk}: {len(df)} rows")

@cli.command(help="Compute and persist factors parquet for a list of tickers.")
@click.option("--tickers", "-t", multiple=True, required=True)
@click.option("--start", default="2015-01-01", show_default=True)
@click.option("--outdir", default="data/factors", show_default=True)
def factors(tickers, start, outdir):
    tickers = sum([t.split(",") for t in tickers], [])
    _ensure_dir(outdir)

    # load SPY/VIX for cross-asset features if present
    spy = load_prices("SPY", start=start)
    spy = (spy["Close"] if "Close" in spy.columns else spy.iloc[:, 0]).squeeze("columns")

    vix = load_prices("^VIX", start=start)
    vix = (vix["Close"] if "Close" in vix.columns else vix.iloc[:, 0]).squeeze("columns")

    for tk in tickers:
        px = load_prices(tk, start=start)
        px_flat = _flatten_ohlcv(px, tk)
        df = compute_alpha_factors(px_flat, spy=spy, vix=vix, sector=None)
        path = os.path.join(outdir, f"{tk.upper()}_factors.parquet")
        df.to_parquet(path)
        click.echo(f"Wrote {path} ({len(df)} rows)")

@cli.command(help="Train best XGB via walk-forward and optionally persist.")
@click.option("--ticker", required=True)
@click.option("--start", default="2016-01-01", show_default=True)
@click.option("--horizon", type=click.Choice(["1d","5d","20d"]), default="1d", show_default=True)
@click.option("--train-window", type=int, default=750, show_default=True)
@click.option("--test-window", type=int, default=63, show_default=True)
@click.option("--persist/--no-persist", default=True, show_default=True)
@click.option("--models-dir", default="models", show_default=True)
def train(ticker, start, horizon, train_window, test_window, persist, models_dir):
    spy = load_prices("SPY", start=start)["Close"]
    vix = load_prices("^VIX", start=start)["Close"]
    px  = load_prices(ticker, start=start)
    df_px = _flatten_ohlcv(px, ticker)
    res = run_walkforward_xgb_sweep(
        px=df_px, spy=spy, vix=vix, sector=None,
        horizon=horizon, train_window=train_window, test_window=test_window, param_grid=None
    )
    click.echo(json.dumps({"best_params": res.get("best_params", {}), "summary_len": len(res.get("summary", []))}, indent=2))
    if persist and res.get("best_params"):
        from .factors import compute_alpha_factors
        from .models import feature_columns
        df_all = compute_alpha_factors(df_px, spy=spy, vix=vix, sector=None)
        feats = [c for c in feature_columns(df_all) if c in df_all.columns]
        model_dir = os.path.join(models_dir, ticker.upper())
        paths = persist_final_xgb_model(
            df_all=df_all,
            horizon=horizon,
            feats=feats,
            params=res["best_params"],
            model_dir=model_dir,
            train_window=train_window,
        )
        click.echo(json.dumps({"persisted": paths}, indent=2))

@cli.command(help="Backtest (signal-based or ML prob) on a single ticker.")
@click.option("--ticker", required=True)
@click.option("--start", default="2020-01-01", show_default=True)
@click.option("--signal-col", default="ret_20d", show_default=True, help="e.g., ret_20d or prob_up_1d")
@click.option("--horizon", default="1d", show_default=True)
@click.option("--train-window", type=int, default=400)
@click.option("--test-window", type=int, default=42)
@click.option("--threshold", type=float, default=0.5, show_default=True)
@click.option("--cost-bps", type=float, default=5.0, show_default=True)
def backtest(ticker, start, signal_col, horizon, train_window, test_window, threshold, cost_bps):
    spy = load_prices("SPY", start=start)["Close"]
    vix = load_prices("^VIX", start=start)["Close"]
    px  = load_prices(ticker, start=start)
    df_px = _flatten_ohlcv(px, ticker)

    # Factors (for signal_col existence or to train)
    df_all = compute_alpha_factors(df_px, spy=spy, vix=vix, sector=None)

    ret_col = f"target_ret_{horizon}"
    if signal_col.startswith("prob_up"):
        # Train a quick walk-forward model inline for the demo backtest
        y_col = {"1d":"y_up_1d","5d":"y_up_5d","20d":"y_up_20d"}[horizon]
        feats = [c for c in feature_columns(df_all) if c in df_all.columns]
        df = df_all[feats + [y_col]].dropna().copy()
        probs = pd.Series(index=df.index, dtype=float)
        any_fold = False
        for tr_idx, te_idx in walk_forward_splits(df, train_window, test_window, min_train=250):
            any_fold = True
            X_tr, y_tr = df.iloc[tr_idx][feats], df.iloc[tr_idx][y_col]
            split = max(1, int(len(X_tr)*0.8))
            X_tr_, y_tr_ = X_tr.iloc[:split], y_tr.iloc[:split]
            X_val_, y_val_= X_tr.iloc[split:], y_tr.iloc[split:]
            if X_val_.empty: X_val_, y_val_ = X_tr_, y_tr_
            model, _ = train_xgb_prob(X_tr_, y_tr_, X_val_, y_val_)
            X_te = df.iloc[te_idx][feats]
            probs.loc[X_te.index] = model.predict_proba(X_te)[:,1]
        if not any_fold:
            click.echo("Not enough data to form folds", err=True)
            sys.exit(2)
        df_all[signal_col] = probs

    if ret_col not in df_all.columns or signal_col not in df_all.columns:
        click.echo(f"Missing columns. ret:{ret_col in df_all.columns}, signal:{signal_col in df_all.columns}", err=True)
        sys.exit(2)

    df_bt = df_all.dropna(subset=[signal_col, ret_col]).copy()
    bt = backtest_prob_strategy(
        df_bt, prob_col=signal_col, ret_col=ret_col,
        threshold=threshold, max_leverage=1.0, cost_bps=cost_bps
    )
    out = {k: v for k,v in bt.items() if k not in ("equity_curve","series")}
    out["sharpe"] = float(sharpe_ratio(bt["series"]))
    click.echo(json.dumps(out, indent=2))

@cli.command(help="Produce a quick JSON research report bundle.")
@click.option("--ticker", required=True)
@click.option("--start", default="2020-01-01", show_default=True)
@click.option("--horizon", default="1d", show_default=True)
def report(ticker, start, horizon):
    spy = load_prices("SPY", start=start)["Close"]
    vix = load_prices("^VIX", start=start)["Close"]
    px  = load_prices(ticker, start=start)
    df_px = _flatten_ohlcv(px, ticker)
    factors = compute_alpha_factors(df_px, spy=spy, vix=vix, sector=None)
    payload = {
        "ticker": ticker.upper(),
        "rows": int(len(factors)),
        "cols": list(factors.columns)[:40],
        "has_targets": any(c.startswith("target_ret_") for c in factors.columns),
        "has_labels": any(c.startswith("y_up_") for c in factors.columns),
    }
    click.echo(json.dumps(payload, indent=2))

if __name__ == "__main__":
    cli()
