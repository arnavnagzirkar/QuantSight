from types import SimpleNamespace

from rq.job import JobStatus

from core import jobs


def _persisted_job(status: str) -> dict:
    return {
        "id": "job-id",
        "user_id": "user-id",
        "status": status,
        "cancel_requested": False,
    }


def test_cancel_queued_job_removes_it_from_rq(monkeypatch):
    persisted = _persisted_job("queued")
    updates = []

    class FakeRQJob:
        cancelled = False

        @staticmethod
        def fetch(job_id, connection):
            assert job_id == "job-id"
            assert connection == "redis-connection"
            return FakeRQJob()

        def get_status(self, refresh=True):
            assert refresh is True
            return JobStatus.QUEUED

        def cancel(self):
            FakeRQJob.cancelled = True

    monkeypatch.setattr(jobs, "get_persisted_user_job", lambda user_id, job_id: persisted)
    monkeypatch.setattr(jobs, "get_queue", lambda: SimpleNamespace(connection="redis-connection"))
    monkeypatch.setattr(jobs, "RQJob", FakeRQJob)
    monkeypatch.setattr(
        jobs,
        "update_user_job",
        lambda user_id, job_id, values: updates.append(values) or {**persisted, **values},
    )

    result = jobs.cancel_user_job("user-id", "job-id")

    assert FakeRQJob.cancelled is True
    assert result["status"] == "cancelled"
    assert updates[-1]["progress_phase"] == "Cancelled"


def test_cancel_running_job_sends_stop_command(monkeypatch):
    persisted = _persisted_job("running")
    stopped = []

    class FakeRQJob:
        @staticmethod
        def fetch(job_id, connection):
            return FakeRQJob()

        def get_status(self, refresh=True):
            return JobStatus.STARTED

    monkeypatch.setattr(jobs, "get_persisted_user_job", lambda user_id, job_id: persisted)
    monkeypatch.setattr(jobs, "get_queue", lambda: SimpleNamespace(connection="redis-connection"))
    monkeypatch.setattr(jobs, "RQJob", FakeRQJob)
    monkeypatch.setattr(jobs, "send_stop_job_command", lambda connection, job_id: stopped.append((connection, job_id)))
    monkeypatch.setattr(
        jobs,
        "update_user_job",
        lambda user_id, job_id, values: {**persisted, **values},
    )

    result = jobs.cancel_user_job("user-id", "job-id")

    assert stopped == [("redis-connection", "job-id")]
    assert result["status"] == "cancelled"


def test_completion_cannot_overwrite_requested_cancellation(monkeypatch):
    persisted = {**_persisted_job("cancel_requested"), "cancel_requested": True}
    updates = []
    monkeypatch.setattr(jobs, "get_persisted_user_job", lambda user_id, job_id: persisted)
    monkeypatch.setattr(
        jobs,
        "update_user_job",
        lambda user_id, job_id, values: updates.append(values) or {**persisted, **values},
    )

    result = jobs._complete_job("user-id", "job-id", {"metrics": {"sharpe": 1.2}})

    assert result == {"cancelled": True}
    assert len(updates) == 1
    assert updates[0]["status"] == "cancelled"


def test_completion_persists_and_links_domain_resource(monkeypatch):
    persisted = {
        **_persisted_job("running"),
        "job_type": "backtest",
        "params": {"ticker": "AAPL"},
    }
    updates = []
    persisted_resources = []
    monkeypatch.setattr(jobs, "get_persisted_user_job", lambda user_id, job_id: persisted)
    monkeypatch.setattr(
        jobs,
        "persist_job_result_resource",
        lambda user_id, job_id, job_type, params, summary: (
            persisted_resources.append((job_type, params, summary)) or ("backtests", job_id)
        ),
    )
    monkeypatch.setattr(
        jobs,
        "update_user_job",
        lambda user_id, job_id, values: updates.append(values) or {**persisted, **values},
    )

    summary = {"name": "AAPL Backtest", "metrics": {"sharpe": 1.2}}
    result = jobs._complete_job("user-id", "job-id", summary)

    assert result == summary
    assert persisted_resources == [("backtest", {"ticker": "AAPL"}, summary)]
    assert updates[0]["result_resource_type"] == "backtests"
    assert updates[0]["result_resource_id"] == "job-id"


def test_idempotent_enqueue_returns_completed_job(monkeypatch):
    completed = {**_persisted_job("completed"), "result_summary": {"metrics": {}}}
    monkeypatch.setattr(
        jobs,
        "find_job_by_idempotency",
        lambda user_id, idempotency_key: completed,
    )
    monkeypatch.setattr(
        jobs,
        "create_job",
        lambda **kwargs: (_ for _ in ()).throw(AssertionError("duplicate job created")),
    )

    result = jobs.enqueue_model_training(
        "user-id",
        {"ticker": "AAPL"},
        idempotency_key="same-request",
    )

    assert result is completed