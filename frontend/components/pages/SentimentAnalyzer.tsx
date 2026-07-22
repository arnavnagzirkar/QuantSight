import { useState } from 'react';
import { ExternalLink, MessageSquare, Search, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { SentimentTrendChart } from '../charts/SentimentTrendChart';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { sentimentAPI } from '../../services/api';
import { usePersistentAPI } from '../../hooks/usePersistentAPI';
import { useUserPersistentState } from '../../hooks/usePersistentState';
import type { APIEnvelope, SentimentAnalysis } from '../../types/api';

function sevenDaysAgo() {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date.toISOString().slice(0, 10);
}

export function SentimentAnalyzer() {
  const [ticker, setTicker] = useUserPersistentState('sentiment-analyzer:ticker', 'AAPL');
  const [startDate, setStartDate] = useUserPersistentState('sentiment-analyzer:start-date', sevenDaysAgo);
  const [endDate, setEndDate] = useUserPersistentState('sentiment-analyzer:end-date', () => new Date().toISOString().slice(0, 10));
  const [validationError, setValidationError] = useState<string | null>(null);
  const sentimentRequest = usePersistentAPI<APIEnvelope<SentimentAnalysis>>('sentiment-analyzer', sentimentAPI.getTickerSentiment);
  const analysis = sentimentRequest.data?.data;

  const handleAnalyze = async () => {
    const normalizedTicker = ticker.trim().toUpperCase();
    if (!/^[A-Z0-9.^-]{1,15}$/.test(normalizedTicker)) {
      setValidationError('Enter a valid ticker symbol.');
      return;
    }
    if (startDate > endDate) {
      setValidationError('Start date must be on or before end date.');
      return;
    }

    setTicker(normalizedTicker);
    setValidationError(null);
    await sentimentRequest.execute(normalizedTicker, {
      start_date: startDate,
      end_date: endDate,
      limit: 100,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Sentiment Analyzer</h1>
          <p className="text-muted-foreground">
            Headlines sentiment classification and trend analysis
          </p>
        </div>
        <div className="px-3 py-2 bg-primary/10 text-primary rounded-lg text-sm border border-primary/20">
          VADER classifier
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-4 items-end">
          <div className="space-y-2">
            <Label htmlFor="sentiment-ticker">Ticker</Label>
            <Input
              id="sentiment-ticker"
              value={ticker}
              maxLength={15}
              onChange={(event) => setTicker(event.target.value.toUpperCase())}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sentiment-start-date">Start date</Label>
            <Input
              id="sentiment-start-date"
              type="date"
              value={startDate}
              max={endDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sentiment-end-date">End date</Label>
            <Input
              id="sentiment-end-date"
              type="date"
              value={endDate}
              min={startDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
          <Button onClick={handleAnalyze} disabled={sentimentRequest.loading}>
            <Search className="w-4 h-4 mr-2" />
            {sentimentRequest.loading ? 'Loading...' : 'Analyze'}
          </Button>
        </div>
      </div>

      {(validationError || sentimentRequest.error) && (
        <Alert variant="destructive">
          <AlertDescription>{validationError || sentimentRequest.error?.message}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Positive</span>
            <TrendingUp className="w-5 h-5 text-chart-4" />
          </div>
          <div className="text-2xl font-bold text-foreground">{analysis?.summary.positive ?? 0}</div>
          <div className="text-sm text-muted-foreground mt-1">Last 7 days</div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Neutral</span>
            <Minus className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold text-foreground">{analysis?.summary.neutral ?? 0}</div>
          <div className="text-sm text-muted-foreground mt-1">Last 7 days</div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Negative</span>
            <TrendingDown className="w-5 h-5 text-chart-3" />
          </div>
          <div className="text-2xl font-bold text-foreground">{analysis?.summary.negative ?? 0}</div>
          <div className="text-sm text-muted-foreground mt-1">Last 7 days</div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Avg Confidence</span>
            <MessageSquare className="w-5 h-5 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {analysis ? `${(analysis.summary.average_confidence * 100).toFixed(0)}%` : '0%'}
          </div>
          <div className="text-sm text-muted-foreground mt-1">All headlines</div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-foreground mb-4">Sentiment Trend</h2>
        <SentimentTrendChart data={analysis?.trend ?? []} />
      </div>

      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-foreground mb-4">Recent Headlines</h2>
        <div className="space-y-3">
          {(analysis?.articles ?? []).map((headline) => (
            <div key={headline.url || `${headline.published_at}-${headline.title}`} className="p-4 bg-accent rounded-lg">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <a
                    href={headline.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-foreground mb-2 inline-flex items-start gap-2 hover:text-primary"
                  >
                    <span>{headline.title}</span>
                    <ExternalLink className="w-4 h-4 mt-0.5 shrink-0" />
                  </a>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{headline.source}</span>
                    <span>•</span>
                    <span>{new Date(headline.published_at).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    headline.sentiment === 'positive'
                      ? 'bg-chart-4/10 text-chart-4 border border-chart-4/20'
                      : headline.sentiment === 'negative'
                      ? 'bg-chart-3/10 text-chart-3 border border-chart-3/20'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {headline.sentiment.charAt(0).toUpperCase() + headline.sentiment.slice(1)}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${headline.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-10 text-right">
                      {(headline.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {analysis && analysis.articles.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">No headlines found for this period</div>
          )}
          {!analysis && (
            <div className="text-center py-8 text-muted-foreground">No sentiment analysis yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
