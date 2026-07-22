from datetime import datetime, timedelta, timezone

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from core import auth


@pytest.fixture
def signing_material():
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_jwk = jwt.algorithms.RSAAlgorithm.to_jwk(private_key.public_key(), as_dict=True)
    public_jwk.update({"kid": "test-key", "alg": "RS256", "use": "sig"})
    return private_key, {"keys": [public_jwk]}


def make_token(private_key, **overrides):
    now = datetime.now(timezone.utc)
    claims = {
        "sub": "8a31c20d-e20c-4b78-adcb-6b9e97b5db0d",
        "aud": "authenticated",
        "role": "authenticated",
        "iss": "https://example.supabase.co/auth/v1",
        "iat": now,
        "exp": now + timedelta(minutes=10),
        "email": "researcher@example.com",
    }
    claims.update(overrides)
    return jwt.encode(claims, private_key, algorithm="RS256", headers={"kid": "test-key"})


def test_verifier_accepts_valid_supabase_access_token(signing_material):
    private_key, jwks = signing_material
    verifier = auth.JWTVerifier(
        supabase_url="https://example.supabase.co",
        jwks_loader=lambda: jwks,
    )

    claims = verifier.verify(make_token(private_key))

    assert claims["sub"] == "8a31c20d-e20c-4b78-adcb-6b9e97b5db0d"
    assert claims["role"] == "authenticated"


@pytest.mark.parametrize(
    "overrides",
    [
        {"aud": "anon"},
        {"iss": "https://attacker.example/auth/v1"},
        {"role": "anon"},
        {"exp": datetime.now(timezone.utc) - timedelta(seconds=1)},
    ],
)
def test_verifier_rejects_invalid_claims(signing_material, overrides):
    private_key, jwks = signing_material
    verifier = auth.JWTVerifier(
        supabase_url="https://example.supabase.co",
        jwks_loader=lambda: jwks,
    )

    with pytest.raises(auth.AuthenticationError):
        verifier.verify(make_token(private_key, **overrides))


def test_main_app_protects_api_routes_and_keeps_health_public():
    from main import app

    client = app.test_client()

    protected = client.get("/api/dashboard/overview")
    health = client.get("/healthz")

    assert protected.status_code == 401
    assert protected.get_json()["error"]["code"] == "authentication_required"
    assert health.status_code == 200