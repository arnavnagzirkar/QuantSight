import { useState, useEffect } from 'react';
import { MessageSquare, TrendingUp, TrendingDown, Minus, AlertCircle, Search, RefreshCw } from 'lucide-react';
import { SentimentTrendChart } from '../charts/SentimentTrendChart';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

interface Headline {
  headline: string;  // Changed from title to headline to match backend
  sentiment: string;
  confidence: number | string;  // Backend returns string like "75.23%"
  source?: string;
  publishedAt?: string;
}

interface SentimentData {
  stock_info?: {
    ticker: string;
    current_price: string;
  };
  sentiment_analysis?: {
    engine: string;
    total_headlines_analyzed: number;
    details: Headline[];
  };
}

export function SentimentAnalyzer() {
  const [ticker, setTicker] = useState('AAPL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SentimentData | null>(null);
  const [headlines, setHeadlines] = useState<Headline[]>([]);

  const fetchSentiment = async (symbol: string) => {
    console.log('[SentimentAnalyzer] Starting fetch for ticker:', symbol);
    console.log('[SentimentAnalyzer] API Base URL:', API_BASE);
    
    setLoading(true);
    setError(null);
    
    try {
      const url = `${API_BASE}/analyze?ticker=${symbol}`;
      console.log('[SentimentAnalyzer] Fetching from URL:', url);
      
      const response = await fetch(url);
      console.log('[SentimentAnalyzer] Response status:', response.status);
      console.log('[SentimentAnalyzer] Response ok:', response.ok);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('[SentimentAnalyzer] Error response:', errorData);
        throw new Error(errorData.error || 'Failed to fetch sentiment data');
      }
      
      const result: SentimentData = await response.json();
      console.log('[SentimentAnalyzer] Success! Received data:', result);
      console.log('[SentimentAnalyzer] Headlines count:', result.sentiment_analysis?.details?.length || 0);
      
      setData(result);
      setHeadlines(result.sentiment_analysis?.details || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      console.error('[SentimentAnalyzer] Fetch error:', err);
      console.error('[SentimentAnalyzer] Error message:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
      console.log('[SentimentAnalyzer] Fetch complete');
    }
  };

  useEffect(() => {
    console.log('[SentimentAnalyzer] Component mounted, auto-fetching for:', ticker);
    fetchSentiment(ticker);
  }, []);

  const handleSearch = () => {
    if (ticker.trim()) {
      fetchSentiment(ticker.toUpperCase().trim());
    }
  };

  const sentimentCounts = headlines.reduce(
    (acc, h) => {
      if (h.sentiment === 'positive' || h.sentiment === 'POSITIVE') acc.positive++;
      else if (h.sentiment === 'negative' || h.sentiment === 'NEGATIVE') acc.negative++;
      else acc.neutral++;
      return acc;
    },
    { positive: 0, negative: 0, neutral: 0 }
  );

  // Parse confidence - backend returns string like "75.23%" or number
  const parseConfidence = (conf: number | string): number => {
    if (typeof conf === 'string') {
      return parseFloat(conf.replace('%', '')) || 0;
    }
    return conf * 100;
  };

  // Format date to readable format
  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const avgConfidence = headlines.length > 0
    ? Math.round(headlines.reduce((sum, h) => sum + parseConfidence(h.confidence), 0) / headlines.length)
    : 0;

  const usingFallback = data?.sentiment_analysis?.engine === 'VADER';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Sentiment Analyzer</h1>
          <p className="text-muted-foreground">
            Real-time news sentiment analysis powered by NewsAPI
          </p>
        </div>
        {usingFallback && (
          <div className="flex items-center gap-2 px-3 py-2 bg-chart-3/10 text-chart-3 rounded-lg text-sm border border-chart-3/20">
            <AlertCircle className="w-4 h-4" />
            <span>Using VADER fallback</span>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Enter ticker symbol (e.g., AAPL, TSLA, MSFT)"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={loading}>
            {loading ? (
              <>Loading...</>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Analyze
              </>
            )}
          </Button>
        </div>
        {error && (
          <div className="mt-2 text-sm text-chart-3">
            <AlertCircle className="w-4 h-4 inline mr-1" />
            {error}
          </div>
        )}
      </div>

      {data?.stock_info && (
        <div className="bg-accent border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-muted-foreground">Analyzing: </span>
              <span className="font-bold text-foreground">{data.stock_info.ticker}</span>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Current Price: </span>
              <span className="font-bold text-foreground">{data.stock_info.current_price}</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Positive</span>
            <TrendingUp className="w-5 h-5 text-chart-4" />
          </div>
          <div className="text-2xl font-bold text-foreground">{sentimentCounts.positive}</div>
          <div className="text-sm text-muted-foreground mt-1">Headlines</div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Neutral</span>
            <Minus className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold text-foreground">{sentimentCounts.neutral}</div>
          <div className="text-sm text-muted-foreground mt-1">Headlines</div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Negative</span>
            <TrendingDown className="w-5 h-5 text-chart-3" />
          </div>
          <div className="text-2xl font-bold text-foreground">{sentimentCounts.negative}</div>
          <div className="text-sm text-muted-foreground mt-1">Headlines</div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Avg Confidence</span>
            <MessageSquare className="w-5 h-5 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">{avgConfidence}%</div>
          <div className="text-sm text-muted-foreground mt-1">All headlines</div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-foreground mb-4">Sentiment Trend</h2>
        <SentimentTrendChart />
      </div>

      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">
            Recent Headlines {headlines.length > 0 && `(${headlines.length})`}
          </h2>
          {data?.stock_info && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fetchSentiment(data.stock_info!.ticker)}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
        </div>
        
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading headlines...
          </div>
        ) : headlines.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No headlines found. Try searching for a ticker symbol.
          </div>
        ) : (
          <div className="space-y-3">
            {headlines.map((headline, idx) => {
              const sentiment = headline.sentiment.toLowerCase();
              const confidence = parseConfidence(headline.confidence);
              
              return (
                <div key={idx} className="p-4 bg-accent rounded-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground mb-2">{headline.headline}</div>
                      {(headline.source || headline.publishedAt) && (
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          {headline.source && <span>{headline.source}</span>}
                          {headline.source && headline.publishedAt && <span>•</span>}
                          {headline.publishedAt && <span>{formatDate(headline.publishedAt)}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        sentiment === 'positive' 
                          ? 'bg-chart-4/10 text-chart-4 border border-chart-4/20'
                          : sentiment === 'negative'
                          ? 'bg-chart-3/10 text-chart-3 border border-chart-3/20'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary"
                            style={{ width: `${Math.min(confidence, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-10 text-right">
                          {confidence.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}