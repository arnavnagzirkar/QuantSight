from collections.abc import Callable
from datetime import datetime, timedelta, timezone
import os
from typing import Any

from flask import g, jsonify, request
import jwt
import requests


class AuthenticationError(RuntimeError):
    pass


class AuthConfigurationError(RuntimeError):
    pass


class JWTVerifier:
    def __init__(
        self,
        supabase_url: str,
        jwks_loader: Callable[[], dict[str, Any]] | None = None,
        cache_seconds: int = 3600,
    ):
        self.supabase_url = supabase_url.rstrip("/")
        self.issuer = f"{self.supabase_url}/auth/v1"
        self.jwks_loader = jwks_loader or self._fetch_jwks
        self.cache_seconds = cache_seconds
        self._jwks: dict[str, Any] | None = None
        self._expires_at: datetime | None = None

    def _fetch_jwks(self) -> dict[str, Any]:
        response = requests.get(
            f"{self.issuer}/.well-known/jwks.json",
            timeout=5,
        )
        response.raise_for_status()
        return response.json()

    def _get_jwks(self) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        if self._jwks is not None and self._expires_at is not None and now < self._expires_at:
            return self._jwks

        try:
            jwks = self.jwks_loader()
        except (requests.RequestException, ValueError) as error:
            if self._jwks is not None:
                return self._jwks
            raise AuthenticationError("Unable to verify access token") from error

        if not isinstance(jwks.get("keys"), list):
            raise AuthenticationError("Unable to verify access token")
        self._jwks = jwks
        self._expires_at = now + timedelta(seconds=self.cache_seconds)
        return jwks

    def verify(self, token: str) -> dict[str, Any]:
        try:
            header = jwt.get_unverified_header(token)
            key_id = header.get("kid")
            algorithm = header.get("alg")
            if not key_id or algorithm not in {"RS256", "ES256"}:
                raise AuthenticationError("Invalid access token")

            signing_key = next(
                (key for key in self._get_jwks()["keys"] if key.get("kid") == key_id),
                None,
            )
            if signing_key is None:
                raise AuthenticationError("Invalid access token")

            key = jwt.PyJWK.from_dict(signing_key).key
            claims = jwt.decode(
                token,
                key,
                algorithms=[algorithm],
                audience="authenticated",
                issuer=self.issuer,
                options={"require": ["sub", "aud", "iss", "iat", "exp"]},
            )
            if claims.get("role") != "authenticated":
                raise AuthenticationError("Invalid access token")
            return claims
        except AuthenticationError:
            raise
        except (jwt.PyJWTError, KeyError, TypeError, ValueError) as error:
            raise AuthenticationError("Invalid or expired access token") from error


_verifiers: dict[str, JWTVerifier] = {}


def verify_access_token(token: str) -> dict[str, Any]:
    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
    if not supabase_url:
        raise AuthConfigurationError("SUPABASE_URL is not configured")
    verifier = _verifiers.setdefault(supabase_url, JWTVerifier(supabase_url))
    return verifier.verify(token)


def authenticate_api_request():
    if request.method == "OPTIONS":
        return None

    authorization = request.headers.get("Authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return jsonify({
            "error": {
                "code": "authentication_required",
                "message": "A valid bearer token is required",
            }
        }), 401

    try:
        claims = verify_access_token(token.strip())
    except AuthConfigurationError as error:
        return jsonify({
            "error": {
                "code": "authentication_not_configured",
                "message": str(error),
            }
        }), 503
    except AuthenticationError:
        return jsonify({
            "error": {
                "code": "invalid_access_token",
                "message": "The access token is invalid or expired",
            }
        }), 401

    g.user_id = claims["sub"]
    g.user_email = claims.get("email")
    g.auth_claims = claims
    return None