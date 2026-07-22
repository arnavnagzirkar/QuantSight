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


def test_signal_analysis_enqueues_combined_decay_and_quantiles(client, monkeypatch):
    observed = {}

    def fake_enqueue(user_id, params, idempotency_key=None):
        observed.update(user_id=user_id, params=params, idempotency_key=idempotency_key)
        return {"id": "signal-job", "status": "queued", "job_type": "signal_analysis"}

    monkeypatch.setattr(adapter_api, "enqueue_signal_analysis", fake_enqueue)
    response = client.post(
        "/api/signal-analyses",
        json={
            "ticker": "aapl",
            "start_date": "2020-01-01",
            "end_date": "2026-07-20",
            "signal": "mom_20",
            "horizons": [1, 3, 5, 10, 20],
            "return_horizon": 5,
            "quantiles": 5,
            "rolling_window": 252,
        },
    )

    assert response.status_code == 202
    assert observed["user_id"] == USER_ID
    assert observed["params"]["ticker"] == "AAPL"
    assert observed["params"]["horizons"] == [1, 3, 5, 10, 20]


def test_signal_analysis_rejects_unsupported_return_horizon(client):
    response = client.post(
        "/api/signal-analyses",
        json={"ticker": "AAPL", "signal": "mom_20", "return_horizon": 7},
    )

    assert response.status_code == 422