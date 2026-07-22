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


def test_get_settings_returns_user_owned_preferences(client, monkeypatch):
    expected = {
        "theme": "system",
        "timezone": "UTC",
        "default_tickers": ["AAPL", "MSFT"],
        "default_model_type": "xgb",
        "default_train_window": 750,
        "default_test_window": 63,
        "default_max_folds": 10,
        "notify_job_complete": True,
    }
    observed = {}

    def fake_get(user_id):
        observed["user_id"] = user_id
        return expected

    monkeypatch.setattr(adapter_api, "get_user_settings", fake_get)

    response = client.get("/api/settings")

    assert response.status_code == 200
    assert response.get_json()["data"] == expected
    assert observed["user_id"] == USER_ID


def test_update_settings_validates_and_scopes_payload(client, monkeypatch):
    observed = {}

    def fake_upsert(user_id, values):
        observed.update({"user_id": user_id, "values": values})
        return values

    monkeypatch.setattr(adapter_api, "upsert_user_settings", fake_upsert)
    payload = {
        "theme": "dark",
        "timezone": "America/New_York",
        "default_tickers": ["aapl", "msft", "AAPL"],
        "default_model_type": "ensemble",
        "default_train_window": 500,
        "default_test_window": 42,
        "default_max_folds": 8,
        "notify_job_complete": False,
    }

    response = client.put("/api/settings", json=payload)

    assert response.status_code == 200
    assert observed["user_id"] == USER_ID
    assert observed["values"]["default_tickers"] == ["AAPL", "MSFT"]
    assert response.get_json()["data"]["default_model_type"] == "ensemble"


def test_update_settings_rejects_unsupported_fields(client):
    response = client.put("/api/settings", json={"gpu_acceleration": True})

    assert response.status_code == 422
    assert response.get_json()["error"]["code"] == "validation_error"