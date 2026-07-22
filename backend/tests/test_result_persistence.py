import pytest

from core import database


@pytest.fixture
def captured(monkeypatch):
    records = []
    monkeypatch.setattr(
        database,
        "upload_json_artifact",
        lambda bucket, user_id, job_id, payload: (
            f"{user_id}/{job_id}.json",
            "artifact-hash",
        ),
    )
    monkeypatch.setattr(
        database,
        "_upsert_resource",
        lambda table, payload: records.append((table, payload)) or payload,
    )
    monkeypatch.setattr(database, "_model_version", lambda user_id, job_id, name: 1)
    return records


def test_model_result_persists_artifact_and_metadata(captured):
    resource = database.persist_job_result_resource(
        "user-id",
        "job-id",
        "model_train",
        {"name": "Model", "ticker": "AAPL", "model_type": "xgb", "horizon": "1d"},
        {"name": "Model", "ticker": "AAPL", "model_type": "xgb", "horizon": "1d", "metrics": {}},
    )

    assert resource == ("models", "job-id")
    table, payload = captured[0]
    assert table == "models"
    assert payload["artifact_path"] == "user-id/job-id.json"
    assert payload["artifact_hash"] == "artifact-hash"


def test_experiment_result_links_model_and_experiment_run(captured):
    resource = database.persist_job_result_resource(
        "user-id",
        "job-id",
        "experiment_run",
        {
            "experiment_id": "experiment-id",
            "name": "Experiment",
            "ticker": "AAPL",
            "model_type": "ensemble",
            "horizon": "5d",
        },
        {"name": "Experiment", "ticker": "AAPL", "model_type": "ensemble", "horizon": "5d", "metrics": {}},
    )

    assert resource == ("experiment_runs", "job-id")
    assert [table for table, _ in captured] == ["models", "experiment_runs"]
    assert captured[1][1]["model_id"] == "job-id"
    assert captured[1][1]["result_path"] == "user-id/job-id.json"


@pytest.mark.parametrize(
    ("job_type", "expected_tables", "resource_type"),
    [
        ("backtest", ["backtests"], "backtests"),
        ("portfolio_run", ["portfolios", "portfolio_runs"], "portfolio_runs"),
        ("signal_analysis", ["signal_analyses"], "signal_analyses"),
    ],
)
def test_research_result_persists_domain_record(
    captured,
    job_type,
    expected_tables,
    resource_type,
):
    params = {
        "name": "Run",
        "ticker": "AAPL",
        "tickers": ["AAPL", "MSFT"],
        "allocation_method": "equal_weight",
        "signal": "mom_20",
    }
    summary = {
        **params,
        "metrics": {},
        "risk": {},
        "equity_curve": [],
        "benchmark_curve": [],
        "ledger": [],
        "weight_history": [],
        "attribution": [],
    }

    resource = database.persist_job_result_resource(
        "user-id",
        "job-id",
        job_type,
        params,
        summary,
    )

    assert resource == (resource_type, "job-id")
    assert [table for table, _ in captured] == expected_tables
    assert captured[-1][1]["result_path"] == "user-id/job-id.json"
    if job_type == "portfolio_run":
        assert captured[-1][1]["chart_data"]["artifact_sha256"] == "artifact-hash"
    elif job_type == "backtest":
        assert captured[-1][1]["chart_data"]["artifact_sha256"] == "artifact-hash"
    else:
        assert captured[-1][1]["chart_data"]["artifact_sha256"] == "artifact-hash"