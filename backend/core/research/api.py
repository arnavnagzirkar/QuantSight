# core/research/api.py
from flask import Blueprint, request, jsonify
from matplotlib import ticker
import pandas as pd
import yfinance as yf
import numpy as np
import os


from .experiment import run_walkforward_xgb
from .factors import compute_alpha_factors, compute_pca_diagnostics
from .models import feature_columns
from .stats import (
    sharpe_ratio, sortino_ratio, information_ratio, alpha_beta,
    max_drawdown, cagr_from_equity, rolling_sharpe, rolling_vol
)
from .decay import compute_signal_decay, quantile_time_buckets  # <-- NEW
from .portfolio import backtest_portfolio
from .ff import fama_french_exposure


research_bp = Blueprint("research", __name__)

# ---------------------------
# Helpers to normalize yfinance shapes
# ---------------------------
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

def _get_close_series(ticker: str, start: str) -> pd.Series:
    df = yf.download(ticker, start=start, auto_adjust=True, progress=False)
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

def _series_to_jsonable(s: pd.Series, n_tail: int | None = None) -> dict:
    obj = s.copy()
    if n_tail is not None:
        obj = obj.tail(n_tail)
    if isinstance(obj.index, pd.DatetimeIndex):
        idx = obj.index.strftime("%Y-%m-%d")
    else:
        idx = obj.index.astype(str)
    return {str(k): (None if pd.isna(v) else float(v)) for k, v in zip(idx, obj.values)}

def _frame_to_jsonable(df: pd.DataFrame, n_tail: int | None = None) -> dict:
    obj = df.copy()
    if n_tail is not None:
        obj = obj.tail(n_tail)
    if isinstance(obj.index, pd.DatetimeIndex):
        idx = obj.index.strftime("%Y-%m-%d")
    else:
        idx = obj.index.astype(str)
    out = {}
    for i, row in enumerate(obj.itertuples(index=False, name=None)):
        day = str(idx[i])
        out[day] = {}
        for j, col in enumerate(obj.columns):
            v = row[j]
            out[day][str(col)] = None if pd.isna(v) else float(v)
    return out

# Renamed to avoid collision with base app's /api/v1/predict.
# Frontend should use /api/research/predict for walk-forward model probabilities.
@research_bp.route("/api/research/predict", methods=["GET"])
def predict_endpoint():
    ticker  = (request.args.get("ticker") or "AAPL").upper()
    start   = request.args.get("start") or "2015-01-01"
    horizon = request.args.get("horizon") or "1d"

    px_raw = yf.download(ticker, start=start, auto_adjust=True, progress=False)
    if px_raw is None or px_raw.empty:
        return jsonify({"error": f"No data for {ticker}"}), 400
    px = _flatten_ohlcv(px_raw, ticker)

    spy = _get_close_series("SPY", start)
    vix = _get_close_series("^VIX", start)

    out = run_walkforward_xgb(px, spy=spy, vix=vix, sector=None, horizon=horizon)
    preds = out.get("predictions", pd.DataFrame())
    if preds is None or preds.empty:
        return jsonify({"error": "No predictions produced."}), 400

    last_valid = preds.dropna().iloc[-1]
    as_of = preds.dropna().index[-1].strftime("%Y-%m-%d")

    prob_col = f"prob_up_{horizon}"
    prob_val = float(last_valid.get(prob_col)) if prob_col in preds.columns else None

    # Keep features compact: numeric scalars from that row
    features = {}
    for k, v in last_valid.items():
        try:
            fv = float(v)
            if np.isfinite(fv):
                features[str(k)] = fv
        except Exception:
            continue

    return jsonify({
        "ticker": ticker,
        "as_of": as_of,
        "prob_up": prob_val,
        "features": features
    })

@research_bp.route("/api/model/backtest", methods=["POST"])
def model_backtest():
    data = request.get_json(force=True) or {}
    ticker  = data.get("ticker", "AAPL")
    start   = data.get("start", "2015-01-01")
    horizon = data.get("horizon", "1d")
    model   = data.get("model", "xgb")

    px_raw = yf.download(ticker, start=start, auto_adjust=True, progress=False)
    if px_raw is None or px_raw.empty:
        return jsonify({"error": f"No data for {ticker}"}), 400
    px = _flatten_ohlcv(px_raw, ticker)
    spy = _get_close_series("SPY", start)
    vix = _get_close_series("^VIX", start)

    if model == "xgb":
        out = run_walkforward_xgb(px, spy=spy, vix=vix, sector=None, horizon=horizon)
    elif model == "lstm":
        return jsonify({"error": "LSTM not implemented yet"}), 400
    elif model == "ens":
        return jsonify({"error": "Ensemble not implemented yet"}), 400
    else:
        return jsonify({"error": f"Unknown model '{model}'"}), 400

    resp = {}
    for k in ("equity_curve","daily_returns"):
        s = out.get(k, pd.Series(dtype="float"))
        if isinstance(s, pd.Series) and not s.empty:
            resp[k] = _series_to_jsonable(s, n_tail=2000)
    pred = out.get("predictions", pd.DataFrame())
    if isinstance(pred, pd.DataFrame) and not pred.empty:
        resp["predictions"] = _frame_to_jsonable(pred, n_tail=500)

    if "feature_importance" in out:
        # surface top-15 only
        fi = out["feature_importance"] or []
        resp["feature_importance"] = fi[:15]

    return jsonify(resp)

@research_bp.route("/api/experiment/run", methods=["POST"])
def experiment_run():
    """
    Body JSON:
      {
        "ticker": "AAPL",
        "start": "2015-01-01",
        "horizon": "1d",
        "train_window": 750,
        "test_window": 63,
        "param_grid": {
          "n_estimators": [300,500],
          "max_depth": [3,5],
          "learning_rate": [0.03,0.07],
          "subsample": [0.8,1.0],
          "colsample_bytree": [0.8,1.0],
          "reg_lambda": [1.0,3.0]
        }
      }
    """
    from .experiment import run_walkforward_xgb_sweep

    data = request.get_json(force=True) or {}
    ticker  = data.get("ticker", "AAPL")
    start   = data.get("start", "2015-01-01")
    horizon = data.get("horizon", "1d")
    trw     = int(data.get("train_window", 750))
    tew     = int(data.get("test_window", 63))
    grid    = data.get("param_grid", None)
    
    persist  = bool(data.get("persist", False))
    ticker_safe = "".join(ch for ch in ticker if ch.isalnum() or ch in ("-", "_")).strip()

    px_raw = yf.download(ticker, start=start, auto_adjust=True, progress=False)
    if px_raw is None or px_raw.empty:
        return jsonify({"error": f"No data for {ticker}"}), 400
    px = _flatten_ohlcv(px_raw, ticker)
    spy = _get_close_series("SPY", start)
    vix = _get_close_series("^VIX", start)

    res = run_walkforward_xgb_sweep(
        px=px, spy=spy, vix=vix, sector=None,
        horizon=horizon, train_window=trw, test_window=tew, param_grid=grid
    )

    # JSON-normalize series like other endpoints
    out = {
        "best_params": res.get("best_params", {}),
        "summary": res.get("summary", []),
        "equity_curve": _series_to_jsonable(res.get("equity_curve", pd.Series(dtype=float)), n_tail=2000),
        "daily_returns": _series_to_jsonable(res.get("daily_returns", pd.Series(dtype=float)), n_tail=2000),
    }
    preds = res.get("predictions", pd.DataFrame())
    if isinstance(preds, pd.DataFrame) and not preds.empty:
        out["predictions"] = _frame_to_jsonable(preds.tail(500))

    # Optionally persist the best model
    if persist and out["best_params"]:
        # Recompute factors once so we can pass to persistence helper
        from .factors import compute_alpha_factors
        from .models import feature_columns
        from .experiment import persist_final_xgb_model

        df_all = compute_alpha_factors(px, spy=spy, vix=vix, sector=None)
        feats = feature_columns(df_all)
        # keep only valid, present features
        feats = [c for c in feats if c in df_all.columns]

        # use a per-ticker subdir
        model_dir = os.path.join("models", ticker_safe)
        paths = persist_final_xgb_model(
            df_all=df_all,
            horizon=horizon,
            feats=feats,
            params=out["best_params"],
            model_dir=model_dir,
            train_window=trw,
        )
        out["persisted"] = paths  # {"model_path": "...", "meta_path": "..."}

    return jsonify(out)


# ---------------------------
# /api/run — existing strategy + optional diagnostics
# ---------------------------
@research_bp.route("/api/run", methods=["POST"])
def run():
    data = request.get_json(force=True) or {}
    ticker  = data.get("ticker", "AAPL")
    start   = data.get("start", "2015-01-01")
    horizon = data.get("horizon", "1d")
    include_diag = bool(data.get("diagnostics", False))

    px_raw = yf.download(ticker, start=start, auto_adjust=True, progress=False)
    if px_raw is None or px_raw.empty:
        return jsonify({"error": f"No data for {ticker}"}), 400
    px = _flatten_ohlcv(px_raw, ticker)

    spy = _get_close_series("SPY", start)
    vix = _get_close_series("^VIX", start)

    out = run_walkforward_xgb(px, spy=spy, vix=vix, sector=None, horizon=horizon)

    eq = out.get("equity_curve", pd.Series(dtype="float"))
    if isinstance(eq, pd.Series) and not eq.empty:
        out["equity_curve"] = _series_to_jsonable(eq, n_tail=2000)

    dr = out.get("daily_returns", pd.Series(dtype="float"))
    if isinstance(dr, pd.Series) and not dr.empty:
        out["daily_returns"] = _series_to_jsonable(dr, n_tail=2000)

    pred = out.get("predictions", pd.DataFrame())
    if isinstance(pred, pd.DataFrame) and not pred.empty:
        out["predictions"] = _frame_to_jsonable(pred, n_tail=500)

    if include_diag:
        factors_df = compute_alpha_factors(px, spy=spy, vix=vix, sector=None)
        feats = feature_columns(factors_df)
        diag = compute_pca_diagnostics(factors_df, feats, n_components=8, topk_loadings=8)
        out["diagnostics"] = {
            "feature_count": len(feats),
            "features": feats,
            "pca": diag,
        }

    return jsonify(out)

# ---------------------------
# /api/factors — quick inspection of factors + (optional) PCA
# ---------------------------
@research_bp.route("/api/factors", methods=["POST"])
def factors_endpoint():
    data = request.get_json(force=True) or {}
    ticker = data.get("ticker", "AAPL")
    start  = data.get("start", "2015-01-01")
    rows   = int(data.get("rows", 150))
    want_diag = bool(data.get("diagnostics", False))

    px_raw = yf.download(ticker, start=start, auto_adjust=True, progress=False)
    if px_raw is None or px_raw.empty:
        return jsonify({"error": f"No data for {ticker}"}), 400
    px = _flatten_ohlcv(px_raw, ticker)

    spy = _get_close_series("SPY", start)
    vix = _get_close_series("^VIX", start)

    df = compute_alpha_factors(px, spy=spy, vix=vix, sector=None)
    cols = feature_columns(df)
    preview = df[cols].tail(rows)

    out = {
        "ticker": ticker,
        "columns": cols,
        "factors_preview": _frame_to_jsonable(preview, n_tail=None),
        "rows_returned": int(len(preview)),
        "index_range": {
            "start": str(preview.index[0].date()) if len(preview) else None,
            "end": str(preview.index[-1].date()) if len(preview) else None,
        },
    }

    if want_diag:
        out["pca"] = compute_pca_diagnostics(df, cols, n_components=8, topk_loadings=8)

    return jsonify(out)

# ---------------------------
# /api/risk — risk metrics and rolling diagnostics for the strategy
# ---------------------------
@research_bp.route("/api/risk", methods=["POST"])
def risk_endpoint():
    """
    Body JSON (all optional):
      {
        "ticker": "AAPL",
        "start": "2015-01-01",
        "horizon": "1d",
        "window": 63
      }
    Returns:
      - metrics: Sharpe, Sortino, IR, Alpha, Beta, CAGR, MaxDD
      - rolling: rolling_sharpe, rolling_vol (window)
    """
    data = request.get_json(force=True) or {}
    ticker  = data.get("ticker", "AAPL")
    start   = data.get("start", "2015-01-01")
    horizon = data.get("horizon", "1d")
    window  = int(data.get("window", 63))

    # Run the same model backtest to get daily strategy returns
    px_raw = yf.download(ticker, start=start, auto_adjust=True, progress=False)
    if px_raw is None or px_raw.empty:
        return jsonify({"error": f"No data for {ticker}"}), 400
    px = _flatten_ohlcv(px_raw, ticker)

    spy = _get_close_series("SPY", start)
    vix = _get_close_series("^VIX", start)

    res = run_walkforward_xgb(px, spy=spy, vix=vix, sector=None, horizon=horizon)
    daily = res.get("daily_returns", pd.Series(dtype="float"))
    eq = res.get("equity_curve", pd.Series(dtype="float"))

    if not isinstance(daily, pd.Series) or daily.empty:
        return jsonify({"error": "No daily returns available for risk computation."}), 400

    # Benchmark daily returns aligned to strategy
    spy_lr = pd.Series(np.log(spy).diff(), index=spy.index).reindex(daily.index).dropna()
    strat = daily.reindex(spy_lr.index).dropna()
    if strat.empty or spy_lr.empty:
        return jsonify({"error": "Insufficient overlap between strategy and benchmark."}), 400

    # Point-in-time metrics
    metrics = {
        "Sharpe": sharpe_ratio(strat),
        "Sortino": sortino_ratio(strat),
        "Information_Ratio": information_ratio(strat, spy_lr),
        "CAGR": cagr_from_equity(eq) if isinstance(eq, pd.Series) and not eq.empty else float("nan"),
        "Max_Drawdown": max_drawdown(eq) if isinstance(eq, pd.Series) and not eq.empty else float("nan"),
    }
    ab = alpha_beta(strat, spy_lr)
    metrics["Alpha_annual"] = ab["alpha"]
    metrics["Beta"] = ab["beta"]

    # Rolling diagnostics
    roll = {
        "rolling_sharpe": _series_to_jsonable(rolling_sharpe(strat, window).dropna(), n_tail=1000),
        "rolling_vol":    _series_to_jsonable(rolling_vol(strat, window).dropna(), n_tail=1000),
    }

    return jsonify({"metrics": metrics, "rolling": roll})

# ---------------------------
# /api/decay — Information Coefficient & bucketed averages
# ---------------------------
@research_bp.route("/api/decay", methods=["POST"])
def decay_endpoint():
    """
    Body JSON (all optional):
      {
        "ticker": "AAPL",
        "start": "2015-01-01",
        "horizon": "1d",          # for prob signal column
        "signal": null,           # defaults to prob_up_{horizon}; or any factor col name
        "horizons": [1,3,5,10,20] # forward horizons to evaluate
      }
    """
    data = request.get_json(force=True) or {}
    ticker    = data.get("ticker", "AAPL")
    start     = data.get("start", "2015-01-01")
    model_hz  = data.get("horizon", "1d")
    signal    = data.get("signal", None)
    horizons  = data.get("horizons", [1, 3, 5, 10, 20])

    # Data
    px_raw = yf.download(ticker, start=start, auto_adjust=True, progress=False)
    if px_raw is None or px_raw.empty:
        return jsonify({"error": f"No data for {ticker}"}), 400
    px = _flatten_ohlcv(px_raw, ticker)
    spy = _get_close_series("SPY", start)
    vix = _get_close_series("^VIX", start)

    # Factors (+ forward returns)
    df = compute_alpha_factors(px, spy=spy, vix=vix, sector=None)

    # Default signal = model probability
    res = run_walkforward_xgb(px, spy=spy, vix=vix, sector=None, horizon=model_hz)
    preds = res.get("predictions", pd.DataFrame())
    prob_col = f"prob_up_{model_hz}"
    if isinstance(preds, pd.DataFrame) and prob_col in preds.columns:
        df[prob_col] = preds[prob_col].reindex(df.index)

    sig_col = signal or prob_col
    if sig_col not in df.columns:
        return jsonify({"error": f"Signal '{sig_col}' not available."}), 400

    diag = compute_signal_decay(df, sig_col, horizons=horizons)

    return jsonify({
        "ticker": ticker,
        "signal": sig_col,
        "horizons": diag.get("horizons", horizons),
        "ic_pearson": diag.get("ic_pearson", {}),
        "ic_spearman": diag.get("ic_spearman", {}),
        "avg_forward_return": diag.get("avg_forward_return", {}),
        "rows_used": int(df.dropna(subset=[sig_col]).shape[0]),
    })

# ---------------------------
# /api/quantiles — time-bucket quantiles & Qn-Q1 curve
# ---------------------------
@research_bp.route("/api/quantiles", methods=["POST"])
def quantiles_endpoint():
    """
    Body JSON (all optional):
      {
        "ticker": "AAPL",
        "start": "2015-01-01",
        "horizon": "1d",     # for prob signal column
        "signal": null,      # defaults to prob_up_{horizon}; or any factor col name
        "ret_horizon_days": 1,
        "n_quantiles": 5,
        "roll": 252
      }
    """
    data = request.get_json(force=True) or {}
    ticker      = data.get("ticker", "AAPL")
    start       = data.get("start", "2015-01-01")
    model_hz    = data.get("horizon", "1d")
    signal      = data.get("signal", None)
    ret_h       = int(data.get("ret_horizon_days", 1))
    n_quants    = int(data.get("n_quantiles", 5))
    roll        = int(data.get("roll", 252))

    # Data
    px_raw = yf.download(ticker, start=start, auto_adjust=True, progress=False)
    if px_raw is None or px_raw.empty:
        return jsonify({"error": f"No data for {ticker}"}), 400
    px = _flatten_ohlcv(px_raw, ticker)
    spy = _get_close_series("SPY", start)
    vix = _get_close_series("^VIX", start)

    df = compute_alpha_factors(px, spy=spy, vix=vix, sector=None)

    # Default signal = model probability
    res = run_walkforward_xgb(px, spy=spy, vix=vix, sector=None, horizon=model_hz)
    preds = res.get("predictions", pd.DataFrame())
    prob_col = f"prob_up_{model_hz}"
    if isinstance(preds, pd.DataFrame) and prob_col in preds.columns:
        df[prob_col] = preds[prob_col].reindex(df.index)

    sig_col = signal or prob_col
    ret_col = f"target_ret_{ret_h}d"
    if sig_col not in df.columns:
        return jsonify({"error": f"Signal '{sig_col}' not available."}), 400
    if ret_col not in df.columns:
        return jsonify({"error": f"Return column '{ret_col}' not available."}), 400

    q = quantile_time_buckets(
        df, signal_col=sig_col, ret_col=ret_col,
        n_quantiles=n_quants, roll=roll
    )

    return jsonify({
        "ticker": ticker,
        "signal": sig_col,
        "ret_col": ret_col,
        "n_quantiles": n_quants,
        "roll": roll,
        "mean_forward_return_by_quantile": q.get("mean_forward_return_by_quantile", {}),
        "long_short_equity_curve": q.get("long_short_equity_curve", {}),
        "long_short": q.get("long_short_equity_curve", {}),  # alias for current UI
    })

# ---------------------------
# /api/portfolio/backtest — multi-ticker portfolio engine
# ---------------------------
@research_bp.route("/api/portfolio/backtest", methods=["POST"])
def portfolio_backtest_endpoint():
    """
    Body JSON:
      {
        "tickers": ["AAPL","MSFT","NVDA"],
        "start": "2015-01-01",
        "signal": "prob_up_1d"  # or any factor name e.g. "mom_20"
        "allocator": "equal_weight" | "risk_parity" | "mean_variance",
        "rebalance": "weekly",   # "daily"|"weekly"|"monthly"
        "cost_bps": 5.0
      }
    """
    data = request.get_json(force=True) or {}
    tickers = data.get("tickers", [])
    start   = data.get("start", "2015-01-01")
    signal  = data.get("signal", "prob_up_1d")
    allocator = data.get("allocator", "equal_weight")
    rebalance = data.get("rebalance", "weekly")
    cost_bps  = float(data.get("cost_bps", 5.0))

    if not isinstance(tickers, list) or len(tickers) == 0:
        return jsonify({"error": "Provide non-empty 'tickers' list."}), 400

    try:
        bt = backtest_portfolio(
            tickers=tickers, start=start, signal=signal,
            allocator=allocator, rebalance=rebalance, cost_bps=cost_bps
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    # risk metrics vs SPY
    try:
        spy = _get_close_series("SPY", start)
        spy_lr = np.log(spy).diff().reindex(bt["daily_returns"].index).dropna()
        strat = bt["daily_returns"].reindex(spy_lr.index).dropna()
        metrics = {
            "Sharpe": sharpe_ratio(strat),
            "Sortino": sortino_ratio(strat),
            "Information_Ratio": information_ratio(strat, spy_lr),
            "CAGR": cagr_from_equity(bt["equity_curve"]),
            "Max_Drawdown": max_drawdown(bt["equity_curve"]),
        }
        ab = alpha_beta(strat, spy_lr)
        metrics["Alpha_annual"] = ab["alpha"]
        metrics["Beta"] = ab["beta"]
    except Exception:
        metrics = {}

    # Convert weights DataFrame to nested dict format for frontend
    weights_df = bt["weights"].fillna(0.0)
    weights_history = {}
    
    # Subsample to avoid massive payload (last 200 dates or all if fewer)
    tail_dates = weights_df.index[-200:] if len(weights_df) > 200 else weights_df.index
    
    for date in tail_dates:
        date_str = date.strftime("%Y-%m-%d")
        weights_history[date_str] = {}
        for ticker in weights_df.columns:
            w = weights_df.loc[date, ticker]
            if pd.notna(w):
                weights_history[date_str][ticker] = float(w)

    # Add benchmark (SPY buy & hold for comparison)
    benchmark = {}
    try:
        spy_prices = spy.reindex(bt["equity_curve"].index)
        spy_norm = spy_prices / spy_prices.iloc[0]
        for date in spy_norm.index[-2000:]:  # Match equity curve tail
            benchmark[date.strftime("%Y-%m-%d")] = float(spy_norm.loc[date])
    except Exception:
        benchmark = {}

    out = {
        "universe": bt["universe"],
        "allocator": allocator,
        "rebalance": rebalance,
        "cost_bps": cost_bps,
        "metrics": metrics,
        "daily_returns": _series_to_jsonable(bt["daily_returns"], n_tail=2000),
        "equity_curve": _series_to_jsonable(bt["equity_curve"], n_tail=2000),
        "benchmark": benchmark,
        "weights_history": weights_history,
    }
    
    try:
        lookback = 126  # ~6 months
        # 1) Pull prices for universe and compute log-returns
        prices = []
        for t in bt["universe"]:
            s = _get_close_series(t, start)  # reuse helper
            prices.append(s)
        px = pd.concat(prices, axis=1).reindex(bt["daily_returns"].index).dropna()
        px = px[bt["universe"]]  # order columns
        lr = np.log(px).diff().dropna()

        # 2) Align weights to lr dates
        W = bt["weights"].reindex(lr.index).fillna(0.0)
        # 3) Window slice
        lr_win = lr.tail(lookback)
        W_win  = W.tail(lookback)

        # 4) Per-asset daily contributions and sum across window
        contrib_daily = W_win * lr_win  # elementwise (w_i,t * r_i,t)
        contrib_sum = contrib_daily.sum(axis=0)  # per asset, across time

        # 5) Normalize to % of total portfolio return over window (optional but nice)
        port_ret_sum = bt["daily_returns"].reindex(contrib_daily.index).sum()
        if port_ret_sum != 0 and np.isfinite(port_ret_sum):
            contrib_pct = (contrib_sum / port_ret_sum).replace([np.inf, -np.inf], np.nan)
        else:
            contrib_pct = pd.Series(index=contrib_sum.index, dtype="float64")

        out["attribution_6m_abs"] = {k: float(v) for k, v in contrib_sum.items()}        # absolute (sum of w*r)
        out["attribution_6m_pct"] = {k: (None if pd.isna(v) else float(v)) for k, v in contrib_pct.items()}  # fraction of total
    except Exception as _e:
        out["attribution_6m_abs"] = {}
        out["attribution_6m_pct"] = {}
        
    return jsonify(out)

# ---------------------------
# /api/ff_exposure — Fama–French factor attribution (FF3/FF5)
# ---------------------------
@research_bp.route("/api/ff_exposure", methods=["POST"])
def ff_exposure_endpoint():
    """
    Returns Fama–French factor exposures for the portfolio strategy.
    Body accepts: tickers, start, signal, allocator, rebalance, cost_bps, ff_set ("ff5"|"ff3")
    """
    data = request.get_json(force=True) or {}
    tickers   = data.get("tickers", [])
    start     = data.get("start", "2015-01-01")
    signal    = data.get("signal", "prob_up_1d")
    allocator = data.get("allocator", "equal_weight")
    rebalance = data.get("rebalance", "weekly")
    cost_bps  = float(data.get("cost_bps", 5))
    ff_set    = data.get("ff_set", "ff5")

    if not tickers or not isinstance(tickers, (list, tuple)):
        return jsonify({"error": "tickers must be a non-empty list"}), 400

    try:
        result = backtest_portfolio(
            tickers=tickers,
            start=start,
            signal=signal,
            allocator=allocator,
            rebalance=rebalance,
            cost_bps=cost_bps
        )
    except Exception as e:
        return jsonify({"error": f"portfolio backtest failed: {e}"}), 500

    daily_returns = result.get("daily_returns")
    if daily_returns is None or daily_returns.empty:
        return jsonify({"error": "No portfolio daily returns to regress."}), 400

    try:
        ff_output = fama_french_exposure(daily_returns, which=ff_set)
        return jsonify(ff_output)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

