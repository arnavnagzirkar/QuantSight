import os

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from redis import Redis

from core.adapter_api import adapter_bp
from core.auth import authenticate_api_request
from core.auth_api import auth_bp
from core.database import get_admin_client
from core.research.api import research_bp
from core.research.report import report_bp


load_dotenv()


def configured_origins() -> list[str]:
    configured = os.getenv("CORS_ORIGINS", "http://localhost:5173")
    return [origin.strip().rstrip("/") for origin in configured.split(",") if origin.strip()]


def create_app() -> Flask:
    application = Flask(__name__)
    application.url_map.strict_slashes = False
    CORS(
        application,
        resources={
            r"/api/*": {
                "origins": configured_origins(),
                "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
                "allow_headers": ["Content-Type", "Authorization", "Idempotency-Key"],
                "max_age": 3600,
            }
        },
    )

    application.register_blueprint(auth_bp)
    application.register_blueprint(adapter_bp)
    application.register_blueprint(research_bp)
    application.register_blueprint(report_bp)

    @application.before_request
    def protect_api_routes():
        if request.path.startswith("/api/") and not request.path.startswith("/api/auth/"):
            return authenticate_api_request()
        return None

    @application.get("/")
    def index():
        return jsonify({"name": "QuantSight API", "status": "ok"})

    @application.get("/healthz")
    def health():
        return jsonify({"ok": True}), 200

    @application.get("/readyz")
    def readiness():
        checks = {
            "supabase": _supabase_ready(),
            "redis": _redis_ready(),
            "newsapi": bool(os.getenv("NEWS_API_KEY")),
        }
        ready = all(checks.values())
        return jsonify({"ready": ready, "checks": checks}), 200 if ready else 503

    return application


def _supabase_ready() -> bool:
    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
    if not supabase_url or not os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
        return False
    try:
        get_admin_client().table("profiles").select("id").limit(1).execute()
        return True
    except Exception:
        return False


def _redis_ready() -> bool:
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        return False
    try:
        return bool(Redis.from_url(redis_url).ping())
    except Exception:
        return False


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=False)