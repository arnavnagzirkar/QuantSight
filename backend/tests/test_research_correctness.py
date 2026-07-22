import numpy as np
import pandas as pd
import pytest

from core.research import portfolio
from core.research import experiment
from core.research.backtest import backtest_prob_strategy
from core.research.factors import compute_alpha_factors


def test_forward_direction_labels_preserve_unknown_outcomes():
    index = pd.date_range("2024-01-01", periods=100, freq="B")
    close = pd.Series(np.linspace(100.0, 125.0, len(index)), index=index)
    prices = pd.DataFrame(
        {
            "Open": close - 0.25,
            "High": close + 0.5,
            "Low": close - 0.5,
            "Close": close,
            "Volume": 1_000_000,
        },
        index=index,
    )

    factors = compute_alpha_factors(prices)

    assert factors["y_up_1d"].iloc[-1:].isna().all()
    assert factors["y_up_5d"].iloc[-5:].isna().all()
    assert factors["y_up_20d"].iloc[-20:].isna().all()
    assert factors["y_up_1d"].iloc[:-1].notna().all()
    assert factors["y_up_5d"].iloc[:-5].notna().all()
    assert factors["y_up_20d"].iloc[:-20].notna().all()


def test_portfolio_applies_rebalance_weights_to_future_returns(monkeypatch):
    index = pd.date_range("2024-01-02", periods=4, freq="B")
    signals = {
        "AAA": [1.0, 0.0, 0.0, 0.0],
        "BBB": [0.0, 1.0, 1.0, 1.0],
    }
    returns = {
        "AAA": [0.50, 0.01, 0.00, 0.00],
        "BBB": [0.00, 0.50, 0.02, 0.03],
    }

    def fake_signal_series(ticker: str, start: str, signal_col: str, end: str | None = None):
        del start, end
        return pd.DataFrame(
            {
                signal_col: signals[ticker],
                "log_ret": returns[ticker],
            },
            index=index,
        )

    benchmark = pd.DataFrame(
        {
            "Open": [100.0, 101.0, 102.0, 103.0],
            "High": [101.0, 102.0, 103.0, 104.0],
            "Low": [99.0, 100.0, 101.0, 102.0],
            "Close": [100.0, 101.0, 102.0, 103.0],
            "Volume": [1_000_000] * 4,
        },
        index=index,
    )

    monkeypatch.setattr(portfolio, "_signal_series_for_ticker", fake_signal_series)
    monkeypatch.setattr(portfolio.yf, "download", lambda *args, **kwargs: benchmark.copy())

    result = portfolio.backtest_portfolio(
        tickers=["AAA", "BBB"],
        start="2024-01-01",
        signal="signal",
        allocator="signal_weighted",
        rebalance="daily",
        cost_bps=0.0,
    )

    assert isinstance(result["daily_returns"], pd.Series)
    assert isinstance(result["benchmark_returns"], pd.Series)
    assert result["daily_returns"].loc[index[0]] == pytest.approx(0.0)
    assert result["daily_returns"].loc[index[1]] == pytest.approx(0.01)
    assert result["daily_returns"].loc[index[2]] == pytest.approx(0.02)
    assert result["weights"].loc[index[0], "AAA"] == pytest.approx(0.0)
    assert result["weights"].loc[index[1], "AAA"] == pytest.approx(1.0)


def test_portfolio_moves_to_cash_when_rebalance_signals_are_missing(monkeypatch):
    index = pd.date_range("2024-01-02", periods=3, freq="B")

    def fake_signal_series(ticker: str, start: str, signal_col: str, end: str | None = None):
        del ticker, start, end
        return pd.DataFrame(
            {
                signal_col: [np.nan, np.nan, np.nan],
                "log_ret": [0.01, -0.02, 0.03],
            },
            index=index,
        )

    benchmark = pd.DataFrame(
        {"Close": [100.0, 101.0, 102.0]},
        index=index,
    )
    monkeypatch.setattr(portfolio, "_signal_series_for_ticker", fake_signal_series)
    monkeypatch.setattr(portfolio.yf, "download", lambda *args, **kwargs: benchmark.copy())

    result = portfolio.backtest_portfolio(
        tickers=["AAA", "BBB"],
        start="2024-01-01",
        signal="signal",
        allocator="equal_weight",
        rebalance="daily",
        cost_bps=5.0,
    )

    assert result["weights"].eq(0.0).all().all()
    assert result["daily_returns"].eq(0.0).all()
    assert result["turnover"].eq(0.0).all()


def test_probability_backtest_uses_signal_with_its_forward_return():
    index = pd.date_range("2024-01-02", periods=3, freq="B")
    frame = pd.DataFrame(
        {
            "prob_up_1d": [1.0, 0.0, 0.75],
            "target_ret_1d": np.log1p([0.10, 0.20, -0.10]),
        },
        index=index,
    )

    result = backtest_prob_strategy(
        frame,
        prob_col="prob_up_1d",
        ret_col="target_ret_1d",
        cost_bps=0.0,
    )

    assert result["positions"].tolist() == pytest.approx([1.0, -1.0, 0.5])
    assert result["series"].tolist() == pytest.approx([0.10, -0.20, -0.05])


def test_probability_backtest_charges_initial_position_turnover():
    frame = pd.DataFrame(
        {
            "prob_up_1d": [1.0, 1.0],
            "target_ret_1d": [0.0, 0.0],
        },
        index=pd.date_range("2024-01-02", periods=2, freq="B"),
    )

    result = backtest_prob_strategy(
        frame,
        prob_col="prob_up_1d",
        ret_col="target_ret_1d",
        cost_bps=10.0,
    )

    assert result["turnover_series"].tolist() == pytest.approx([1.0, 0.0])
    assert result["transaction_costs"].tolist() == pytest.approx([0.001, 0.0])


def test_long_only_probability_backtest_never_shorts():
    frame = pd.DataFrame(
        {
            "prob_up_1d": [0.2, 0.5, 0.8],
            "target_ret_1d": np.log1p([0.01, 0.01, 0.01]),
        },
        index=pd.date_range("2024-01-02", periods=3, freq="B"),
    )

    result = backtest_prob_strategy(
        frame,
        prob_col="prob_up_1d",
        ret_col="target_ret_1d",
        position_rule="long_only",
        cost_bps=0.0,
    )

    assert result["positions"].tolist() == pytest.approx([0.0, 0.0, 0.6])
    assert (result["positions"] >= 0).all()


def test_multiday_model_uses_next_day_returns_for_strategy_backtest(monkeypatch):
    index = pd.date_range("2022-01-03", periods=300, freq="B")
    factors = pd.DataFrame(
        {
            "feature": np.linspace(-1.0, 1.0, len(index)),
            "y_up_5d": np.tile([0.0, 1.0], len(index) // 2),
            "target_ret_1d": np.log1p(np.full(len(index), 0.001)),
            "target_ret_5d": np.log1p(np.full(len(index), 0.05)),
        },
        index=index,
    )
    captured = {}

    class FakeModel:
        feature_importances_ = np.array([1.0])

        def predict_proba(self, values):
            probability = np.full(len(values), 0.6)
            return np.column_stack([1.0 - probability, probability])

    def fake_train(*args, **kwargs):
        return FakeModel(), 0.5

    def fake_backtest(frame, prob_col, ret_col, **kwargs):
        captured["ret_col"] = ret_col
        series = pd.Series(0.0, index=frame.index)
        return {
            "n": len(frame),
            "sharpe": 0.0,
            "sortino": 0.0,
            "mdd": 0.0,
            "cum_return": 0.0,
            "turnover": 0.0,
            "equity_curve": pd.Series(1.0, index=frame.index),
            "series": series,
            "positions": series,
            "gross_returns": series,
            "turnover_series": series,
            "transaction_costs": series,
        }

    monkeypatch.setattr(experiment, "compute_alpha_factors", lambda *args, **kwargs: factors.copy())
    monkeypatch.setattr(experiment, "train_xgb_prob", fake_train)
    monkeypatch.setattr(experiment, "backtest_prob_strategy", fake_backtest)

    experiment.run_walkforward_xgb(
        px=pd.DataFrame(index=index),
        horizon="5d",
        train_window=250,
        test_window=21,
        max_folds=1,
    )

    assert captured["ret_col"] == "target_ret_1d"


def test_walkforward_metrics_exclude_backtest_series(monkeypatch):
    index = pd.date_range("2022-01-03", periods=300, freq="B")
    factors = pd.DataFrame(
        {
            "feature": np.linspace(-1.0, 1.0, len(index)),
            "y_up_1d": np.tile([0.0, 1.0], len(index) // 2),
            "target_ret_1d": np.log1p(np.full(len(index), 0.001)),
        },
        index=index,
    )

    class FakeModel:
        feature_importances_ = np.array([1.0])

        def predict_proba(self, values):
            return np.column_stack([np.full(len(values), 0.4), np.full(len(values), 0.6)])

    monkeypatch.setattr(experiment, "compute_alpha_factors", lambda *args, **kwargs: factors.copy())
    monkeypatch.setattr(experiment, "train_xgb_prob", lambda *args, **kwargs: (FakeModel(), 0.5))

    result = experiment.run_walkforward_xgb(
        px=pd.DataFrame(index=index),
        horizon="1d",
        train_window=250,
        test_window=21,
        max_folds=1,
    )

    assert all(not isinstance(value, (pd.Series, pd.DataFrame)) for value in result["metrics"].values())
    assert isinstance(result["positions"], pd.Series)
    assert isinstance(result["transaction_costs"], pd.Series)