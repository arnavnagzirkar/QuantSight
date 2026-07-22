from types import SimpleNamespace

import numpy as np
import pandas as pd
import pytest

from core.research import experiment


def factor_frame(rows: int = 320) -> pd.DataFrame:
    index = pd.date_range("2022-01-03", periods=rows, freq="B")
    feature = np.sin(np.arange(rows) / 7.0)
    return pd.DataFrame(
        {
            "feature_a": feature,
            "feature_b": np.cos(np.arange(rows) / 11.0),
            "y_up_1d": (feature > 0).astype(float),
            "target_ret_1d": np.log1p(np.full(rows, 0.001)),
        },
        index=index,
    )


def test_walkforward_lstm_returns_oos_probabilities(monkeypatch):
    factors = factor_frame()

    def fake_train(**kwargs):
        assert kwargs["training_sequences"].shape[1] == 10
        return SimpleNamespace(model=object(), epochs_trained=2, validation_loss=0.5)

    monkeypatch.setattr(experiment, "train_lstm_classifier", fake_train)
    monkeypatch.setattr(
        experiment,
        "predict_probabilities",
        lambda model, sequences: np.full(len(sequences), 0.6),
    )

    result = experiment.run_walkforward_lstm(
        px=pd.DataFrame(index=factors.index),
        horizon="1d",
        train_window=250,
        test_window=21,
        max_folds=2,
        params={"sequence_length": 10, "max_epochs": 2},
        df_all=factors,
    )

    predictions = result["predictions"]["prob_up_1d"].dropna()
    assert len(predictions) == 42
    assert predictions.eq(0.6).all()
    assert result["metrics"]["n"] == 42
    assert result["feature_importance"] == []
    assert len(result["fold_metrics"]) == 2


def test_soft_voting_ensemble_combines_aligned_component_probabilities(monkeypatch):
    index = pd.date_range("2024-01-02", periods=3, freq="B")
    factors = pd.DataFrame(
        {
            "target_ret_1d": np.log1p([0.01, -0.01, 0.02]),
        },
        index=index,
    )
    xgb_predictions = pd.DataFrame({"prob_up_1d": [0.8, 0.4, 0.6]}, index=index)
    lstm_predictions = pd.DataFrame({"prob_up_1d": [0.2, 0.6, 0.4]}, index=index)

    monkeypatch.setattr(
        experiment,
        "run_walkforward_xgb",
        lambda **kwargs: {
            "metrics": {"sharpe": 1.0},
            "predictions": xgb_predictions,
            "feature_importance": [{"feature": "feature_a", "importance": 1.0}],
        },
    )
    monkeypatch.setattr(
        experiment,
        "run_walkforward_lstm",
        lambda **kwargs: {
            "metrics": {"sharpe": 0.5},
            "predictions": lstm_predictions,
            "feature_importance": [],
        },
    )

    result = experiment.run_walkforward_ensemble(
        px=pd.DataFrame(index=index),
        horizon="1d",
        weights={"xgb": 0.75, "lstm": 0.25},
        df_all=factors,
    )

    predictions = result["predictions"]
    assert predictions["xgb_prob_up_1d"].tolist() == pytest.approx([0.8, 0.4, 0.6])
    assert predictions["lstm_prob_up_1d"].tolist() == pytest.approx([0.2, 0.6, 0.4])
    assert predictions["prob_up_1d"].tolist() == pytest.approx([0.65, 0.45, 0.55])
    assert result["component_metrics"] == {
        "xgb": {"sharpe": 1.0},
        "lstm": {"sharpe": 0.5},
    }


@pytest.mark.parametrize(
    "weights",
    [
        {"xgb": 0.8, "lstm": 0.3},
        {"xgb": -0.1, "lstm": 1.1},
    ],
)
def test_ensemble_rejects_invalid_weights(weights):
    with pytest.raises(ValueError):
        experiment.run_walkforward_ensemble(
            px=pd.DataFrame(),
            weights=weights,
            df_all=pd.DataFrame(),
        )