import { useState } from 'react';
import { Play, Download, FlaskConical } from 'lucide-react';
import { FactorTable } from '../FactorTable';
import { PCAChart } from '../charts/PCAChart';
import { CorrelationHeatmap } from '../charts/CorrelationHeatmap';
import { Alert, AlertDescription } from '../ui/alert';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { factorAPI } from '../../services/api';
import { usePersistentAPI } from '../../hooks/usePersistentAPI';
import { useUserPersistentState } from '../../hooks/usePersistentState';
import type { APIEnvelope, FactorAnalysis } from '../../types/api';

const DEFAULT_FACTORS = ['mom_20', 'vol_20', 'mr_z_20', 'corr_spy_20', 'beta_spy_60', 'ret_skew_20'];

export function FactorExplorer() {
  const [ticker, setTicker] = useUserPersistentState('factor-explorer:ticker', 'AAPL');
  const [startDate, setStartDate] = useUserPersistentState('factor-explorer:start-date', '2022-01-01');
  const [endDate, setEndDate] = useUserPersistentState('factor-explorer:end-date', () => new Date().toISOString().slice(0, 10));
  const [showPCA, setShowPCA] = useUserPersistentState('factor-explorer:show-pca', true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const analysisRequest = usePersistentAPI<APIEnvelope<FactorAnalysis>>('factor-explorer', factorAPI.computeFactors);
  const analysis = analysisRequest.data?.data;

  const handleComputeFactors = async () => {
    const normalizedTicker = ticker.trim().toUpperCase();
    if (!/^[A-Z0-9.^-]{1,15}$/.test(normalizedTicker)) {
      setValidationError('Enter a valid ticker symbol.');
      return;
    }
    if (endDate && startDate > endDate) {
      setValidationError('Start date must be on or before end date.');
      return;
    }

    setTicker(normalizedTicker);
    setValidationError(null);
    await analysisRequest.execute({
      ticker: normalizedTicker,
      start_date: startDate,
      end_date: endDate || undefined,
      rows: 100,
      factors: DEFAULT_FACTORS,
      include_pca: showPCA,
    });
  };

  const handleExport = () => {
    if (!analysis?.records.length) return;
    const columns = ['date', ...analysis.columns];
    const csv = [
      columns.join(','),
      ...analysis.records.map(record => columns.map(column => record[column] ?? '').join(',')),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${analysis.ticker.toLowerCase()}-factors.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Factor Explorer</h1>
          <p className="text-muted-foreground">
            Preview and analyze alpha factors with PCA diagnostics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input 
              type="checkbox" 
              checked={showPCA}
              onChange={(e) => setShowPCA(e.target.checked)}
              className="rounded border-border"
            />
            Show PCA Diagnostics
          </label>
          <button
            onClick={handleComputeFactors}
            disabled={analysisRequest.loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {analysisRequest.loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Computing...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Compute Factors</span>
              </>
            )}
          </button>
          <button
            onClick={handleExport}
            disabled={!analysis?.records.length}
            className="flex items-center gap-2 px-4 py-2 border border-border text-foreground rounded-lg hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="factor-ticker">Ticker</Label>
            <Input
              id="factor-ticker"
              value={ticker}
              onChange={(event) => setTicker(event.target.value.toUpperCase())}
              maxLength={15}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="factor-start-date">Start date</Label>
            <Input
              id="factor-start-date"
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="factor-end-date">End date</Label>
            <Input
              id="factor-end-date"
              type="date"
              value={endDate}
              min={startDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
        </div>
      </div>

      {(validationError || analysisRequest.error) && (
        <Alert variant="destructive">
          <AlertDescription>{validationError || analysisRequest.error?.message}</AlertDescription>
        </Alert>
      )}

      {showPCA && analysis?.pca && !analysis.pca.error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-4">PCA Explained Variance</h3>
            <PCAChart explainedVariance={analysis.pca.explained_variance_ratio} />
          </div>
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-4">Factor Correlation Heatmap</h3>
            <CorrelationHeatmap labels={analysis.correlation.labels} matrix={analysis.correlation.matrix} />
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Factor Matrix</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{analysis?.rows_returned ?? 0} rows</span>
            <span className="text-sm text-muted-foreground">•</span>
            <span className="text-sm text-muted-foreground">{analysis?.columns.length ?? 0} columns</span>
          </div>
        </div>
        <FactorTable
          data={analysis?.records ?? []}
          columns={analysis ? ['date', ...analysis.columns] : undefined}
        />
      </div>

      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-foreground mb-4">Factor Definitions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FactorDefinition 
            name="mom_20"
            formula="close / close.shift(20) - 1"
            description="20-day price momentum"
          />
          <FactorDefinition 
            name="vol_20"
            formula="log_returns.rolling(20).std()"
            description="20-day daily volatility"
          />
          <FactorDefinition 
            name="mr_z_20"
            formula="(close - rolling_mean) / rolling_std"
            description="20-day mean-reversion z-score"
          />
          <FactorDefinition 
            name="boll_bw_20"
            formula="4 * rolling_std / rolling_mean"
            description="Bollinger Band width ratio"
          />
        </div>
      </div>
    </div>
  );
}

function FactorDefinition({ name, formula, description }: { name: string; formula: string; description: string }) {
  return (
    <div className="p-4 bg-accent rounded-lg">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <FlaskConical className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-foreground mb-1">{name}</div>
          <div className="text-xs font-mono text-muted-foreground mb-2 break-all">{formula}</div>
          <div className="text-sm text-muted-foreground">{description}</div>
        </div>
      </div>
    </div>
  );
}
