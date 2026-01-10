import { useState } from 'react';
import { MessageSquare, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';
import { SentimentTrendChart } from '../charts/SentimentTrendChart';

const mockHeadlines = [
  { 
    title: "Apple announces record quarterly earnings, beats expectations",
    source: "Bloomberg",
    date: "2024-11-20",
    sentiment: "positive",
    confidence: 0.89,
  },
  { 
    title: "Tech stocks rally as market sentiment improves",
    source: "Reuters",
    date: "2024-11-20",
    sentiment: "positive",
    confidence: 0.76,
  },
  { 
    title: "Federal Reserve signals potential rate changes ahead",
    source: "WSJ",
    date: "2024-11-19",
    sentiment: "neutral",
    confidence: 0.62,
  },
  { 
    title: "Market volatility increases amid economic uncertainty",
    source: "CNBC",
    date: "2024-11-19",
    sentiment: "negative",
    confidence: 0.81,
  },
  { 
    title: "Microsoft cloud services see strong growth in Q3",
    source: "TechCrunch",
    date: "2024-11-18",
    sentiment: "positive",
    confidence: 0.84,
  },
  { 
    title: "Analysts raise concerns over tech sector valuations",
    source: "Financial Times",
    date: "2024-11-18",
    sentiment: "negative",
    confidence: 0.73,
  },
];

export function SentimentAnalyzer() {
  const [usingFallback] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Sentiment Analyzer</h1>
          <p className="text-muted-foreground">
            Headlines sentiment classification and trend analysis
          </p>
        </div>
        {usingFallback && (
          <div className="flex items-center gap-2 px-3 py-2 bg-chart-3/10 text-chart-3 rounded-lg text-sm border border-chart-3/20">
            <AlertCircle className="w-4 h-4" />
            <span>Using VADER fallback</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Positive</span>
            <TrendingUp className="w-5 h-5 text-chart-4" />
          </div>
          <div className="text-2xl font-bold text-foreground">42</div>
          <div className="text-sm text-muted-foreground mt-1">Last 7 days</div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Neutral</span>
            <Minus className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold text-foreground">28</div>
          <div className="text-sm text-muted-foreground mt-1">Last 7 days</div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Negative</span>
            <TrendingDown className="w-5 h-5 text-chart-3" />
          </div>
          <div className="text-2xl font-bold text-foreground">15</div>
          <div className="text-sm text-muted-foreground mt-1">Last 7 days</div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Avg Confidence</span>
            <MessageSquare className="w-5 h-5 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">78%</div>
          <div className="text-sm text-muted-foreground mt-1">All headlines</div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-foreground mb-4">Sentiment Trend</h2>
        <SentimentTrendChart />
      </div>

      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-foreground mb-4">Recent Headlines</h2>
        <div className="space-y-3">
          {mockHeadlines.map((headline, idx) => (
            <div key={idx} className="p-4 bg-accent rounded-lg">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground mb-2">{headline.title}</div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{headline.source}</span>
                    <span>•</span>
                    <span>{headline.date}</span>
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
        </div>
      </div>
    </div>
  );
}
