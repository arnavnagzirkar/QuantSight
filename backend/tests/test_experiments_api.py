import pytest
from flask import Flask, g

from core import adapter_api


USER_ID = "8a31c20d-e20c-4b78-adcb-6b9e97b5db0d"
EXPERIMENT_ID = "5c4d5bde-d25a-423d-8ec8-c124b9436466"


@pytest.fixture
def client():
    app = Flask(__name__)
    app.config.update(TESTING=True)
    app.register_blueprint(adapter_api.adapter_bp)

    @app.before_request
    def set_user():
        g.user_id = USER_ID

    return app.test_client()


def experiment_payload():
    return {
        "name": "Momentum Ensemble",
        "description": "Compare tree and sequence components",
        "ticker": "aapl",
        "model_type": "ensemble",
        "horizon": "5d",
        "start_date": "2020-01-01",
        "end_date": "2026-07-20",
        "train_window": 500,
        "test_window": 42,
        "max_folds": 8,
        "xgb_params": {"n_estimators": 100},
        "lstm_params": {"sequence_length": 20, "max_epochs": 10},
        "ensemble_weights": {"xgb": 0.6, "lstm": 0.4},
    }


def test_create_experiment_is_user_scoped(client, monkeypatch):
    observed = {}

    def fake_create(user_id, values):
        observed.update(user_id=user_id, values=values)
        return {"id": EXPERIMENT_ID, "user_id": user_id, **values}

    monkeypatch.setattr(adapter_api, "create_user_experiment", fake_create)
    response = client.post("/api/experiments", json=experiment_payload())

    assert response.status_code == 201
    assert observed["user_id"] == USER_ID
    assert observed["values"]["ticker"] == "AAPL"
    assert observed["values"]["config"]["horizon"] == "5d"


def test_list_experiments_is_user_scoped(client, monkeypatch):
    observed = {}

    def fake_list(user_id):
        observed["user_id"] = user_id
        return [{"id": EXPERIMENT_ID, "name": "Momentum Ensemble"}]

    monkeypatch.setattr(adapter_api, "list_user_experiments", fake_list)
    response = client.get("/api/experiments")

    assert response.status_code == 200
    assert observed["user_id"] == USER_ID
    assert response.get_json()["data"][0]["id"] == EXPERIMENT_ID


def test_run_experiment_uses_owned_saved_configuration(client, monkeypatch):
    observed = {}
    stored = {
        "id": EXPERIMENT_ID,
        "name": "Momentum Ensemble",
        "ticker": "AAPL",
        "model_type": "ensemble",
        "config": {
            "horizon": "5d",
            "start_date": "2020-01-01",
            "end_date": "2026-07-20",
            "train_window": 500,
            "test_window": 42,
            "max_folds": 8,
            "xgb_params": {},
            "lstm_params": {},
            "ensemble_weights": {"xgb": 0.5, "lstm": 0.5},
        },
    }
    monkeypatch.setattr(adapter_api, "get_user_experiment", lambda user_id, experiment_id: stored)

    def fake_enqueue(user_id, experiment_id, params, idempotency_key=None):
        observed.update(user_id=user_id, experiment_id=experiment_id, params=params)
        return {"id": "experiment-job", "status": "queued", "job_type": "experiment_run"}

    monkeypatch.setattr(adapter_api, "enqueue_experiment_run", fake_enqueue)
    response = client.post(f"/api/experiments/{EXPERIMENT_ID}/runs")

    assert response.status_code == 202
    assert observed["user_id"] == USER_ID
    assert observed["experiment_id"] == EXPERIMENT_ID
    assert observed["params"]["name"] == "Momentum Ensemble"
    assert observed["params"]["model_type"] == "ensemble"


def test_delete_experiment_is_user_scoped(client, monkeypatch):
    observed = {}

    def fake_delete(user_id, experiment_id):
        observed.update(user_id=user_id, experiment_id=experiment_id)
        return True

    monkeypatch.setattr(adapter_api, "delete_user_experiment", fake_delete)
    response = client.delete(f"/api/experiments/{EXPERIMENT_ID}")

    assert response.status_code == 204
    assert observed == {"user_id": USER_ID, "experiment_id": EXPERIMENT_ID}