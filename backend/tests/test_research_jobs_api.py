import pytest
from flask import Flask, g

from core import adapter_api


USER_ID = "8a31c20d-e20c-4b78-adcb-6b9e97b5db0d"


@pytest.fixture
def client():
    app = Flask(__name__)
    app.config.update(TESTING=True)
    app.register_blueprint(adapter_api.adapter_bp)

    @app.before_request
    def set_user():
        g.user_id = USER_ID

    return app.test_client()


def test_strategy_backtest_enqueues_supported_configuration(client, monkeypatch):
    observed = {}

    def fake_enqueue(user_id, params, idempotency_key=None):
        observed.update(user_id=user_id, params=params, idempotency_key=idempotency_key)
        return {"id": "backtest-job", "status": "queued", "job_type": "backtest"}

    monkeypatch.setattr(adapter_api, "enqueue_strategy_backtest", fake_enqueue)
    response = client.post(
        "/api/backtests",
        json={
            "name": "AAPL Long Only",
            "ticker": "AAPL",
            "model_type": "lstm",
            "horizon": "5d",
            "position_rule": "long_only",
            "start_date": "2020-01-01",
            "end_date": "2026-07-20",
            "initial_capital": 100000,
            "cost_bps": 5,
            "train_window": 500,
            "test_window": 42,
            "max_folds": 8,
            "xgb_params": {},
            "lstm_params": {"sequence_length": 20, "max_epochs": 10},
            "ensemble_weights": {"xgb": 0.5, "lstm": 0.5},
        },
    )

    assert response.status_code == 202
    assert observed["user_id"] == USER_ID
    assert observed["params"]["position_rule"] == "long_only"


def test_strategy_backtest_rejects_unimplemented_pairs_trading(client):
    response = client.post(
        "/api/backtests",
        json={
            "name": "Pairs",
            "ticker": "AAPL",
            "position_rule": "pairs_trading",
        },
    )

    assert response.status_code == 422
    assert response.get_json()["error"]["code"] == "validation_error"


def test_portfolio_run_enqueues_existing_allocation_engine(client, monkeypatch):
    observed = {}

    def fake_enqueue(user_id, params, idempotency_key=None):
        observed.update(user_id=user_id, params=params, idempotency_key=idempotency_key)
        return {"id": "portfolio-job", "status": "queued", "job_type": "portfolio_run"}

    monkeypatch.setattr(adapter_api, "enqueue_portfolio_run", fake_enqueue)
    response = client.post(
        "/api/portfolio-runs",
        json={
            "name": "Core Momentum",
            "tickers": ["aapl", "msft", "AAPL"],
            "start_date": "2022-01-01",
            "end_date": "2026-07-20",
            "signal": "mom_20",
            "allocation_method": "risk_parity",
            "rebalance": "weekly",
            "cost_bps": 5,
            "benchmark": "SPY",
        },
    )

    assert response.status_code == 202
    assert observed["user_id"] == USER_ID
    assert observed["params"]["tickers"] == ["AAPL", "MSFT"]
    assert observed["params"]["allocation_method"] == "risk_parity"