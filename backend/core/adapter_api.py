# core/adapter_api.py
"""
Adapter API Blueprint - Maps React frontend API expectations to existing Flask backend endpoints.
This allows the Figma-designed React UI to work with your existing research backend.
"""
from flask import Blueprint, g, request, jsonify
import pandas as pd
from time import perf_counter
from pydantic import ValidationError
from .research.factors import compute_alpha_factors, compute_pca_diagnostics
from .research.models import feature_columns
from .research.stats import sharpe_ratio, sortino_ratio, max_drawdown, cagr_from_equity
from .research.decay import compute_signal_decay
from .research.ff import fama_french_exposure
from .market_data import MarketDataError, fetch_close, fetch_ohlcv
from .database import (
    SupabaseConfigurationError,
    SupabaseServiceError,
    get_user_settings,
    create_user_experiment,
    delete_user_experiment,
    get_user_experiment,
    list_user_jobs,
    list_user_experiments,
    update_user_experiment,
    upsert_user_settings,
)
from .jobs import (
    JobNotFoundError,
    QueueConfigurationError,
    cancel_user_job,
    enqueue_model_training,
    enqueue_experiment_run,
    enqueue_portfolio_run,
    enqueue_signal_analysis,
    enqueue_strategy_backtest,
    get_user_job,
)
from .schemas import (
    FactorComputeRequest,
    ExperimentComparisonRequest,
    ExperimentRequest,
    JobListQuery,
    ModelTrainingRequest,
    PortfolioRunRequest,
    SentimentQuery,
    SignalAnalysisRequest,
    StrategyBacktestRequest,
    TickerAnalysisQuery,
    UserSettingsUpdate,
)
from .sentiment import (
    SentimentConfigurationError,
    SentimentUpstreamError,
    analyze_ticker_sentiment,
)
import yfinance as yf
import numpy as np

adapter_bp = Blueprint('adapter', __name__, url_prefix='/api')

# ========== Dashboard Endpoints ==========
@adapter_bp.route('/dashboard', methods=['GET'])
def dashboard_adapter():
    try:
        jobs = list_user_jobs(g.user_id, limit=50)
        active_statuses = {"queued", "running", "cancel_requested"}
        completed_models = sum(
            1 for job in jobs
            if job.get("job_type") == "model_train" and job.get("status") == "completed"
        )
        latest_run = next(
            (
                job for job in jobs
                if job.get("status") == "completed"
                and job.get("job_type") in {"portfolio_run", "backtest"}
                and isinstance(job.get("result_summary"), dict)
            ),
            None,
        )
        summary = latest_run.get("result_summary", {}) if latest_run else {}
        metrics = summary.get("metrics", {}) if isinstance(summary, dict) else {}
        equity_curve = summary.get("equity_curve", []) if isinstance(summary, dict) else []
        benchmark_curve = summary.get("benchmark_curve", []) if isinstance(summary, dict) else []
        benchmark_by_date = {
            point.get("date"): point.get("value")
            for point in benchmark_curve
            if isinstance(point, dict)
        }
        combined_equity = [
            {
                "date": point.get("date"),
                "strategy": point.get("value"),
                "benchmark": benchmark_by_date.get(point.get("date")),
            }
            for point in equity_curve
            if isinstance(point, dict)
        ]

        weight_history = summary.get("weight_history", []) if isinstance(summary, dict) else []
        latest_weights = weight_history[-1].get("weights", {}) if weight_history else {}
        attribution = summary.get("attribution", []) if isinstance(summary, dict) else []
        contribution_by_ticker = {
            item.get("ticker"): item.get("contribution")
            for item in attribution
            if isinstance(item, dict)
        }
        holdings = [
            {
                "ticker": ticker,
                "weight": weight,
                "contribution": contribution_by_ticker.get(ticker),
            }
            for ticker, weight in sorted(
                latest_weights.items(),
                key=lambda item: abs(item[1]),
                reverse=True,
            )
        ]

        latest_equity = equity_curve[-1].get("value") if equity_curve else None
        max_drawdown_value = metrics.get("max_drawdown", metrics.get("mdd"))
        recent_jobs = [
            {
                "id": job.get("id"),
                "job_type": job.get("job_type"),
                "status": job.get("status"),
                "progress_percent": job.get("progress_percent", 0),
                "progress_phase": job.get("progress_phase"),
                "created_at": job.get("created_at"),
                "name": (job.get("result_summary") or {}).get("name")
                    if isinstance(job.get("result_summary"), dict) else None,
            }
            for job in jobs[:10]
        ]
        return jsonify({
            "data": {
                "overview": {
                    "latest_equity": latest_equity,
                    "sharpe": metrics.get("sharpe"),
                    "max_drawdown": max_drawdown_value,
                    "active_jobs": sum(1 for job in jobs if job.get("status") in active_statuses),
                    "completed_models": completed_models,
                },
                "latest_run": {
                    "id": latest_run.get("id"),
                    "name": summary.get("name"),
                    "job_type": latest_run.get("job_type"),
                } if latest_run else None,
                "equity_curve": combined_equity,
                "holdings": holdings,
                "recent_jobs": recent_jobs,
            }
        })
    except (SupabaseConfigurationError, SupabaseServiceError) as error:
        return jsonify({"error": {"code": "persistence_error", "message": str(error)}}), 503


# ========== Ticker Intelligence (maps to existing predict) ==========
@adapter_bp.route('/tickers/<ticker>', methods=['GET'])
def get_ticker_data(ticker):
    query = {"ticker": ticker}
    for field in ("start_date", "end_date"):
        value = request.args.get(field)
        if value:
            query[field] = value
    try:
        params = TickerAnalysisQuery.model_validate(query)
    except ValidationError as error:
        return jsonify({
            "error": {
                "code": "validation_error",
                "message": "Request validation failed",
                "details": error.errors(include_url=False, include_context=False),
            }
        }), 422

    try:
        prices = fetch_ohlcv(params.ticker, params.start_date, params.end_date)
        spy = fetch_close("SPY", params.start_date, params.end_date)
        vix = fetch_close("^VIX", params.start_date, params.end_date)
        factors = compute_alpha_factors(prices, spy=spy, vix=vix, sector=None)

        close_column = "Close" if "Close" in prices.columns else "Adj Close"
        close = pd.to_numeric(prices[close_column], errors="coerce").dropna()
        current_price = float(close.iloc[-1])
        previous_price = float(close.iloc[-2]) if len(close) > 1 else current_price
        price_change = current_price - previous_price
        price_change_pct = price_change / previous_price if previous_price else 0.0

        latest = factors.iloc[-1]
        snapshot_names = ["mom_20", "vol_20", "mr_z_20", "corr_spy_20", "beta_spy_60"]
        factor_snapshot = [
            {
                "factor": name,
                "value": None if pd.isna(latest.get(name)) else float(latest[name]),
            }
            for name in snapshot_names
        ]

        momentum = pd.to_numeric(factors["mom_20"], errors="coerce")
        rolling_mean = momentum.rolling(252, min_periods=60).mean()
        rolling_std = momentum.rolling(252, min_periods=60).std(ddof=0)
        z_score = (momentum.iloc[-1] - rolling_mean.iloc[-1]) / (rolling_std.iloc[-1] + 1e-12)
        if not np.isfinite(z_score):
            z_score = 0.0
        probability = float(1.0 / (1.0 + np.exp(-np.clip(z_score, -6.0, 6.0))))
        signal_label = "LONG" if probability >= 0.55 else "SHORT" if probability <= 0.45 else "NEUTRAL"

        volatility = latest.get("vol_20")
        annualized_volatility = (
            float(volatility * np.sqrt(252))
            if volatility is not None and pd.notna(volatility)
            else 0.0
        )
        momentum_20d = latest.get("mom_20")
        history = [
            {"date": timestamp.strftime("%Y-%m-%d"), "close": float(value)}
            for timestamp, value in close.tail(252).items()
        ]
        volume = None
        if "Volume" in prices.columns:
            valid_volume = pd.to_numeric(prices["Volume"], errors="coerce").dropna()
            if not valid_volume.empty:
                volume = int(valid_volume.iloc[-1])

        return jsonify({
            "data": {
                "ticker": params.ticker,
                "as_of": close.index[-1].strftime("%Y-%m-%d"),
                "current_price": current_price,
                "price_change": price_change,
                "price_change_pct": price_change_pct,
                "volume": volume,
                "history": history,
                "metrics": {
                    "annualized_volatility": annualized_volatility,
                    "momentum_20d": 0.0 if pd.isna(momentum_20d) else float(momentum_20d),
                },
                "baseline_signal": {
                    "model": "momentum_baseline",
                    "label": signal_label,
                    "probability": probability,
                },
                "factor_snapshot": factor_snapshot,
            }
        })
    except MarketDataError as error:
        return jsonify({
            "error": {
                "code": "market_data_unavailable",
                "message": str(error),
            }
        }), 503

# ========== Factor Explorer (maps to /api/factors) ==========
@adapter_bp.route('/factors/compute', methods=['POST'])
def compute_factors_adapter():
    started_at = perf_counter()
    try:
        params = FactorComputeRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError as error:
        return jsonify({
            "error": {
                "code": "validation_error",
                "message": "Request validation failed",
                "details": error.errors(include_url=False, include_context=False),
            }
        }), 422

    try:
        prices = fetch_ohlcv(params.ticker, params.start_date, params.end_date)
        spy = fetch_close("SPY", params.start_date, params.end_date)
        vix = fetch_close("^VIX", params.start_date, params.end_date)
        factors = compute_alpha_factors(prices, spy=spy, vix=vix, sector=None)
        available = feature_columns(factors)
        columns = params.factors or available
        unknown = [factor for factor in columns if factor not in available]
        if unknown:
            return jsonify({
                "error": {
                    "code": "unknown_factor",
                    "message": "One or more factors are not available",
                    "details": {"factors": unknown},
                }
            }), 422

        analysis = factors[columns].replace([np.inf, -np.inf], np.nan)
        preview = analysis.tail(params.rows)
        records = []
        for timestamp, row in preview.iterrows():
            record = {"date": pd.Timestamp(timestamp).strftime("%Y-%m-%d")}
            record.update({
                column: None if pd.isna(row[column]) else float(row[column])
                for column in columns
            })
            records.append(record)

        correlation_frame = analysis.corr().reindex(index=columns, columns=columns)
        correlation = {
            "labels": columns,
            "matrix": [
                [None if pd.isna(value) else float(value) for value in correlation_frame.loc[label]]
                for label in columns
            ],
        }
        pca = (
            compute_pca_diagnostics(factors, columns, n_components=8, topk_loadings=8)
            if params.include_pca
            else None
        )

        return jsonify({
            "data": {
                "ticker": params.ticker,
                "columns": columns,
                "records": records,
                "rows_returned": len(records),
                "available_factors": available,
                "date_range": {
                    "start": records[0]["date"] if records else None,
                    "end": records[-1]["date"] if records else None,
                },
                "pca": pca,
                "correlation": correlation,
            },
            "meta": {
                "duration_ms": round((perf_counter() - started_at) * 1000, 2),
                "factor_count": len(columns),
            },
        })
    except MarketDataError as error:
        return jsonify({
            "error": {
                "code": "market_data_unavailable",
                "message": str(error),
            }
        }), 503

@adapter_bp.route('/factors/pca', methods=['POST'])
def pca_adapter():
    """PCA diagnostics - wraps existing PCA compute"""
    data = request.get_json() or {}
    ticker = data.get('ticker', 'AAPL')
    start = data.get('start', '2015-01-01')
    
    try:
        px_raw = yf.download(ticker, start=start, auto_adjust=True, progress=False)
        if px_raw.empty:
            return jsonify({"error": f"No data for {ticker}"}), 400
        
        if isinstance(px_raw.columns, pd.MultiIndex):
            px_raw.columns = px_raw.columns.get_level_values(0)
        
        spy = yf.download("SPY", start=start, auto_adjust=True, progress=False)['Close']
        vix = yf.download("^VIX", start=start, auto_adjust=True, progress=False)['Close']
        
        df = compute_alpha_factors(px_raw, spy=spy, vix=vix, sector=None)
        cols = feature_columns(df)
        
        pca_result = compute_pca_diagnostics(df, cols, n_components=8, topk_loadings=8)
        
        return jsonify(pca_result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ========== Model Lab (maps to existing experiment endpoints) ==========
@adapter_bp.route('/models/train', methods=['POST'])
def train_model_adapter():
    try:
        params = ModelTrainingRequest.model_validate(request.get_json(silent=True) or {})
        job = enqueue_model_training(
            g.user_id,
            params.model_dump(mode="json"),
            request.headers.get("Idempotency-Key"),
        )
        return jsonify({"data": job}), 202
    except ValidationError as error:
        return jsonify({
            "error": {
                "code": "validation_error",
                "message": "Request validation failed",
                "details": error.errors(include_url=False, include_context=False),
            }
        }), 422
    except QueueConfigurationError as error:
        return jsonify({
            "error": {"code": "queue_not_configured", "message": str(error)}
        }), 503
    except (SupabaseConfigurationError, SupabaseServiceError) as error:
        return jsonify({
            "error": {"code": "persistence_error", "message": str(error)}
        }), 503


@adapter_bp.route('/jobs/<job_id>', methods=['GET'])
def job_status_adapter(job_id):
    try:
        return jsonify({"data": get_user_job(g.user_id, job_id)})
    except JobNotFoundError:
        return jsonify({
            "error": {"code": "job_not_found", "message": "Job not found"}
        }), 404
    except (SupabaseConfigurationError, SupabaseServiceError) as error:
        return jsonify({
            "error": {"code": "persistence_error", "message": str(error)}
        }), 503


@adapter_bp.route('/jobs', methods=['GET'])
def list_jobs_adapter():
    try:
        params = JobListQuery.model_validate({"limit": request.args.get("limit", 20)})
        return jsonify({"data": list_user_jobs(g.user_id, params.limit)})
    except ValidationError as error:
        return jsonify({
            "error": {
                "code": "validation_error",
                "message": "Request validation failed",
                "details": error.errors(include_url=False, include_context=False),
            }
        }), 422
    except (SupabaseConfigurationError, SupabaseServiceError) as error:
        return jsonify({"error": {"code": "persistence_error", "message": str(error)}}), 503


@adapter_bp.route('/jobs/<job_id>/cancel', methods=['POST'])
def cancel_job_adapter(job_id):
    try:
        return jsonify({"data": cancel_user_job(g.user_id, job_id)})
    except JobNotFoundError:
        return jsonify({
            "error": {"code": "job_not_found", "message": "Job not found"}
        }), 404
    except (SupabaseConfigurationError, SupabaseServiceError) as error:
        return jsonify({
            "error": {"code": "persistence_error", "message": str(error)}
        }), 503


def _enqueue_response(schema, enqueue_function):
    try:
        params = schema.model_validate(request.get_json(silent=True) or {})
        job = enqueue_function(
            g.user_id,
            params.model_dump(mode="json"),
            request.headers.get("Idempotency-Key"),
        )
        return jsonify({"data": job}), 202
    except ValidationError as error:
        return jsonify({
            "error": {
                "code": "validation_error",
                "message": "Request validation failed",
                "details": error.errors(include_url=False, include_context=False),
            }
        }), 422
    except QueueConfigurationError as error:
        return jsonify({"error": {"code": "queue_not_configured", "message": str(error)}}), 503
    except (SupabaseConfigurationError, SupabaseServiceError) as error:
        return jsonify({"error": {"code": "persistence_error", "message": str(error)}}), 503


@adapter_bp.route('/backtests', methods=['POST'])
def create_backtest_adapter():
    return _enqueue_response(StrategyBacktestRequest, enqueue_strategy_backtest)


@adapter_bp.route('/portfolio-runs', methods=['POST'])
def create_portfolio_run_adapter():
    return _enqueue_response(PortfolioRunRequest, enqueue_portfolio_run)


@adapter_bp.route('/signal-analyses', methods=['POST'])
def create_signal_analysis_adapter():
    return _enqueue_response(SignalAnalysisRequest, enqueue_signal_analysis)


def _experiment_values(params: ExperimentRequest) -> dict:
    payload = params.model_dump(mode="json")
    return {
        "name": payload.pop("name"),
        "description": payload.pop("description"),
        "ticker": payload.pop("ticker"),
        "model_type": payload.pop("model_type"),
        "config": payload,
    }


@adapter_bp.route('/experiments', methods=['GET', 'POST'])
def experiments_adapter():
    try:
        if request.method == 'GET':
            return jsonify({"data": list_user_experiments(g.user_id)})
        params = ExperimentRequest.model_validate(request.get_json(silent=True) or {})
        return jsonify({"data": create_user_experiment(g.user_id, _experiment_values(params))}), 201
    except ValidationError as error:
        return jsonify({
            "error": {
                "code": "validation_error",
                "message": "Request validation failed",
                "details": error.errors(include_url=False, include_context=False),
            }
        }), 422
    except (SupabaseConfigurationError, SupabaseServiceError) as error:
        return jsonify({"error": {"code": "persistence_error", "message": str(error)}}), 503


@adapter_bp.route('/experiments/<experiment_id>', methods=['GET', 'PUT', 'DELETE'])
def experiment_detail_adapter(experiment_id):
    try:
        if request.method == 'GET':
            experiment = get_user_experiment(g.user_id, experiment_id)
            if experiment is None:
                return jsonify({"error": {"code": "experiment_not_found", "message": "Experiment not found"}}), 404
            return jsonify({"data": experiment})
        if request.method == 'DELETE':
            if not delete_user_experiment(g.user_id, experiment_id):
                return jsonify({"error": {"code": "experiment_not_found", "message": "Experiment not found"}}), 404
            return '', 204
        params = ExperimentRequest.model_validate(request.get_json(silent=True) or {})
        experiment = update_user_experiment(g.user_id, experiment_id, _experiment_values(params))
        if experiment is None:
            return jsonify({"error": {"code": "experiment_not_found", "message": "Experiment not found"}}), 404
        return jsonify({"data": experiment})
    except ValidationError as error:
        return jsonify({
            "error": {
                "code": "validation_error",
                "message": "Request validation failed",
                "details": error.errors(include_url=False, include_context=False),
            }
        }), 422
    except (SupabaseConfigurationError, SupabaseServiceError) as error:
        return jsonify({"error": {"code": "persistence_error", "message": str(error)}}), 503


@adapter_bp.route('/experiments/<experiment_id>/runs', methods=['POST'])
def run_saved_experiment_adapter(experiment_id):
    try:
        experiment = get_user_experiment(g.user_id, experiment_id)
        if experiment is None:
            return jsonify({"error": {"code": "experiment_not_found", "message": "Experiment not found"}}), 404
        params = {
            "name": experiment["name"],
            "ticker": experiment["ticker"],
            "model_type": experiment["model_type"],
            **experiment.get("config", {}),
        }
        job = enqueue_experiment_run(
            g.user_id,
            experiment_id,
            params,
            request.headers.get("Idempotency-Key"),
        )
        return jsonify({"data": job}), 202
    except QueueConfigurationError as error:
        return jsonify({"error": {"code": "queue_not_configured", "message": str(error)}}), 503
    except (SupabaseConfigurationError, SupabaseServiceError) as error:
        return jsonify({"error": {"code": "persistence_error", "message": str(error)}}), 503


@adapter_bp.route('/experiment-runs/compare', methods=['POST'])
def compare_experiment_runs_adapter():
    try:
        params = ExperimentComparisonRequest.model_validate(request.get_json(silent=True) or {})
        runs = []
        for job_id in params.job_ids:
            job = get_user_job(g.user_id, job_id)
            if job.get("job_type") != "experiment_run" or job.get("status") != "completed":
                return jsonify({"error": {"code": "invalid_experiment_run", "message": "Only completed experiment runs can be compared"}}), 422
            summary = job.get("result_summary") or {}
            runs.append({
                "id": job["id"],
                "experiment_id": summary.get("experiment_id"),
                "name": summary.get("name"),
                "ticker": summary.get("ticker"),
                "model_type": summary.get("model_type"),
                "horizon": summary.get("horizon"),
                "metrics": summary.get("metrics", {}),
            })
        return jsonify({"data": runs})
    except ValidationError as error:
        return jsonify({"error": {"code": "validation_error", "message": "Request validation failed", "details": error.errors(include_url=False, include_context=False)}}), 422
    except JobNotFoundError:
        return jsonify({"error": {"code": "job_not_found", "message": "Job not found"}}), 404
    except (SupabaseConfigurationError, SupabaseServiceError) as error:
        return jsonify({"error": {"code": "persistence_error", "message": str(error)}}), 503

# ========== Experiment Manager (maps to /api/experiment/run) ==========
@adapter_bp.route('/experiments/run', methods=['POST'])
def run_experiment_adapter():
    """Run experiment - direct passthrough to existing endpoint"""
    # This can directly use the existing /api/experiment/run implementation
    from .research.api import experiment_run
    return experiment_run()

# ========== Signal Diagnostics (maps to /api/decay & /api/quantiles) ==========
@adapter_bp.route('/signals/decay', methods=['POST'])
def signal_decay_adapter():
    """Signal decay analysis"""
    data = request.get_json() or {}
    ticker = data.get('ticker', 'AAPL')
    start = data.get('start', '2015-01-01')
    horizons = data.get('horizons', [1, 3, 5, 10, 20])
    
    try:
        from .research.api import decay_endpoint
        # Reuse existing implementation by constructing proper request
        return decay_endpoint()
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ========== Risk & Performance (maps to /api/risk) ==========
@adapter_bp.route('/risk/metrics', methods=['GET'])
def risk_metrics_adapter():
    """Risk metrics for a portfolio or ticker"""
    ticker = request.args.get('ticker', 'AAPL')
    start = request.args.get('start', '2015-01-01')
    
    try:
        # Quick demo using single ticker
        px_raw = yf.download(ticker, start=start, auto_adjust=True, progress=False)
        if px_raw.empty:
            return jsonify({"error": f"No data for {ticker}"}), 400
        
        if isinstance(px_raw.columns, pd.MultiIndex):
            px = px_raw['Close']
        else:
            px = px_raw['Close'] if 'Close' in px_raw else px_raw['Adj Close']
        
        returns = np.log(px).diff().dropna()
        equity = returns.cumsum().apply(np.exp)
        
        return jsonify({
            "sharpe": sharpe_ratio(returns),
            "sortino": sortino_ratio(returns),
            "max_drawdown": max_drawdown(equity),
            "cagr": cagr_from_equity(equity),
            "volatility": float(returns.std() * np.sqrt(252)),
            "ticker": ticker
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ========== Sentiment Analyzer (maps to /analyze) ==========
@adapter_bp.route('/sentiment/<ticker>', methods=['GET'])
def get_ticker_sentiment(ticker):
    query = {"ticker": ticker}
    for field in ("start_date", "end_date", "limit"):
        value = request.args.get(field)
        if value:
            query[field] = value

    try:
        params = SentimentQuery.model_validate(query)
    except ValidationError as error:
        return jsonify({
            "error": {
                "code": "validation_error",
                "message": "Request validation failed",
                "details": error.errors(include_url=False, include_context=False),
            }
        }), 422

    try:
        result = analyze_ticker_sentiment(
            ticker=params.ticker,
            start_date=params.start_date,
            end_date=params.end_date,
            limit=params.limit,
        )
        return jsonify({"data": result})
    except SentimentConfigurationError as error:
        return jsonify({
            "error": {
                "code": "sentiment_not_configured",
                "message": str(error),
            }
        }), 503
    except SentimentUpstreamError as error:
        return jsonify({
            "error": {
                "code": "sentiment_provider_error",
                "message": str(error),
            }
        }), 502

# ========== Settings ==========
@adapter_bp.route('/settings', methods=['GET', 'PUT'])
def settings_adapter():
    try:
        if request.method == 'GET':
            return jsonify({"data": get_user_settings(g.user_id)})

        params = UserSettingsUpdate.model_validate(request.get_json(silent=True) or {})
        saved = upsert_user_settings(g.user_id, params.model_dump())
        return jsonify({"data": saved})
    except ValidationError as error:
        return jsonify({
            "error": {
                "code": "validation_error",
                "message": "Request validation failed",
                "details": error.errors(include_url=False, include_context=False),
            }
        }), 422
    except SupabaseConfigurationError as error:
        return jsonify({
            "error": {
                "code": "persistence_not_configured",
                "message": str(error),
            }
        }), 503
    except SupabaseServiceError:
        return jsonify({
            "error": {
                "code": "persistence_error",
                "message": "Unable to access user settings",
            }
        }), 502
