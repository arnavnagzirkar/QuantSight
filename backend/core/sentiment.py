from collections import defaultdict
from datetime import date, datetime
import os

import requests
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer


class SentimentConfigurationError(RuntimeError):
    pass


class SentimentUpstreamError(RuntimeError):
    pass


_analyzer = SentimentIntensityAnalyzer()


def _classify(title: str) -> tuple[str, float, float]:
    score = float(_analyzer.polarity_scores(title)["compound"])
    label = "positive" if score >= 0.05 else "negative" if score <= -0.05 else "neutral"
    return label, abs(score), score


def analyze_ticker_sentiment(
    ticker: str,
    start_date: date,
    end_date: date,
    limit: int = 50,
) -> dict:
    api_key = os.getenv("NEWS_API_KEY")
    if not api_key:
        raise SentimentConfigurationError("NEWS_API_KEY is not configured")

    try:
        response = requests.get(
            "https://newsapi.org/v2/everything",
            params={
                "q": ticker,
                "from": start_date.isoformat(),
                "to": end_date.isoformat(),
                "language": "en",
                "sortBy": "publishedAt",
                "pageSize": limit,
                "apiKey": api_key,
            },
            timeout=15,
        )
        response.raise_for_status()
        payload = response.json()
    except (requests.RequestException, ValueError) as error:
        raise SentimentUpstreamError("NewsAPI request failed") from error

    if payload.get("status") == "error":
        raise SentimentUpstreamError(payload.get("message") or "NewsAPI request failed")

    articles = []
    counts = {"positive": 0, "neutral": 0, "negative": 0}
    trend = defaultdict(lambda: {"positive": 0, "neutral": 0, "negative": 0})
    confidences = []

    for raw_article in payload.get("articles", [])[:limit]:
        title = str(raw_article.get("title") or "").strip()
        published_at = str(raw_article.get("publishedAt") or "").strip()
        if not title or not published_at:
            continue

        try:
            published = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
        except ValueError:
            continue

        label, confidence, score = _classify(title)
        counts[label] += 1
        trend[published.date().isoformat()][label] += 1
        confidences.append(confidence)
        source = raw_article.get("source") or {}
        articles.append({
            "title": title,
            "source": str(source.get("name") or "Unknown source"),
            "url": str(raw_article.get("url") or ""),
            "published_at": published.isoformat(),
            "sentiment": label,
            "confidence": confidence,
            "score": score,
        })

    trend_records = [
        {"date": day, **trend[day]}
        for day in sorted(trend)
    ]
    return {
        "ticker": ticker,
        "engine": "vader",
        "summary": {
            **counts,
            "total": len(articles),
            "average_confidence": sum(confidences) / len(confidences) if confidences else 0.0,
        },
        "articles": articles,
        "trend": trend_records,
    }