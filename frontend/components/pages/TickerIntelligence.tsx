import { useState } from 'react';
import { Search } from 'lucide-react';
import { PriceHistoryChart } from '../charts/PriceHistoryChart';
import { FactorTable } from '../FactorTable';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { tickerAPI } from '../../services/api';
import { usePersistentAPI } from '../../hooks/usePersistentAPI';
import { useUserPersistentState } from '../../hooks/usePersistentState';
import type { APIEnvelope, TickerAnalysis } from '../../types/api';

function defaultStartDate() {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return date.toISOString().slice(0, 10);
}

export function TickerIntelligence() {
  const [ticker, setTicker] = useUserPersistentState('ticker-intelligence:ticker', 'AAPL');
  const [startDate, setStartDate] = useUserPersistentState('ticker-intelligence:start-date', defaultStartDate);
  const [endDate, setEndDate] = useUserPersistentState('ticker-intelligence:end-date', () => new Date().toISOString().slice(0, 10));
  const [validationError, setValidationError] = useState<string | null>(null);
  const tickerRequest = usePersistentAPI<APIEnvelope<TickerAnalysis>>('ticker-intelligence', tickerAPI.getTickerData);
  const analysis = tickerRequest.data?.data;

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
    await tickerRequest.execute(normalizedTicker, {
      start_date: startDate,
      end_date: endDate,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Ticker Intelligence</h1>
        <p className="text-muted-foreground">
          Deep dive into ticker price action, sentiment, and factor snapshot
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-4 items-end">
          <div className="space-y-2">
            <Label htmlFor="ticker-symbol">Ticker</Label>
            <Input
              id="ticker-symbol"
              value={ticker}
              maxLength={15}
              onChange={(event) => setTicker(event.target.value.toUpperCase())}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ticker-start-date">Start date</Label>
            <Input
              id="ticker-start-date"
              type="date"
              value={startDate}
              max={endDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ticker-end-date">End date</Label>
            <Input
              id="ticker-end-date"
              type="date"
              value={endDate}
              min={startDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
          <Button onClick={handleAnalyze} disabled={tickerRequest.loading}>
            <Search className="w-4 h-4 mr-2" />
            {tickerRequest.loading ? 'Loading...' : 'Analyze'}
          </Button>
        </div>
      </div>

      {(validationError || tickerRequest.error) && (
        <Alert variant="destructive">
          <AlertDescription>{validationError || tickerRequest.error?.message}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="text-sm text-muted-foreground mb-1">Current Price</div>
          <div className="text-2xl font-bold text-foreground">
            {analysis ? `$${analysis.current_price.toFixed(2)}` : '-'}
          </div>
          <div className={`text-sm mt-1 ${(analysis?.price_change_pct ?? 0) >= 0 ? 'text-chart-4' : 'text-chart-3'}`}>
            {analysis ? `${analysis.price_change_pct >= 0 ? '+' : ''}${(analysis.price_change_pct * 100).toFixed(2)}%` : 'No analysis'}
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="text-sm text-muted-foreground mb-1">Model Signal</div>
          <div className="text-2xl font-bold text-foreground">{analysis?.baseline_signal.label ?? '-'}</div>
          <div className="text-sm text-muted-foreground mt-1">
            {analysis ? `${(analysis.baseline_signal.probability * 100).toFixed(0)}% momentum baseline` : 'No analysis'}
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="text-sm text-muted-foreground mb-1">20D Volatility</div>
          <div className="text-2xl font-bold text-foreground">
            {analysis ? `${(analysis.metrics.annualized_volatility * 100).toFixed(1)}%` : '-'}
          </div>
          <div className="text-sm text-muted-foreground mt-1">Annualized</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="text-sm text-muted-foreground mb-1">20D Momentum</div>
          <div className="text-2xl font-bold text-foreground">
            {analysis ? `${(analysis.metrics.momentum_20d * 100).toFixed(1)}%` : '-'}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {analysis?.volume ? `${analysis.volume.toLocaleString()} volume` : 'No analysis'}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-foreground mb-4">Price History</h2>
        <PriceHistoryChart data={analysis?.history ?? []} />
      </div>

      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-foreground mb-4">Latest Factor Snapshot</h2>
        <FactorTable data={analysis?.factor_snapshot ?? []} columns={['factor', 'value']} />
      </div>
    </div>
  );
}
