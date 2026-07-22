import numpy as np
import pandas as pd
import pytest

from core import risk
from core import jobs


def test_historical_var_and_cvar_use_loss_tail():
    returns = pd.Series([-0.10, -0.05, -0.02, 0.00, 0.01, 0.02, 0.03, 0.04])

    result = risk.historical_var_cvar(returns, confidence=0.75)

    assert result["var"] < 0
    assert result["cvar"] <= result["var"]
    assert result["confidence"] == pytest.approx(0.75)


def test_drawdown_analysis_finds_recovered_and_ongoing_periods():
    index = pd.date_range("2024-01-01", periods=8, freq="B")
    equity = pd.Series([1.0, 1.1, 0.9, 1.05, 1.12, 1.0, 0.95, 0.98], index=index)

    result = risk.drawdown_analysis(equity)

    assert result["max_drawdown"] == pytest.approx(0.9 / 1.1 - 1.0)
    assert len(result["periods"]) == 2
    assert result["periods"][0]["recovery_date"] == index[4].strftime("%Y-%m-%d")
    assert result["periods"][1]["recovery_date"] is None
    assert result["underwater"][-1]["value"] == pytest.approx(0.98 / 1.12 - 1.0)


def test_component_risk_shares_sum_to_one():
    index = pd.date_range("2024-01-01", periods=260, freq="B")
    random = np.random.default_rng(42)
    asset_returns = pd.DataFrame(
        {
            "AAPL": random.normal(0.0005, 0.01, len(index)),
            "MSFT": random.normal(0.0004, 0.008, len(index)),
        },
        index=index,
    )
    benchmark = pd.Series(random.normal(0.0003, 0.009, len(index)), index=index)

    result = risk.component_risk(
        asset_returns=asset_returns,
        weights=pd.Series({"AAPL": 0.6, "MSFT": 0.4}),
        benchmark_returns=benchmark,
    )

    assert [item["ticker"] for item in result] == ["AAPL", "MSFT"]
    assert sum(item["risk_contribution"] for item in result) == pytest.approx(1.0)
    assert all(np.isfinite(item["beta"]) for item in result)


def test_portfolio_worker_persists_risk_report(monkeypatch):
    index = pd.date_range("2020-01-02", periods=260, freq="B")
    daily_returns = pd.Series(np.full(len(index), 0.001), index=index)
    benchmark_returns = pd.Series(np.full(len(index), 0.0005), index=index)
    weights = pd.DataFrame({"AAPL": 0.6, "MSFT": 0.4}, index=index)
    asset_returns = pd.DataFrame({"AAPL": 0.0012, "MSFT": 0.0007}, index=index)
    updates = []

    monkeypatch.setattr(jobs, "update_user_job", lambda user_id, job_id, values: updates.append(values) or values)
    monkeypatch.setattr(
        jobs,
        "persist_job_result_resource",
        lambda user_id, job_id, job_type, params, summary: ("portfolio_runs", job_id),
    )
    monkeypatch.setattr(
        jobs,
        "get_persisted_user_job",
        lambda user_id, job_id: {
            "status": "running",
            "cancel_requested": False,
            "job_type": "portfolio_run",
            "params": {"name": "Core"},
        },
    )
    monkeypatch.setattr(
        jobs,
        "backtest_portfolio",
        lambda **kwargs: {
            "daily_returns": daily_returns,
            "equity_curve": daily_returns.cumsum().apply(np.exp),
            "benchmark_returns": benchmark_returns,
            "bench_equity": benchmark_returns.cumsum().apply(np.exp),
            "weights": weights,
            "turnover_annual": 1.2,
            "transaction_costs": pd.Series(0.0, index=index),
            "asset_returns": asset_returns,
        },
    )

    result = jobs.execute_portfolio_run(
        "job-id",
        "user-id",
        {
            "name": "Core",
            "tickers": ["AAPL", "MSFT"],
            "start_date": "2020-01-01",
            "signal": "mom_20",
            "allocation_method": "equal_weight",
            "rebalance": "weekly",
            "cost_bps": 5,
            "benchmark": "SPY",
        },
    )

    assert result["risk"]["tail"]["var"] is not None
    assert result["risk"]["drawdown"]["underwater"]
    assert len(result["risk"]["components"]) == 2
    assert result["risk"]["correlation"]["labels"] == ["AAPL", "MSFT"]
    assert updates[-1]["result_summary"]["risk"] == result["risk"]