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


def test_dashboard_returns_empty_state_for_new_user(client, monkeypatch):
    monkeypatch.setattr(adapter_api, "list_user_jobs", lambda user_id, limit=50: [])

    response = client.get("/api/dashboard")

    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["overview"] == {
        "latest_equity": None,
        "sharpe": None,
        "max_drawdown": None,
        "active_jobs": 0,
        "completed_models": 0,
    }
    assert data["equity_curve"] == []
    assert data["holdings"] == []
    assert data["recent_jobs"] == []


def test_dashboard_aggregates_latest_portfolio_and_jobs(client, monkeypatch):
    jobs = [
        {
            "id": "active-job",
            "job_type": "model_train",
            "status": "running",
            "progress_percent": 30,
            "created_at": "2026-07-21T12:00:00Z",
            "result_summary": None,
        },
        {
            "id": "portfolio-job",
            "job_type": "portfolio_run",
            "status": "completed",
            "progress_percent": 100,
            "created_at": "2026-07-20T12:00:00Z",
            "result_summary": {
                "name": "Core Portfolio",
                "metrics": {"sharpe": 1.4, "max_drawdown": -0.12},
                "equity_curve": [{"date": "2026-07-18", "value": 1.0}, {"date": "2026-07-19", "value": 1.1}],
                "benchmark_curve": [{"date": "2026-07-18", "value": 1.0}, {"date": "2026-07-19", "value": 1.05}],
                "weight_history": [{"date": "2026-07-19", "weights": {"AAPL": 0.6, "MSFT": 0.4}}],
                "attribution": [{"ticker": "AAPL", "contribution": 0.08}, {"ticker": "MSFT", "contribution": 0.02}],
            },
        },
        {
            "id": "model-job",
            "job_type": "model_train",
            "status": "completed",
            "progress_percent": 100,
            "created_at": "2026-07-19T12:00:00Z",
            "result_summary": {"name": "AAPL Model"},
        },
    ]
    monkeypatch.setattr(adapter_api, "list_user_jobs", lambda user_id, limit=50: jobs)

    response = client.get("/api/dashboard")

    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["overview"]["latest_equity"] == pytest.approx(1.1)
    assert data["overview"]["sharpe"] == pytest.approx(1.4)
    assert data["overview"]["active_jobs"] == 1
    assert data["overview"]["completed_models"] == 1
    assert data["holdings"] == [
        {"ticker": "AAPL", "weight": 0.6, "contribution": 0.08},
        {"ticker": "MSFT", "weight": 0.4, "contribution": 0.02},
    ]


def test_job_list_endpoint_is_user_scoped(client, monkeypatch):
    observed = {}

    def fake_list(user_id, limit=50):
        observed.update(user_id=user_id, limit=limit)
        return [{"id": "job-1", "status": "completed"}]

    monkeypatch.setattr(adapter_api, "list_user_jobs", fake_list)

    response = client.get("/api/jobs?limit=5")

    assert response.status_code == 200
    assert response.get_json()["data"][0]["id"] == "job-1"
    assert observed == {"user_id": USER_ID, "limit": 5}