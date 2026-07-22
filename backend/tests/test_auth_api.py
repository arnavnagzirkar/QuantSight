import pytest
from flask import Flask

from core import auth_api
from core import database


@pytest.fixture
def client():
    app = Flask(__name__)
    app.config.update(TESTING=True)
    app.register_blueprint(auth_api.auth_bp)
    return app.test_client()


def test_username_password_sign_in_never_exposes_resolved_email(client, monkeypatch):
    monkeypatch.setattr(auth_api, "resolve_username_email", lambda username: "owner@example.com")
    monkeypatch.setattr(
        auth_api,
        "request_password_session",
        lambda email, password: {
            "access_token": "access-token",
            "refresh_token": "refresh-token",
            "expires_in": 3600,
            "token_type": "bearer",
            "user": {"id": "user-id", "email": email},
        },
    )

    response = client.post(
        "/api/auth/password-sign-in",
        json={"identifier": "researcher", "password": "correct-password"},
    )

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["access_token"] == "access-token"
    assert "email" not in payload
    assert "user" not in payload


def test_unknown_username_returns_generic_invalid_credentials(client, monkeypatch):
    monkeypatch.setattr(auth_api, "resolve_username_email", lambda username: None)
    monkeypatch.setattr(
        auth_api,
        "request_password_session",
        lambda email, password: (_ for _ in ()).throw(auth_api.InvalidCredentialsError()),
    )

    response = client.post(
        "/api/auth/password-sign-in",
        json={"identifier": "missing_user", "password": "wrong-password"},
    )

    assert response.status_code == 401
    assert response.get_json()["error"] == {
        "code": "invalid_credentials",
        "message": "Invalid username/email or password",
    }


def test_password_session_accepts_vite_public_environment_aliases(monkeypatch):
    observed = {}

    class FakeResponse:
        status_code = 200
        ok = True

        @staticmethod
        def json():
            return {
                "access_token": "access-token",
                "refresh_token": "refresh-token",
            }

    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)
    monkeypatch.setenv("VITE_SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("VITE_SUPABASE_ANON_KEY", "public-anon-key")

    def fake_post(url, **kwargs):
        observed.update(url=url, **kwargs)
        return FakeResponse()

    monkeypatch.setattr(database.requests, "post", fake_post)

    session = database.request_password_session("owner@example.com", "password")

    assert session["access_token"] == "access-token"
    assert observed["url"] == "https://example.supabase.co/auth/v1/token"
    assert observed["headers"]["apikey"] == "public-anon-key"


@pytest.mark.parametrize(
    ("exists", "available"),
    [(False, True), (True, False)],
)
def test_username_availability(client, monkeypatch, exists, available):
    monkeypatch.setattr(auth_api, "username_exists", lambda username: exists)

    response = client.get(
        "/api/auth/username-availability",
        query_string={"username": "researcher"},
    )

    assert response.status_code == 200
    assert response.get_json()["data"] == {
        "username": "researcher",
        "available": available,
    }