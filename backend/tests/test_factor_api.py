import math

import numpy as np
import pandas as pd
import pytest
from flask import Flask

from core import adapter_api


@pytest.fixture
def client():
    app = Flask(__name__)
    app.config.update(TESTING=True)
    app.register_blueprint(adapter_api.adapter_bp)
    return app.test_client()


@pytest.fixture
def market_frame():
    index = pd.date_range("2023-01-02", periods=320, freq="B")
    trend = np.linspace(100.0, 140.0, len(index))
    cycle = np.sin(np.arange(len(index)) / 8.0)
    close = trend + cycle
    return pd.DataFrame(
        {
            "Open": close - 0.2,
            "High": close + 0.8,
            "Low": close - 0.8,
            "Close": close,
            "Volume": 1_000_000 + np.arange(len(index)) * 100,
        },
        index=index,
    )


def test_compute_factors_returns_typed_analysis(client, market_frame, monkeypatch):
    calls = []

    def fake_download(ticker, **kwargs):
        calls.append((ticker, kwargs))
        return market_frame.copy()

    monkeypatch.setattr(adapter_api.yf, "download", fake_download)

    response = client.post(
        "/api/factors/compute",
        json={
            "ticker": "aapl",
            "start_date": "2023-01-02",
            "end_date": "2024-03-22",
            "rows": 25,
            "factors": ["mom_20", "vol_20", "mr_z_20"],
            "include_pca": True,
        },
    )

    assert response.status_code == 200
    payload = response.get_json()
    data = payload["data"]
    assert data["ticker"] == "AAPL"
    assert data["columns"] == ["mom_20", "vol_20", "mr_z_20"]
    assert data["rows_returned"] == 25
    assert len(data["records"]) == 25
    assert set(data["records"][0]) == {"date", *data["columns"]}
    assert data["pca"]["n_features"] == 3
    assert data["correlation"]["labels"] == data["columns"]
    assert len(data["correlation"]["matrix"]) == 3
    assert payload["meta"]["duration_ms"] >= 0
    assert any(kwargs.get("end") is not None for _, kwargs in calls)

    for record in data["records"]:
        for factor in data["columns"]:
            value = record[factor]
            assert value is None or math.isfinite(value)


def test_compute_factors_rejects_invalid_date_range(client):
    response = client.post(
        "/api/factors/compute",
        json={
            "ticker": "AAPL",
            "start_date": "2025-01-01",
            "end_date": "2024-01-01",
        },
    )

    assert response.status_code == 422
    payload = response.get_json()
    assert payload["error"]["code"] == "validation_error"
    assert payload["error"]["message"] == "Request validation failed"