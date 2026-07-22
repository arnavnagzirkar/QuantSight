from hashlib import sha256

from flask import Blueprint, jsonify, request
from pydantic import ValidationError

from .database import (
    InvalidCredentialsError,
    SupabaseConfigurationError,
    SupabaseServiceError,
    request_password_session,
    resolve_username_email,
    username_exists,
)
from .schemas import PasswordSignInRequest, UsernameAvailabilityQuery


auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def _validation_response(error: ValidationError):
    return jsonify({
        "error": {
            "code": "validation_error",
            "message": "Request validation failed",
            "details": error.errors(include_url=False, include_context=False),
        }
    }), 422


@auth_bp.route("/password-sign-in", methods=["POST"])
def password_sign_in():
    try:
        params = PasswordSignInRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError as error:
        return _validation_response(error)

    try:
        if "@" in params.identifier:
            email = params.identifier.lower()
        else:
            email = resolve_username_email(params.identifier)
            if email is None:
                digest = sha256(params.identifier.encode("utf-8")).hexdigest()[:16]
                email = f"missing-{digest}@invalid.local"

        session = request_password_session(email, params.password)
        return jsonify({
            "data": {
                "access_token": session["access_token"],
                "refresh_token": session["refresh_token"],
                "expires_in": int(session.get("expires_in", 3600)),
                "token_type": str(session.get("token_type", "bearer")),
            }
        })
    except InvalidCredentialsError:
        return jsonify({
            "error": {
                "code": "invalid_credentials",
                "message": "Invalid username/email or password",
            }
        }), 401
    except SupabaseConfigurationError as error:
        return jsonify({
            "error": {
                "code": "authentication_not_configured",
                "message": str(error),
            }
        }), 503
    except SupabaseServiceError:
        return jsonify({
            "error": {
                "code": "authentication_provider_error",
                "message": "Authentication provider is unavailable",
            }
        }), 502


@auth_bp.route("/username-availability", methods=["GET"])
def username_availability():
    try:
        params = UsernameAvailabilityQuery.model_validate({
            "username": request.args.get("username", ""),
        })
    except ValidationError as error:
        return _validation_response(error)

    try:
        available = not username_exists(params.username)
        return jsonify({
            "data": {
                "username": params.username,
                "available": available,
            }
        })
    except SupabaseConfigurationError as error:
        return jsonify({
            "error": {
                "code": "authentication_not_configured",
                "message": str(error),
            }
        }), 503
    except SupabaseServiceError:
        return jsonify({
            "error": {
                "code": "authentication_provider_error",
                "message": "Authentication provider is unavailable",
            }
        }), 502