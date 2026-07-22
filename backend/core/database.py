from functools import lru_cache
from datetime import datetime, timezone
from hashlib import sha256
import json
import os

import requests
from supabase import Client, create_client


class SupabaseConfigurationError(RuntimeError):
    pass


class SupabaseServiceError(RuntimeError):
    pass


class InvalidCredentialsError(RuntimeError):
    pass


DEFAULT_USER_SETTINGS = {
    "theme": "system",
    "timezone": "UTC",
    "default_tickers": ["AAPL", "MSFT", "GOOGL"],
    "default_model_type": "xgb",
    "default_train_window": 750,
    "default_test_window": 63,
    "default_max_folds": 10,
    "notify_job_complete": True,
}
USER_SETTINGS_COLUMNS = ",".join(DEFAULT_USER_SETTINGS)


def _required_environment(name: str) -> str:
    aliases = {
        "SUPABASE_URL": "VITE_SUPABASE_URL",
        "SUPABASE_ANON_KEY": "VITE_SUPABASE_ANON_KEY",
    }
    value = os.getenv(name) or os.getenv(aliases.get(name, ""))
    if not value:
        raise SupabaseConfigurationError(f"{name} is not configured")
    return value


@lru_cache(maxsize=1)
def get_admin_client() -> Client:
    return create_client(
        _required_environment("SUPABASE_URL"),
        _required_environment("SUPABASE_SERVICE_ROLE_KEY"),
    )


def resolve_username_email(username: str) -> str | None:
    try:
        response = (
            get_admin_client()
            .table("profiles")
            .select("email")
            .ilike("username", username)
            .limit(1)
            .execute()
        )
    except SupabaseConfigurationError:
        raise
    except Exception as error:
        raise SupabaseServiceError("Unable to query profiles") from error

    if not response.data:
        return None
    return str(response.data[0]["email"])


def username_exists(username: str) -> bool:
    return resolve_username_email(username) is not None


def request_password_session(email: str, password: str) -> dict:
    supabase_url = _required_environment("SUPABASE_URL").rstrip("/")
    anon_key = _required_environment("SUPABASE_ANON_KEY")
    try:
        response = requests.post(
            f"{supabase_url}/auth/v1/token",
            params={"grant_type": "password"},
            headers={"apikey": anon_key, "Content-Type": "application/json"},
            json={"email": email, "password": password},
            timeout=10,
        )
    except requests.RequestException as error:
        raise SupabaseServiceError("Authentication provider is unavailable") from error

    if response.status_code in {400, 401}:
        raise InvalidCredentialsError()
    if not response.ok:
        raise SupabaseServiceError("Authentication provider is unavailable")

    try:
        payload = response.json()
    except ValueError as error:
        raise SupabaseServiceError("Authentication provider returned an invalid response") from error
    if not payload.get("access_token") or not payload.get("refresh_token"):
        raise SupabaseServiceError("Authentication provider returned an invalid response")
    return payload


def get_user_settings(user_id: str) -> dict:
    try:
        response = (
            get_admin_client()
            .table("user_settings")
            .select(USER_SETTINGS_COLUMNS)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
    except SupabaseConfigurationError:
        raise
    except Exception as error:
        raise SupabaseServiceError("Unable to load user settings") from error

    if response.data:
        return {key: response.data[0][key] for key in DEFAULT_USER_SETTINGS}
    return upsert_user_settings(user_id, DEFAULT_USER_SETTINGS)


def upsert_user_settings(user_id: str, values: dict) -> dict:
    payload = {"user_id": user_id, **values}
    try:
        response = (
            get_admin_client()
            .table("user_settings")
            .upsert(payload, on_conflict="user_id")
            .execute()
        )
    except SupabaseConfigurationError:
        raise
    except Exception as error:
        raise SupabaseServiceError("Unable to save user settings") from error

    if not response.data:
        raise SupabaseServiceError("Unable to save user settings")
    return {key: response.data[0][key] for key in DEFAULT_USER_SETTINGS}


def find_job_by_idempotency(user_id: str, idempotency_key: str) -> dict | None:
    try:
        response = (
            get_admin_client()
            .table("jobs")
            .select("*")
            .eq("user_id", user_id)
            .eq("idempotency_key", idempotency_key)
            .limit(1)
            .execute()
        )
    except SupabaseConfigurationError:
        raise
    except Exception as error:
        raise SupabaseServiceError("Unable to query jobs") from error
    return response.data[0] if response.data else None


def create_job(
    *,
    job_id: str,
    user_id: str,
    job_type: str,
    params: dict,
    idempotency_key: str | None,
) -> dict:
    payload = {
        "id": job_id,
        "user_id": user_id,
        "job_type": job_type,
        "status": "queued",
        "progress_percent": 0,
        "progress_phase": "Queued",
        "params": params,
        "idempotency_key": idempotency_key,
    }
    try:
        response = get_admin_client().table("jobs").insert(payload).execute()
    except SupabaseConfigurationError:
        raise
    except Exception as error:
        raise SupabaseServiceError("Unable to create job") from error
    if not response.data:
        raise SupabaseServiceError("Unable to create job")
    return response.data[0]


def get_user_job(user_id: str, job_id: str) -> dict | None:
    try:
        response = (
            get_admin_client()
            .table("jobs")
            .select("*")
            .eq("id", job_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
    except SupabaseConfigurationError:
        raise
    except Exception as error:
        raise SupabaseServiceError("Unable to query job") from error
    return response.data[0] if response.data else None


def update_user_job(user_id: str, job_id: str, values: dict) -> dict:
    try:
        response = (
            get_admin_client()
            .table("jobs")
            .update(values)
            .eq("id", job_id)
            .eq("user_id", user_id)
            .execute()
        )
    except SupabaseConfigurationError:
        raise
    except Exception as error:
        raise SupabaseServiceError("Unable to update job") from error
    if not response.data:
        raise SupabaseServiceError("Unable to update job")
    return response.data[0]


def list_user_jobs(user_id: str, limit: int = 50) -> list[dict]:
    try:
        response = (
            get_admin_client()
            .table("jobs")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
    except SupabaseConfigurationError:
        raise
    except Exception as error:
        raise SupabaseServiceError("Unable to list jobs") from error
    return list(response.data or [])


def _upsert_resource(table: str, payload: dict) -> dict:
    try:
        response = (
            get_admin_client()
            .table(table)
            .upsert(payload, on_conflict="id")
            .execute()
        )
    except SupabaseConfigurationError:
        raise
    except Exception as error:
        raise SupabaseServiceError(f"Unable to persist {table} result") from error
    if not response.data:
        raise SupabaseServiceError(f"Unable to persist {table} result")
    return response.data[0]


def upload_json_artifact(
    bucket: str,
    user_id: str,
    job_id: str,
    payload: dict,
) -> tuple[str, str]:
    artifact = json.dumps(
        payload,
        allow_nan=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    artifact_hash = sha256(artifact).hexdigest()
    path = f"{user_id}/{job_id}.json"
    try:
        get_admin_client().storage.from_(bucket).upload(
            path,
            artifact,
            {
                "content-type": "application/json",
                "cache-control": "3600",
                "upsert": "true",
            },
        )
    except SupabaseConfigurationError:
        raise
    except Exception as error:
        raise SupabaseServiceError("Unable to persist result artifact") from error
    return path, artifact_hash


def _model_version(user_id: str, job_id: str, name: str) -> int:
    try:
        existing = (
            get_admin_client()
            .table("models")
            .select("version")
            .eq("id", job_id)
            .limit(1)
            .execute()
        )
        if existing.data:
            return int(existing.data[0]["version"])
        latest = (
            get_admin_client()
            .table("models")
            .select("version")
            .eq("user_id", user_id)
            .eq("name", name)
            .order("version", desc=True)
            .limit(1)
            .execute()
        )
    except SupabaseConfigurationError:
        raise
    except Exception as error:
        raise SupabaseServiceError("Unable to determine model version") from error
    return int(latest.data[0]["version"]) + 1 if latest.data else 1


def _persist_model_result(
    user_id: str,
    job_id: str,
    params: dict,
    summary: dict,
    artifact_path: str,
    artifact_hash: str,
) -> dict:
    name = str(summary.get("name") or params.get("name") or "Research Model")
    return _upsert_resource("models", {
        "id": job_id,
        "user_id": user_id,
        "job_id": job_id,
        "name": name,
        "ticker": summary.get("ticker") or params.get("ticker"),
        "model_type": summary.get("model_type") or params.get("model_type"),
        "horizon": summary.get("horizon") or params.get("horizon"),
        "status": "ready",
        "version": _model_version(user_id, job_id, name),
        "config": params,
        "metrics": summary.get("metrics", {}),
        "feature_importance": summary.get("feature_importance", []),
        "artifact_path": artifact_path,
        "artifact_hash": artifact_hash,
        "trained_from": params.get("start_date"),
        "trained_to": params.get("end_date"),
    })


def persist_job_result_resource(
    user_id: str,
    job_id: str,
    job_type: str,
    params: dict,
    summary: dict,
) -> tuple[str, str]:
    completed_at = datetime.now(timezone.utc).isoformat()
    artifact_bucket = (
        "models"
        if job_type in {"model_train", "experiment_run"}
        else "research-results"
    )
    artifact_path, artifact_hash = upload_json_artifact(
        artifact_bucket,
        user_id,
        job_id,
        {"params": params, "result": summary},
    )

    if job_type == "model_train":
        _persist_model_result(
            user_id,
            job_id,
            params,
            summary,
            artifact_path,
            artifact_hash,
        )
        return "models", job_id

    if job_type == "experiment_run":
        _persist_model_result(
            user_id,
            job_id,
            params,
            summary,
            artifact_path,
            artifact_hash,
        )
        experiment_id = params.get("experiment_id")
        if not experiment_id:
            raise SupabaseServiceError("Experiment run is missing experiment_id")
        _upsert_resource("experiment_runs", {
            "id": job_id,
            "user_id": user_id,
            "experiment_id": experiment_id,
            "job_id": job_id,
            "model_id": job_id,
            "status": "completed",
            "config_snapshot": params,
            "metrics": summary.get("metrics", {}),
            "summary": {**summary, "artifact_sha256": artifact_hash},
            "result_path": artifact_path,
            "completed_at": completed_at,
        })
        return "experiment_runs", job_id

    if job_type == "backtest":
        _upsert_resource("backtests", {
            "id": job_id,
            "user_id": user_id,
            "job_id": job_id,
            "name": summary.get("name") or params.get("name") or "Strategy Backtest",
            "ticker": summary.get("ticker") or params.get("ticker"),
            "status": "completed",
            "config": params,
            "metrics": summary.get("metrics", {}),
            "chart_data": {
                "equity_curve": summary.get("equity_curve", []),
                "benchmark_curve": summary.get("benchmark_curve", []),
                "ledger": summary.get("ledger", []),
                "artifact_sha256": artifact_hash,
            },
            "result_path": artifact_path,
        })
        return "backtests", job_id

    if job_type == "portfolio_run":
        _upsert_resource("portfolios", {
            "id": job_id,
            "user_id": user_id,
            "name": summary.get("name") or params.get("name") or "Portfolio Run",
            "tickers": summary.get("tickers") or params.get("tickers", []),
            "allocation_method": summary.get("allocation_method") or params.get("allocation_method"),
            "config": params,
        })
        _upsert_resource("portfolio_runs", {
            "id": job_id,
            "user_id": user_id,
            "portfolio_id": job_id,
            "job_id": job_id,
            "status": "completed",
            "config_snapshot": params,
            "metrics": summary.get("metrics", {}),
            "chart_data": {
                "equity_curve": summary.get("equity_curve", []),
                "benchmark_curve": summary.get("benchmark_curve", []),
                "weight_history": summary.get("weight_history", []),
                "attribution": summary.get("attribution", []),
                "artifact_sha256": artifact_hash,
            },
            "risk_summary": summary.get("risk", {}),
            "result_path": artifact_path,
            "completed_at": completed_at,
        })
        return "portfolio_runs", job_id

    if job_type == "signal_analysis":
        _upsert_resource("signal_analyses", {
            "id": job_id,
            "user_id": user_id,
            "job_id": job_id,
            "ticker": summary.get("ticker") or params.get("ticker"),
            "signal_name": summary.get("signal") or params.get("signal"),
            "status": "completed",
            "config": params,
            "metrics": {"rows_used": summary.get("rows_used")},
            "chart_data": {**summary, "artifact_sha256": artifact_hash},
            "result_path": artifact_path,
            "completed_at": completed_at,
        })
        return "signal_analyses", job_id

    raise SupabaseServiceError(f"Unsupported result resource type: {job_type}")


def list_user_experiments(user_id: str) -> list[dict]:
    try:
        response = (
            get_admin_client()
            .table("experiments")
            .select("*")
            .eq("user_id", user_id)
            .is_("deleted_at", "null")
            .order("created_at", desc=True)
            .execute()
        )
    except SupabaseConfigurationError:
        raise
    except Exception as error:
        raise SupabaseServiceError("Unable to list experiments") from error
    return list(response.data or [])


def get_user_experiment(user_id: str, experiment_id: str) -> dict | None:
    try:
        response = (
            get_admin_client()
            .table("experiments")
            .select("*")
            .eq("id", experiment_id)
            .eq("user_id", user_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
    except SupabaseConfigurationError:
        raise
    except Exception as error:
        raise SupabaseServiceError("Unable to load experiment") from error
    return response.data[0] if response.data else None


def create_user_experiment(user_id: str, values: dict) -> dict:
    try:
        response = (
            get_admin_client()
            .table("experiments")
            .insert({"user_id": user_id, **values})
            .execute()
        )
    except SupabaseConfigurationError:
        raise
    except Exception as error:
        raise SupabaseServiceError("Unable to create experiment") from error
    if not response.data:
        raise SupabaseServiceError("Unable to create experiment")
    return response.data[0]


def update_user_experiment(user_id: str, experiment_id: str, values: dict) -> dict | None:
    try:
        response = (
            get_admin_client()
            .table("experiments")
            .update(values)
            .eq("id", experiment_id)
            .eq("user_id", user_id)
            .is_("deleted_at", "null")
            .execute()
        )
    except SupabaseConfigurationError:
        raise
    except Exception as error:
        raise SupabaseServiceError("Unable to update experiment") from error
    return response.data[0] if response.data else None


def delete_user_experiment(user_id: str, experiment_id: str) -> bool:
    from datetime import datetime, timezone

    try:
        response = (
            get_admin_client()
            .table("experiments")
            .update({"deleted_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", experiment_id)
            .eq("user_id", user_id)
            .is_("deleted_at", "null")
            .execute()
        )
    except SupabaseConfigurationError:
        raise
    except Exception as error:
        raise SupabaseServiceError("Unable to delete experiment") from error
    return bool(response.data)