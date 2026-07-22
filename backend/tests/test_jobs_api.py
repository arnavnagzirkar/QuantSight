import pytest
from flask import Flask, g

from core import adapter_api


USER_ID = "8a31c20d-e20c-4b78-adcb-6b9e97b5db0d"
JOB_ID = "d2b7e6be-7a6a-4bf0-ae0c-a13fb3f71cf2"


@pytest.fixture
def client():
    app = Flask(__name__)
    app.config.update(TESTING=True)
    app.register_blueprint(adapter_api.adapter_bp)

    @app.before_request
    def set_user():
        g.user_id = USER_ID

    return app.test_client()


def valid_model_request():
    return {
        "name": "AAPL Ensemble",
        "ticker": "AAPL",
        "model_type": "ensemble",
        "horizon": "5d",
        "start_date": "2020-01-01",
        "end_date": "2026-07-20",
        "train_window": 500,
        "test_window": 42,
        "max_folds": 8,
        "xgb_params": {"n_estimators": 100, "max_depth": 4},
        "lstm_params": {"sequence_length": 20, "hidden_size": 32, "max_epochs": 10},
        "ensemble_weights": {"xgb": 0.6, "lstm": 0.4},
    }


def test_model_training_endpoint_enqueues_user_owned_job(client, monkeypatch):
    observed = {}

    def fake_enqueue(user_id, params, idempotency_key=None):
        observed.update({
            "user_id": user_id,
            "params": params,
            "idempotency_key": idempotency_key,
        })
        return {
            "id": JOB_ID,
            "job_type": "model_train",
            "status": "queued",
            "progress_percent": 0,
            "progress_phase": "Queued",
        }

    monkeypatch.setattr(adapter_api, "enqueue_model_training", fake_enqueue)

    response = client.post(
        "/api/models/train",
        json=valid_model_request(),
        headers={"Idempotency-Key": "model-aapl-1"},
    )

    assert response.status_code == 202
    assert response.get_json()["data"]["id"] == JOB_ID
    assert observed["user_id"] == USER_ID
    assert observed["params"]["ticker"] == "AAPL"
    assert observed["idempotency_key"] == "model-aapl-1"


def test_model_training_rejects_invalid_ensemble_weights(client):
    payload = valid_model_request()
    payload["ensemble_weights"] = {"xgb": 0.8, "lstm": 0.8}

    response = client.post("/api/models/train", json=payload)

    assert response.status_code == 422
    assert response.get_json()["error"]["code"] == "validation_error"


def test_job_status_is_scoped_to_authenticated_user(client, monkeypatch):
    observed = {}

    def fake_get(user_id, job_id):
        observed.update({"user_id": user_id, "job_id": job_id})
        return {"id": job_id, "status": "running", "progress_percent": 35}

    monkeypatch.setattr(adapter_api, "get_user_job", fake_get)

    response = client.get(f"/api/jobs/{JOB_ID}")

    assert response.status_code == 200
    assert response.get_json()["data"]["status"] == "running"
    assert observed == {"user_id": USER_ID, "job_id": JOB_ID}


def test_job_cancel_is_scoped_to_authenticated_user(client, monkeypatch):
    observed = {}

    def fake_cancel(user_id, job_id):
        observed.update({"user_id": user_id, "job_id": job_id})
        return {"id": job_id, "status": "cancel_requested", "cancel_requested": True}

    monkeypatch.setattr(adapter_api, "cancel_user_job", fake_cancel)

    response = client.post(f"/api/jobs/{JOB_ID}/cancel")

    assert response.status_code == 200
    assert response.get_json()["data"]["cancel_requested"] is True
    assert observed == {"user_id": USER_ID, "job_id": JOB_ID}