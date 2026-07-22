from datetime import datetime, timezone
import os
from uuid import uuid4

import pandas as pd
import numpy as np
from redis import Redis
from redis.exceptions import RedisError
from rq import Queue
from rq.command import send_stop_job_command
from rq.exceptions import InvalidJobOperation, InvalidJobOperationError, NoSuchJobError
from rq.job import Job as RQJob, JobStatus

from .database import (
    SupabaseConfigurationError,
    SupabaseServiceError,
    create_job,
    find_job_by_idempotency,
    get_user_job as get_persisted_user_job,
    persist_job_result_resource,
    update_user_job,
)
from .market_data import fetch_close, fetch_ohlcv
from .research.experiment import (
    run_walkforward_ensemble,
    run_walkforward_lstm,
    run_walkforward_xgb,
)
from .research.decay import compute_signal_decay, quantile_time_buckets
from .research.factors import compute_alpha_factors
from .research.portfolio import backtest_portfolio
from .research.stats import alpha_beta, cagr_from_equity, max_drawdown, sharpe_ratio, sortino_ratio
from .risk import (
    component_risk,
    correlation_matrix,
    drawdown_analysis,
    historical_stress_performance,
    historical_var_cvar,
)
from .schemas import (
    ModelTrainingRequest,
    PortfolioRunRequest,
    SignalAnalysisRequest,
    StrategyBacktestRequest,
)


class QueueConfigurationError(RuntimeError):
    pass


class JobNotFoundError(RuntimeError):
    pass


def get_queue() -> Queue:
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        raise QueueConfigurationError("REDIS_URL is not configured")
    return Queue("research", connection=Redis.from_url(redis_url))


def enqueue_model_training(
    user_id: str,
    params: dict,
    idempotency_key: str | None = None,
) -> dict:
    if idempotency_key:
        existing = find_job_by_idempotency(user_id, idempotency_key)
        if existing is not None:
            return existing

    job_id = str(uuid4())
    record = create_job(
        job_id=job_id,
        user_id=user_id,
        job_type="model_train",
        params=params,
        idempotency_key=idempotency_key,
    )
    try:
        get_queue().enqueue(
            execute_model_training,
            job_id,
            user_id,
            params,
            job_id=job_id,
            job_timeout=7200,
            result_ttl=86400,
            failure_ttl=604800,
        )
    except Exception as error:
        update_user_job(
            user_id,
            job_id,
            {
                "status": "failed",
                "error_code": "queue_unavailable",
                "error_message": "Unable to enqueue background work",
                "completed_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        if isinstance(error, QueueConfigurationError):
            raise
        raise QueueConfigurationError("Unable to enqueue background work") from error
    return record


def _enqueue_research_job(
    *,
    user_id: str,
    job_type: str,
    params: dict,
    executor,
    idempotency_key: str | None,
) -> dict:
    if idempotency_key:
        existing = find_job_by_idempotency(user_id, idempotency_key)
        if existing is not None:
            return existing
    job_id = str(uuid4())
    record = create_job(
        job_id=job_id,
        user_id=user_id,
        job_type=job_type,
        params=params,
        idempotency_key=idempotency_key,
    )
    try:
        get_queue().enqueue(
            executor,
            job_id,
            user_id,
            params,
            job_id=job_id,
            job_timeout=7200,
            result_ttl=86400,
            failure_ttl=604800,
        )
    except Exception as error:
        update_user_job(
            user_id,
            job_id,
            {
                "status": "failed",
                "error_code": "queue_unavailable",
                "error_message": "Unable to enqueue background work",
                "completed_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        raise QueueConfigurationError("Unable to enqueue background work") from error
    return record


def enqueue_strategy_backtest(
    user_id: str,
    params: dict,
    idempotency_key: str | None = None,
) -> dict:
    return _enqueue_research_job(
        user_id=user_id,
        job_type="backtest",
        params=params,
        executor=execute_strategy_backtest,
        idempotency_key=idempotency_key,
    )


def enqueue_portfolio_run(
    user_id: str,
    params: dict,
    idempotency_key: str | None = None,
) -> dict:
    return _enqueue_research_job(
        user_id=user_id,
        job_type="portfolio_run",
        params=params,
        executor=execute_portfolio_run,
        idempotency_key=idempotency_key,
    )


def enqueue_signal_analysis(
    user_id: str,
    params: dict,
    idempotency_key: str | None = None,
) -> dict:
    return _enqueue_research_job(
        user_id=user_id,
        job_type="signal_analysis",
        params=params,
        executor=execute_signal_analysis,
        idempotency_key=idempotency_key,
    )


def enqueue_experiment_run(
    user_id: str,
    experiment_id: str,
    params: dict,
    idempotency_key: str | None = None,
) -> dict:
    payload = {"experiment_id": experiment_id, **params}
    return _enqueue_research_job(
        user_id=user_id,
        job_type="experiment_run",
        params=payload,
        executor=execute_experiment_run,
        idempotency_key=idempotency_key,
    )


def get_user_job(user_id: str, job_id: str) -> dict:
    job = get_persisted_user_job(user_id, job_id)
    if job is None:
        raise JobNotFoundError("Job not found")
    return job


def _mark_job_cancelled(user_id: str, job_id: str) -> dict:
    return update_user_job(
        user_id,
        job_id,
        {
            "status": "cancelled",
            "cancel_requested": True,
            "progress_phase": "Cancelled",
            "completed_at": datetime.now(timezone.utc).isoformat(),
        },
    )


def cancel_user_job(user_id: str, job_id: str) -> dict:
    job = get_persisted_user_job(user_id, job_id)
    if job is None:
        raise JobNotFoundError("Job not found")
    if job["status"] not in {"queued", "running", "cancel_requested"}:
        return job
    requested = update_user_job(
        user_id,
        job_id,
        {
            "status": "cancel_requested",
            "cancel_requested": True,
            "progress_phase": "Cancellation requested",
        },
    )
    try:
        queue = get_queue()
        rq_job = RQJob.fetch(job_id, connection=queue.connection)
        rq_status = rq_job.get_status(refresh=True)
        if rq_status in {
            JobStatus.CREATED,
            JobStatus.QUEUED,
            JobStatus.DEFERRED,
            JobStatus.SCHEDULED,
        }:
            rq_job.cancel()
            return _mark_job_cancelled(user_id, job_id)
        if rq_status == JobStatus.STARTED:
            send_stop_job_command(queue.connection, job_id)
            return _mark_job_cancelled(user_id, job_id)
        if rq_status in {JobStatus.CANCELED, JobStatus.STOPPED}:
            return _mark_job_cancelled(user_id, job_id)
    except NoSuchJobError:
        return _mark_job_cancelled(user_id, job_id)
    except (
        QueueConfigurationError,
        RedisError,
        InvalidJobOperation,
        InvalidJobOperationError,
    ):
        return requested
    return requested


def _series_payload(series: pd.Series, limit: int = 2000) -> list[dict]:
    if not isinstance(series, pd.Series) or series.empty:
        return []
    values = series.dropna().tail(limit)
    return [
        {
            "date": pd.Timestamp(timestamp).strftime("%Y-%m-%d"),
            "value": float(value),
        }
        for timestamp, value in values.items()
    ]


def _safe_number(value) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if np.isfinite(number) else None


def _complete_job(user_id: str, job_id: str, summary: dict) -> dict:
    current = get_persisted_user_job(user_id, job_id)
    if current is not None and current.get("cancel_requested"):
        _mark_job_cancelled(user_id, job_id)
        return {"cancelled": True}
    if current is None:
        raise JobNotFoundError("Job not found")
    resource_type, resource_id = persist_job_result_resource(
        user_id,
        job_id,
        current["job_type"],
        current.get("params") or {},
        summary,
    )
    update_user_job(
        user_id,
        job_id,
        {
            "status": "completed",
            "progress_percent": 100,
            "progress_phase": "Completed",
            "result_summary": summary,
            "result_resource_type": resource_type,
            "result_resource_id": resource_id,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    return summary


def _fail_job(user_id: str, job_id: str, code: str, message: str) -> None:
    update_user_job(
        user_id,
        job_id,
        {
            "status": "failed",
            "error_code": code,
            "error_message": message,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        },
    )


def _dispatch_model(params, prices, spy, vix):
    common = {
        "px": prices,
        "spy": spy,
        "vix": vix,
        "sector": None,
        "horizon": params.horizon,
        "train_window": params.train_window,
        "test_window": params.test_window,
        "max_folds": params.max_folds,
        "position_rule": getattr(params, "position_rule", "long_short"),
        "cost_bps": getattr(params, "cost_bps", 5.0),
    }
    if params.model_type == "xgb":
        return run_walkforward_xgb(**common, params=params.xgb_params)
    if params.model_type == "lstm":
        return run_walkforward_lstm(**common, params=params.lstm_params)
    return run_walkforward_ensemble(
        **common,
        weights=params.ensemble_weights,
        xgb_params=params.xgb_params,
        lstm_params=params.lstm_params,
    )


def execute_model_training(
    job_id: str,
    user_id: str,
    raw_params: dict,
    *,
    complete_job: bool = True,
) -> dict:
    params = ModelTrainingRequest.model_validate(raw_params)
    update_user_job(
        user_id,
        job_id,
        {
            "status": "running",
            "progress_percent": 5,
            "progress_phase": "Downloading market data",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "attempt": 1,
        },
    )

    try:
        prices = fetch_ohlcv(params.ticker, params.start_date, params.end_date)
        spy = fetch_close("SPY", params.start_date, params.end_date)
        vix = fetch_close("^VIX", params.start_date, params.end_date)
        update_user_job(
            user_id,
            job_id,
            {"progress_percent": 20, "progress_phase": f"Training {params.model_type}"},
        )

        result = _dispatch_model(params, prices, spy, vix)

        summary = {
            "name": params.name,
            "ticker": params.ticker,
            "model_type": params.model_type,
            "horizon": params.horizon,
            "metrics": result.get("metrics", {}),
            "feature_importance": result.get("feature_importance", [])[:20],
            "component_metrics": result.get("component_metrics"),
            "equity_curve": _series_payload(result.get("equity_curve", pd.Series(dtype="float"))),
        }
        return _complete_job(user_id, job_id, summary) if complete_job else summary
    except Exception as error:
        _fail_job(user_id, job_id, "model_training_failed", "Model training failed")
        raise error


def execute_strategy_backtest(job_id: str, user_id: str, raw_params: dict) -> dict:
    params = StrategyBacktestRequest.model_validate(raw_params)
    update_user_job(user_id, job_id, {
        "status": "running",
        "progress_percent": 5,
        "progress_phase": "Downloading market data",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "attempt": 1,
    })
    try:
        prices = fetch_ohlcv(params.ticker, params.start_date, params.end_date)
        spy = fetch_close("SPY", params.start_date, params.end_date)
        vix = fetch_close("^VIX", params.start_date, params.end_date)
        update_user_job(user_id, job_id, {
            "progress_percent": 20,
            "progress_phase": "Running walk-forward backtest",
        })
        result = _dispatch_model(params, prices, spy, vix)
        predictions = result.get("predictions", pd.DataFrame())
        probability_column = f"prob_up_{params.horizon}"
        probability = predictions.get(probability_column, pd.Series(dtype="float"))
        daily_returns = result.get("daily_returns", pd.Series(dtype="float"))
        positions = result.get("positions", pd.Series(dtype="float"))
        gross_returns = result.get("gross_returns", pd.Series(dtype="float"))
        costs = result.get("transaction_costs", pd.Series(dtype="float"))
        equity = result.get("equity_curve", pd.Series(dtype="float")) * params.initial_capital
        ledger_index = daily_returns.index
        ledger = [{
            "date": pd.Timestamp(day).strftime("%Y-%m-%d"),
            "probability": _safe_number(probability.get(day)),
            "position": _safe_number(positions.get(day)),
            "gross_return": _safe_number(gross_returns.get(day)),
            "transaction_cost": _safe_number(costs.get(day)),
            "net_return": _safe_number(daily_returns.get(day)),
            "equity": _safe_number(equity.get(day)),
        } for day in ledger_index[-2000:]]
        benchmark_prices = pd.to_numeric(prices["Close"], errors="coerce").dropna()
        benchmark = benchmark_prices / benchmark_prices.iloc[0] * params.initial_capital
        summary = {
            "name": params.name,
            "ticker": params.ticker,
            "model_type": params.model_type,
            "horizon": params.horizon,
            "position_rule": params.position_rule,
            "initial_capital": params.initial_capital,
            "metrics": result.get("metrics", {}),
            "equity_curve": _series_payload(equity),
            "benchmark_curve": _series_payload(benchmark),
            "ledger": ledger,
        }
        return _complete_job(user_id, job_id, summary)
    except Exception as error:
        _fail_job(user_id, job_id, "backtest_failed", "Strategy backtest failed")
        raise error


def execute_portfolio_run(job_id: str, user_id: str, raw_params: dict) -> dict:
    params = PortfolioRunRequest.model_validate(raw_params)
    update_user_job(user_id, job_id, {
        "status": "running",
        "progress_percent": 10,
        "progress_phase": "Running portfolio simulation",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "attempt": 1,
    })
    try:
        result = backtest_portfolio(
            tickers=params.tickers,
            start=params.start_date.isoformat(),
            end=params.end_date.isoformat() if params.end_date else None,
            signal=params.signal,
            allocator=params.allocation_method,
            rebalance=params.rebalance,
            cost_bps=params.cost_bps,
            n_quantiles=params.n_quantiles,
            long_q=params.long_quantile,
            short_q=params.short_quantile,
            benchmark=params.benchmark,
        )
        daily = result["daily_returns"]
        equity = result["equity_curve"]
        benchmark_returns = result["benchmark_returns"]
        benchmark_equity = result["bench_equity"]
        aligned = daily.to_frame("strategy").join(
            benchmark_returns.rename("benchmark"), how="inner"
        ).dropna()
        alpha_and_beta = alpha_beta(aligned["strategy"], aligned["benchmark"])
        metrics = {
            "sharpe": _safe_number(sharpe_ratio(daily)),
            "sortino": _safe_number(sortino_ratio(daily)),
            "cagr": _safe_number(cagr_from_equity(equity)),
            "max_drawdown": _safe_number(max_drawdown(equity)),
            "volatility": _safe_number(daily.std(ddof=0) * np.sqrt(252)),
            "alpha": _safe_number(alpha_and_beta["alpha"]),
            "beta": _safe_number(alpha_and_beta["beta"]),
            "turnover_annual": _safe_number(result["turnover_annual"]),
            "transaction_cost_total": _safe_number(result["transaction_costs"].sum()),
        }
        weights = result["weights"].tail(1000)
        weight_history = [{
            "date": pd.Timestamp(day).strftime("%Y-%m-%d"),
            "weights": {
                ticker: float(value)
                for ticker, value in row.items()
                if pd.notna(value)
            },
        } for day, row in weights.iterrows()]
        contributions = (result["weights"] * result["asset_returns"]).tail(126).sum()
        attribution = [
            {"ticker": ticker, "contribution": float(value)}
            for ticker, value in contributions.sort_values(ascending=False).items()
            if pd.notna(value)
        ]
        latest_weights = result["weights"].iloc[-1].fillna(0.0)
        active_returns = aligned["strategy"] - aligned["benchmark"]
        tracking_error = _safe_number(active_returns.std(ddof=0) * np.sqrt(252))
        risk_report = {
            "tail": historical_var_cvar(daily, confidence=0.95),
            "drawdown": drawdown_analysis(equity),
            "components": component_risk(
                asset_returns=result["asset_returns"],
                weights=latest_weights,
                benchmark_returns=benchmark_returns,
            ),
            "correlation": correlation_matrix(result["asset_returns"]),
            "historical_stress": historical_stress_performance(daily),
            "tracking_error": tracking_error,
        }
        summary = {
            "name": params.name,
            "tickers": params.tickers,
            "signal": params.signal,
            "allocation_method": params.allocation_method,
            "rebalance": params.rebalance,
            "metrics": metrics,
            "equity_curve": _series_payload(equity),
            "benchmark_curve": _series_payload(benchmark_equity),
            "weight_history": weight_history,
            "attribution": attribution,
            "risk": risk_report,
        }
        return _complete_job(user_id, job_id, summary)
    except Exception as error:
        _fail_job(user_id, job_id, "portfolio_run_failed", "Portfolio run failed")
        raise error


def execute_signal_analysis(job_id: str, user_id: str, raw_params: dict) -> dict:
    params = SignalAnalysisRequest.model_validate(raw_params)
    update_user_job(user_id, job_id, {
        "status": "running",
        "progress_percent": 5,
        "progress_phase": "Downloading market data",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "attempt": 1,
    })
    try:
        prices = fetch_ohlcv(params.ticker, params.start_date, params.end_date)
        spy = fetch_close("SPY", params.start_date, params.end_date)
        vix = fetch_close("^VIX", params.start_date, params.end_date)
        update_user_job(user_id, job_id, {
            "progress_percent": 30,
            "progress_phase": "Computing signal and forward returns",
        })
        factors = compute_alpha_factors(prices, spy=spy, vix=vix, sector=None)

        if params.signal.startswith("prob_up_"):
            model_horizon = params.signal.removeprefix("prob_up_")
            if model_horizon not in {"1d", "5d", "20d"}:
                raise ValueError("Probability signal horizon must be 1d, 5d, or 20d")
            model_result = run_walkforward_xgb(
                px=prices,
                spy=spy,
                vix=vix,
                horizon=model_horizon,
                df_all=factors.copy(),
            )
            predictions = model_result.get("predictions", pd.DataFrame())
            if params.signal not in predictions.columns:
                raise ValueError(f"Signal '{params.signal}' was not produced")
            factors[params.signal] = predictions[params.signal].reindex(factors.index)
        if params.signal not in factors.columns:
            raise ValueError(f"Signal '{params.signal}' is not available")

        update_user_job(user_id, job_id, {
            "progress_percent": 65,
            "progress_phase": "Computing decay and quantiles",
        })
        decay = compute_signal_decay(factors, params.signal, horizons=params.horizons)
        quantiles = quantile_time_buckets(
            factors,
            signal_col=params.signal,
            ret_col=f"target_ret_{params.return_horizon}d",
            n_quantiles=params.quantiles,
            roll=params.rolling_window,
        )
        if "error" in decay:
            raise ValueError(decay["error"])
        if "error" in quantiles:
            raise ValueError(quantiles["error"])

        decay_rows = []
        top_returns = decay.get("avg_forward_return", {}).get("top_bucket", {})
        bottom_returns = decay.get("avg_forward_return", {}).get("bottom_bucket", {})
        for horizon in params.horizons:
            key = str(horizon)
            decay_rows.append({
                "horizon": horizon,
                "pearson": decay.get("ic_pearson", {}).get(key),
                "spearman": decay.get("ic_spearman", {}).get(key),
                "top_return": top_returns.get(key),
                "bottom_return": bottom_returns.get(key),
            })
        quantile_rows = [
            {"quantile": int(float(key)), "mean_return": value}
            for key, value in quantiles.get("mean_forward_return_by_quantile", {}).items()
            if key != "nan"
        ]
        quantile_rows.sort(key=lambda row: row["quantile"])
        long_short_curve = [
            {"date": day, "value": float(value)}
            for day, value in quantiles.get("long_short_equity_curve", {}).items()
        ]
        summary = {
            "ticker": params.ticker,
            "signal": params.signal,
            "return_horizon": params.return_horizon,
            "rows_used": int(factors[params.signal].notna().sum()),
            "decay": decay_rows,
            "quantiles": quantile_rows,
            "long_short_curve": long_short_curve,
        }
        return _complete_job(user_id, job_id, summary)
    except Exception as error:
        _fail_job(user_id, job_id, "signal_analysis_failed", "Signal analysis failed")
        raise error


def execute_experiment_run(job_id: str, user_id: str, raw_params: dict) -> dict:
    payload = dict(raw_params)
    experiment_id = str(payload.pop("experiment_id"))
    summary = execute_model_training(job_id, user_id, payload, complete_job=False)
    if summary.get("cancelled"):
        return summary
    summary = {**summary, "experiment_id": experiment_id}
    return _complete_job(user_id, job_id, summary)