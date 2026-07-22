from dataclasses import dataclass
import copy
import random

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset


@dataclass(frozen=True)
class FeatureScaler:
    mean: np.ndarray
    scale: np.ndarray

    @classmethod
    def fit(cls, values: np.ndarray) -> "FeatureScaler":
        array = np.asarray(values, dtype=np.float64)
        if array.ndim != 2 or len(array) == 0:
            raise ValueError("Feature scaling requires a non-empty 2D array")
        mean = np.nanmean(array, axis=0)
        scale = np.nanstd(array, axis=0)
        mean = np.where(np.isfinite(mean), mean, 0.0)
        scale = np.where(np.isfinite(scale) & (scale > 1e-12), scale, 1.0)
        return cls(mean=mean, scale=scale)

    def transform(self, values: np.ndarray) -> np.ndarray:
        array = np.asarray(values, dtype=np.float64)
        transformed = (array - self.mean) / self.scale
        return np.where(np.isfinite(transformed), transformed, 0.0).astype(np.float32)

    def to_dict(self) -> dict:
        return {
            "mean": self.mean.astype(float).tolist(),
            "scale": self.scale.astype(float).tolist(),
        }


def build_training_sequences(
    feature_values: np.ndarray,
    labels: np.ndarray,
    sequence_length: int,
) -> tuple[np.ndarray, np.ndarray]:
    features = np.asarray(feature_values, dtype=np.float32)
    targets = np.asarray(labels, dtype=np.float32)
    if features.ndim != 2 or targets.ndim != 1 or len(features) != len(targets):
        raise ValueError("Features and labels must have aligned 2D and 1D shapes")
    if sequence_length < 2:
        raise ValueError("sequence_length must be at least 2")
    if len(features) < sequence_length:
        return (
            np.empty((0, sequence_length, features.shape[1]), dtype=np.float32),
            np.empty((0,), dtype=np.float32),
        )

    sequences = np.stack([
        features[index - sequence_length + 1:index + 1]
        for index in range(sequence_length - 1, len(features))
    ])
    sequence_labels = targets[sequence_length - 1:]
    return sequences.astype(np.float32), sequence_labels.astype(np.float32)


def build_prediction_sequences(
    history_values: np.ndarray,
    prediction_values: np.ndarray,
    sequence_length: int,
) -> np.ndarray:
    history = np.asarray(history_values, dtype=np.float32)
    prediction = np.asarray(prediction_values, dtype=np.float32)
    if history.ndim != 2 or prediction.ndim != 2 or history.shape[1] != prediction.shape[1]:
        raise ValueError("History and prediction features must be compatible 2D arrays")
    if sequence_length < 2 or len(history) < sequence_length - 1:
        raise ValueError("Insufficient history for the requested sequence length")
    if len(prediction) == 0:
        return np.empty((0, sequence_length, history.shape[1]), dtype=np.float32)

    combined = np.concatenate([history, prediction], axis=0)
    history_length = len(history)
    sequences = [
        combined[history_length + offset - sequence_length + 1:history_length + offset + 1]
        for offset in range(len(prediction))
    ]
    return np.stack(sequences).astype(np.float32)


class LSTMClassifier(nn.Module):
    def __init__(
        self,
        input_size: int,
        hidden_size: int = 64,
        num_layers: int = 1,
        dropout: float = 0.0,
    ):
        super().__init__()
        recurrent_dropout = dropout if num_layers > 1 else 0.0
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            dropout=recurrent_dropout,
            batch_first=True,
        )
        self.dropout = nn.Dropout(dropout)
        self.output = nn.Linear(hidden_size, 1)

    def forward(self, values: torch.Tensor) -> torch.Tensor:
        encoded, _ = self.lstm(values)
        return self.output(self.dropout(encoded[:, -1, :])).squeeze(-1)


@dataclass
class LSTMTrainingResult:
    model: LSTMClassifier
    epochs_trained: int
    validation_loss: float


def _set_deterministic_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.use_deterministic_algorithms(True, warn_only=True)


def train_lstm_classifier(
    training_sequences: np.ndarray,
    training_labels: np.ndarray,
    validation_sequences: np.ndarray,
    validation_labels: np.ndarray,
    *,
    hidden_size: int = 64,
    num_layers: int = 1,
    dropout: float = 0.0,
    learning_rate: float = 0.001,
    batch_size: int = 32,
    max_epochs: int = 50,
    patience: int = 8,
    seed: int = 42,
) -> LSTMTrainingResult:
    train_x = np.asarray(training_sequences, dtype=np.float32)
    train_y = np.asarray(training_labels, dtype=np.float32)
    valid_x = np.asarray(validation_sequences, dtype=np.float32)
    valid_y = np.asarray(validation_labels, dtype=np.float32)
    if train_x.ndim != 3 or valid_x.ndim != 3 or train_x.shape[2] != valid_x.shape[2]:
        raise ValueError("LSTM training requires compatible 3D sequence arrays")
    if len(train_x) == 0 or len(valid_x) == 0:
        raise ValueError("Training and validation sequences cannot be empty")
    if len(train_x) != len(train_y) or len(valid_x) != len(valid_y):
        raise ValueError("Sequence and label counts must match")

    _set_deterministic_seed(seed)
    model = LSTMClassifier(
        input_size=train_x.shape[2],
        hidden_size=hidden_size,
        num_layers=num_layers,
        dropout=dropout,
    )
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)

    positive_count = float(train_y.sum())
    negative_count = float(len(train_y) - positive_count)
    positive_weight = (
        negative_count / positive_count
        if positive_count > 0 and negative_count > 0
        else 1.0
    )
    loss_function = nn.BCEWithLogitsLoss(pos_weight=torch.tensor(positive_weight, dtype=torch.float32))

    generator = torch.Generator().manual_seed(seed)
    loader = DataLoader(
        TensorDataset(torch.from_numpy(train_x), torch.from_numpy(train_y)),
        batch_size=min(batch_size, len(train_x)),
        shuffle=True,
        generator=generator,
    )
    validation_x = torch.from_numpy(valid_x)
    validation_y = torch.from_numpy(valid_y)

    best_state = copy.deepcopy(model.state_dict())
    best_loss = float("inf")
    stale_epochs = 0
    epochs_trained = 0

    for epoch in range(max_epochs):
        model.train()
        for batch_x, batch_y in loader:
            optimizer.zero_grad(set_to_none=True)
            loss = loss_function(model(batch_x), batch_y)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()

        model.eval()
        with torch.no_grad():
            validation_loss = float(loss_function(model(validation_x), validation_y).item())
        epochs_trained = epoch + 1

        if validation_loss < best_loss - 1e-6:
            best_loss = validation_loss
            best_state = copy.deepcopy(model.state_dict())
            stale_epochs = 0
        else:
            stale_epochs += 1
            if stale_epochs >= patience:
                break

    model.load_state_dict(best_state)
    model.eval()
    return LSTMTrainingResult(
        model=model,
        epochs_trained=epochs_trained,
        validation_loss=best_loss,
    )


def predict_probabilities(model: LSTMClassifier, sequences: np.ndarray) -> np.ndarray:
    values = np.asarray(sequences, dtype=np.float32)
    if values.ndim != 3:
        raise ValueError("Prediction requires a 3D sequence array")
    if len(values) == 0:
        return np.empty((0,), dtype=np.float32)
    model.eval()
    with torch.no_grad():
        logits = model(torch.from_numpy(values))
        return torch.sigmoid(logits).cpu().numpy().astype(np.float64)