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
    close = np.linspace(100.0, 145.0, len(index)) + np.sin(np.arange(len(index)) / 7.0)
    return pd.DataFrame(
        {
            "Open": close - 0.25,
            "High": close + 0.75,
            "Low": close - 0.75,
            "Close": close,
            "Volume": 2_000_000 + np.arange(len(index)) * 1_000,
        },
        index=index,
    )


def test_ticker_analysis_returns_market_history_and_metrics(client, market_frame, monkeypatch):
    monkeypatch.setattr(adapter_api.yf, "download", lambda *args, **kwargs: market_frame.copy())

    response = client.get(
        "/api/tickers/aapl",
        query_string={"start_date": "2023-01-02", "end_date": "2024-03-22"},
    )

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["ticker"] == "AAPL"
    assert payload["current_price"] == pytest.approx(float(market_frame["Close"].iloc[-1]))
    assert payload["volume"] == int(market_frame["Volume"].iloc[-1])
    assert len(payload["history"]) == 252
    assert set(payload["history"][0]) == {"date", "close"}
    assert payload["baseline_signal"]["model"] == "momentum_baseline"
    assert payload["baseline_signal"]["label"] in {"LONG", "NEUTRAL", "SHORT"}
    assert 0.0 <= payload["baseline_signal"]["probability"] <= 1.0
    assert math.isfinite(payload["metrics"]["annualized_volatility"])
    assert math.isfinite(payload["metrics"]["momentum_20d"])
    assert {item["factor"] for item in payload["factor_snapshot"]} == {
        "mom_20",
        "vol_20",
        "mr_z_20",
        "corr_spy_20",
        "beta_spy_60",
    }


def test_ticker_analysis_rejects_invalid_symbol(client):
    response = client.get("/api/tickers/NOT_A_VALID_TICKER!")

    assert response.status_code == 422
    assert response.get_json()["error"]["code"] == "validation_error"


def test_ticker_analysis_uses_default_date_range(client, market_frame, monkeypatch):
    monkeypatch.setattr(adapter_api.yf, "download", lambda *args, **kwargs: market_frame.copy())

    response = client.get("/api/tickers/AAPL")

    assert response.status_code == 200