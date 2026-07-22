from datetime import date

import pytest
from flask import Flask

from core import adapter_api
from core import sentiment


@pytest.fixture
def client():
    app = Flask(__name__)
    app.config.update(TESTING=True)
    app.register_blueprint(adapter_api.adapter_bp)
    return app.test_client()


def test_sentiment_service_classifies_articles(monkeypatch):
    monkeypatch.setenv("NEWS_API_KEY", "test-key")

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "status": "ok",
                "articles": [
                    {
                        "title": "Apple reports excellent record growth",
                        "source": {"name": "Example News"},
                        "url": "https://example.com/positive",
                        "publishedAt": "2026-07-20T14:00:00Z",
                    },
                    {
                        "title": "Apple faces severe decline and losses",
                        "source": {"name": "Market Wire"},
                        "url": "https://example.com/negative",
                        "publishedAt": "2026-07-20T18:00:00Z",
                    },
                ],
            }

    monkeypatch.setattr(sentiment.requests, "get", lambda *args, **kwargs: FakeResponse())

    result = sentiment.analyze_ticker_sentiment(
        ticker="AAPL",
        start_date=date(2026, 7, 14),
        end_date=date(2026, 7, 21),
        limit=20,
    )

    assert result["ticker"] == "AAPL"
    assert result["engine"] == "vader"
    assert result["summary"]["total"] == 2
    assert len(result["articles"]) == 2
    assert result["articles"][0]["source"] == "Example News"
    assert result["articles"][0]["url"] == "https://example.com/positive"
    assert result["trend"][0]["date"] == "2026-07-20"
    assert sum(result["trend"][0][key] for key in ("positive", "neutral", "negative")) == 2


def test_sentiment_endpoint_returns_typed_envelope(client, monkeypatch):
    expected = {
        "ticker": "AAPL",
        "engine": "vader",
        "summary": {"positive": 1, "neutral": 0, "negative": 0, "total": 1, "average_confidence": 0.8},
        "articles": [],
        "trend": [],
    }
    monkeypatch.setattr(adapter_api, "analyze_ticker_sentiment", lambda **kwargs: expected)

    response = client.get(
        "/api/sentiment/aapl",
        query_string={"start_date": "2026-07-14", "end_date": "2026-07-21", "limit": 20},
    )

    assert response.status_code == 200
    assert response.get_json()["data"] == expected


def test_sentiment_endpoint_reports_missing_api_key(client, monkeypatch):
    def fail(**kwargs):
        raise sentiment.SentimentConfigurationError("NEWS_API_KEY is not configured")

    monkeypatch.setattr(adapter_api, "analyze_ticker_sentiment", fail)

    response = client.get("/api/sentiment/AAPL")

    assert response.status_code == 503
    assert response.get_json()["error"]["code"] == "sentiment_not_configured"