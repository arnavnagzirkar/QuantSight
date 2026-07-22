import numpy as np
import pytest

from core.research import lstm


def test_feature_scaler_is_fit_from_training_rows_only():
    training_values = np.array([[1.0, 10.0], [3.0, 14.0], [5.0, 18.0]])
    future_values = np.array([[1_000.0, 2_000.0]])

    scaler = lstm.FeatureScaler.fit(training_values)
    transformed_training = scaler.transform(training_values)
    transformed_future = scaler.transform(future_values)

    assert scaler.mean.tolist() == pytest.approx([3.0, 14.0])
    assert transformed_training.mean(axis=0).tolist() == pytest.approx([0.0, 0.0])
    assert transformed_future[0, 0] > 100


def test_prediction_sequences_use_prior_context_without_future_rows():
    history = np.array([[1.0], [2.0], [3.0]])
    test_values = np.array([[100.0], [200.0]])

    sequences = lstm.build_prediction_sequences(
        history_values=history,
        prediction_values=test_values,
        sequence_length=3,
    )

    assert sequences.shape == (2, 3, 1)
    assert sequences[0, :, 0].tolist() == [2.0, 3.0, 100.0]
    assert sequences[1, :, 0].tolist() == [3.0, 100.0, 200.0]


def test_lstm_trainer_returns_bounded_probabilities():
    random = np.random.default_rng(42)
    training_sequences = random.normal(size=(48, 5, 3)).astype(np.float32)
    training_labels = (training_sequences[:, -1, 0] > 0).astype(np.float32)
    validation_sequences = random.normal(size=(16, 5, 3)).astype(np.float32)
    validation_labels = (validation_sequences[:, -1, 0] > 0).astype(np.float32)

    trained = lstm.train_lstm_classifier(
        training_sequences=training_sequences,
        training_labels=training_labels,
        validation_sequences=validation_sequences,
        validation_labels=validation_labels,
        hidden_size=8,
        num_layers=1,
        dropout=0.0,
        learning_rate=0.01,
        batch_size=16,
        max_epochs=8,
        patience=3,
        seed=42,
    )
    probabilities = lstm.predict_probabilities(trained.model, validation_sequences)

    assert probabilities.shape == (16,)
    assert np.isfinite(probabilities).all()
    assert ((probabilities >= 0.0) & (probabilities <= 1.0)).all()
    assert trained.epochs_trained <= 8