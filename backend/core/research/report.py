# core/research/report.py
from __future__ import annotations
from flask import Blueprint, request, jsonify
import pandas as pd
import numpy as np
from datetime import datetime
from functools import lru_cache
import json, hashlib, time

from .portfolio import backtest_portfolio
from .stats import (
    sharpe_ratio, sortino_ratio, max_drawdown, cagr_from_equity,
    rolling_sharpe, rolling_vol
)
from .ff import fama_french_exposure
from .factors import compute_pca_diagnostics
from .models import feature_columns


_REPORT_CACHE: dict[str, tuple[float, dict]] = {}
_CACHE_TTL = 60.0  # seconds
def _cache_get(key: str):
    v = _REPORT_CACHE.get(key)
    if not v: return None
    ts, payload = v
    return payload if (time.time() - ts) < _CACHE_TTL else None

def _cache_put(key: str, payload: dict):
    _REPORT_CACHE[key] = (time.time(), payload)

def _hash_body(d: dict) -> str:
    return hashlib.sha256(json.dumps(d, sort_keys=True, default=str).encode()).hexdigest()

report_bp = Blueprint("report", __name__)

def _to_records(df: pd.DataFrame, **rename):
    if df is None or len(df) == 0:
        return []
    d = df.copy()
    if rename:
        d = d.rename(columns=rename)
    d = d.reset_index()
    if "date" not in d.columns:
        if isinstance(df.index, pd.DatetimeIndex):
            d.insert(0, "date", df.index)
        else:
            d.insert(0, "date", pd.to_datetime(df.index, errors="coerce"))
    d["date"] = pd.to_datetime(d["date"]).dt.strftime("%Y-%m-%d")
    return d.to_dict(orient="records")

def _rolling_drawdown(equity: pd.Series) -> pd.Series:
    if equity is None or equity.empty:
        return pd.Series(dtype="float")
    peak = equity.cummax()
    return (equity / peak) - 1.0

@report_bp.route("/api/report", methods=["POST"])
def full_report():
    cfg = request.get_json(force=True) or {}
    bench = cfg.get("benchmark", "SPY")
    
    ckey = _hash_body(cfg)
    hit = _cache_get(ckey)
    if hit is not None:
        return jsonify(hit)

    # 1) Run portfolio backtest
    res = backtest_portfolio(**cfg)

    daily_obj = res.get("daily", [])
    daily = daily_obj.copy() if isinstance(daily_obj, pd.DataFrame) else pd.DataFrame(daily_obj)

    if "date" in daily.columns:
        daily["date"] = pd.to_datetime(daily["date"])
        daily = daily.set_index("date").sort_index()
    else:
        return jsonify({"error": "Backtest did not return 'daily' timeseries."}), 400

    # Ensure benchmark column exists
    if "bench_ret" not in daily.columns:
        daily["bench_ret"] = 0.0

    # Get equity curves from backtest
    equity = pd.Series(res.get("equity_curve", {}), dtype="float")
    bench_equity = pd.Series(res.get("bench_equity", {}), dtype="float")

    # Fallback: rebuild from daily returns if needed
    if (equity is None or equity.empty) and "ret" in daily.columns:
        equity = daily["ret"].astype(float).cumsum().apply(np.exp)
    if (bench_equity is None or bench_equity.empty) and "bench_ret" in daily.columns:
        bench_equity = daily["bench_ret"].astype(float).cumsum().apply(np.exp)

    # Align to daily index
    eq_df = pd.DataFrame(index=daily.index)
    if equity is not None and not equity.empty:
        eq_df["equity"] = equity.reindex(eq_df.index).ffill()
    else:
        eq_df["equity"] = np.nan
        
    if bench_equity is not None and not bench_equity.empty:
        eq_df["bench_equity"] = bench_equity.reindex(eq_df.index).ffill()
    else:
        eq_df["bench_equity"] = np.nan

    # Normalize both to 1 at first date
    first_idx = eq_df.index.min()
    if pd.notna(eq_df.loc[first_idx, "equity"]) and eq_df.loc[first_idx, "equity"] != 0:
        eq_df["equity"] = eq_df["equity"] / float(eq_df.loc[first_idx, "equity"])
    if pd.notna(eq_df.loc[first_idx, "bench_equity"]) and eq_df.loc[first_idx, "bench_equity"] != 0:
        eq_df["bench_equity"] = eq_df["bench_equity"] / float(eq_df.loc[first_idx, "bench_equity"])

    equity_records = _to_records(eq_df)

    # 2) Summary statistics
    summary = {
        "cagr": cagr_from_equity(equity),
        "sharpe": sharpe_ratio(daily["ret"]) if "ret" in daily else None,
        "sortino": sortino_ratio(daily["ret"]) if "ret" in daily else None,
        "max_drawdown": max_drawdown(equity),
        "vol_annual": float(daily["ret"].std() * np.sqrt(252)) if "ret" in daily else None,
        "turnover_annual": res.get("turnover_annual"),
    }

    # Calculate alpha/beta and information ratio
    if {"ret", "bench_ret"}.issubset(daily.columns):
        r = daily["ret"].astype(float).replace([np.inf, -np.inf], np.nan).fillna(0.0)
        b = daily["bench_ret"].astype(float).replace([np.inf, -np.inf], np.nan).fillna(0.0)
        
        # Alpha/Beta calculation
        var_b = float(b.var(ddof=1)) if len(b) > 1 else 0.0
        if var_b > 0.0:
            cov_rb = float(np.cov(r, b, ddof=1)[0, 1])
            beta = cov_rb / var_b
            alpha_daily = float((r - beta * b).mean())
            summary["alpha_beta"] = {"alpha": alpha_daily * 252.0, "beta": beta}
        else:
            summary["alpha_beta"] = {"alpha": None, "beta": None}
        
        # Information Ratio calculation
        active_ret = r - b
        ir_std = active_ret.std(ddof=1)
        if ir_std > 0:
            summary["information_ratio"] = float((active_ret.mean() / ir_std) * np.sqrt(252))
        else:
            summary["information_ratio"] = None
    else:
        summary["alpha_beta"] = {"alpha": None, "beta": None}
        summary["information_ratio"] = None

    # 3) Rolling windows (63d)
    win = 63
    roll = {
        "window_days": win,
        "sharpe": _to_records(rolling_sharpe(daily["ret"], win).to_frame("value")) if "ret" in daily else [],
        "vol": _to_records(rolling_vol(daily["ret"], win).to_frame("value")) if "ret" in daily else [],
        "drawdown": _to_records(_rolling_drawdown(equity).to_frame("value")),
    }
    
    raw_weights = res.get("weights")
    if isinstance(raw_weights, dict):
        weights = pd.DataFrame.from_dict(raw_weights, orient="index").sort_index()
    else:
        weights = pd.DataFrame(raw_weights)

    # 4) Attribution
    rets_wide = pd.DataFrame(res.get("asset_returns", []))
    attrib = {"last_6m": [], "per_period": []}
    if not weights.empty and not rets_wide.empty:
        weights.index = pd.to_datetime(weights.index)
        rets_wide.index = pd.to_datetime(rets_wide.index)
        aligned_w = weights.reindex(daily.index).fillna(0.0)
        aligned_r = rets_wide.reindex(daily.index).fillna(0.0)
        contrib = aligned_w * aligned_r

        cutoff = daily.index.max() - pd.Timedelta(days=182)
        last6 = contrib.loc[contrib.index >= cutoff]
        last6_sum = last6.sum().sort_values(ascending=False)
        attrib["last_6m"] = [{"ticker": t, "contribution": float(v)} for t, v in last6_sum.items()]
        attrib["per_period"] = _to_records(contrib)

    # 5) FF factor exposures
    exposures = {}
    if "ret" in daily and "bench_ret" in daily:
        ff = fama_french_exposure(daily["ret"], daily["bench_ret"])
        exposures["factors"] = ff

    # 6) Diagnostics
    pca = res.get("pca", {})
    model_info = res.get("model_info", {})

    weights_json = {}
    if isinstance(weights, pd.DataFrame) and not weights.empty:
        w = weights.copy().fillna(0.0)
        w.index = pd.to_datetime(w.index)
        weights_json = {
            d.strftime("%Y-%m-%d"): {c: float(w.at[d, c]) for c in w.columns}
            for d in w.index
        }

    payload = {
        "as_of": datetime.utcnow().date().isoformat(),
        "config": {
            "universe": cfg.get("tickers"),
            "start": cfg.get("start"),
            "rebalance": cfg.get("rebalance"),
            "signal": cfg.get("signal"),
            "allocator": cfg.get("allocator"),
            "n_quantiles": cfg.get("n_quantiles"),
            "long_q": cfg.get("long_q"),
            "short_q": cfg.get("short_q"),
            "benchmark": bench
        },
        "performance": {
            "daily": _to_records(daily[["ret","bench_ret"]]) if {"ret","bench_ret"}.issubset(daily.columns) else [],
            "equity": equity_records,
            "summary": summary
        },
        "rolling": roll,
        "attribution": attrib,
        "exposures": exposures,
        "diagnostics": {
            "pca": pca,
            "model_info": model_info
        },
        "weights": weights_json,
    }
    _cache_put(ckey, payload)
    return jsonify(payload)