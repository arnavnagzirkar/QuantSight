import { useState } from 'react';
import { Play, Square } from 'lucide-react';

import { TickerMultiSelect } from '../TickerMultiSelect';
import { JobHistorySelect } from '../JobHistorySelect';
import { AttributionChart } from '../charts/AttributionChart';
import { EquityCurveChart } from '../charts/EquityCurveChart';
import { PortfolioWeightsChart } from '../charts/PortfolioWeightsChart';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Progress } from '../ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useRestorableJob } from '../../hooks/useRestorableJob';
import { useUserPersistentState } from '../../hooks/usePersistentState';
import { portfolioAPI } from '../../services/api';
import type { PortfolioRunRequest, PortfolioRunSummary } from '../../types/api';

type AllocationMethod = PortfolioRunRequest['allocation_method'];
type Rebalance = PortfolioRunRequest['rebalance'];

export function PortfolioLab() {
  const [name, setName] = useUserPersistentState('portfolio-lab:name', 'Core Research Portfolio');
  const [tickers, setTickers] = useUserPersistentState('portfolio-lab:tickers', ['AAPL', 'MSFT', 'GOOGL']);
  const [startDate, setStartDate] = useUserPersistentState('portfolio-lab:start-date', '2022-01-01');
  const [endDate, setEndDate] = useUserPersistentState('portfolio-lab:end-date', () => new Date().toISOString().slice(0, 10));
  const [signal, setSignal] = useUserPersistentState('portfolio-lab:signal', 'mom_20');
  const [allocationMethod, setAllocationMethod] = useUserPersistentState<AllocationMethod>('portfolio-lab:allocation-method', 'equal_weight');
  const [rebalance, setRebalance] = useUserPersistentState<Rebalance>('portfolio-lab:rebalance', 'weekly');
  const [costBps, setCostBps] = useUserPersistentState('portfolio-lab:cost-bps', 5);
  const [benchmark, setBenchmark] = useUserPersistentState('portfolio-lab:benchmark', 'SPY');
  const [quantiles, setQuantiles] = useUserPersistentState('portfolio-lab:quantiles', 5);
  const [longQuantile, setLongQuantile] = useUserPersistentState('portfolio-lab:long-quantile', 5);
  const [shortQuantile, setShortQuantile] = useUserPersistentState('portfolio-lab:short-quantile', 1);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { jobId, setJobId, job, history, error: jobError, cancel } = useRestorableJob('portfolio-lab', 'portfolio_run');
  const result = isPortfolioResult(job?.result_summary) ? job.result_summary : null;
  const running = submitting || ['queued', 'running', 'cancel_requested'].includes(job?.status ?? '');

  const handleRun = async () => {
    const normalizedBenchmark = benchmark.trim().toUpperCase();
    if (!name.trim() || tickers.length === 0 || !/^[A-Z0-9.^-]{1,15}$/.test(normalizedBenchmark)) {
      setFormError('Enter a name, at least one ticker, and a valid benchmark.');
      return;
    }
    if (startDate > endDate) {
      setFormError('Start date must be on or before end date.');
      return;
    }
    if (allocationMethod === 'quantile' && (longQuantile > quantiles || shortQuantile > quantiles || longQuantile === shortQuantile)) {
      setFormError('Choose distinct long and short quantiles within the selected count.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setBenchmark(normalizedBenchmark);
    try {
      const response = await portfolioAPI.createPortfolioRun({
        name: name.trim(),
        tickers,
        start_date: startDate,
        end_date: endDate,
        signal,
        allocation_method: allocationMethod,
        rebalance,
        cost_bps: costBps,
        benchmark: normalizedBenchmark,
        n_quantiles: quantiles,
        long_quantile: longQuantile,
        short_quantile: shortQuantile,
      }, `${tickers.join('-')}-${allocationMethod}-${signal}-${Date.now()}`);
      setJobId(response.data.id);
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : 'Unable to start portfolio run');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Portfolio Lab</h1>
          <p className="text-muted-foreground">Construct and evaluate multi-ticker portfolios with real historical weights</p>
        </div>
        <div className="flex gap-3">
          {running && jobId && (
            <Button variant="outline" onClick={() => void cancel()} disabled={job?.status === 'cancel_requested'}>
              <Square className="w-4 h-4 mr-2" />
              {job?.status === 'cancel_requested' ? 'Cancelling...' : 'Cancel'}
            </Button>
          )}
          <Button onClick={handleRun} disabled={running}>
            <Play className="w-4 h-4 mr-2" />
            {running ? 'Running...' : 'Run portfolio'}
          </Button>
        </div>
      </div>

      {(formError || jobError || job?.status === 'failed') && (
        <Alert variant="destructive">
          <AlertDescription>{formError || jobError?.message || job?.error_message || 'Portfolio run failed'}</AlertDescription>
        </Alert>
      )}

      <JobHistorySelect jobs={history} label="Saved portfolio runs" value={jobId} onValueChange={setJobId} />

      <Card className="p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <TextInput id="portfolio-name" label="Name" value={name} onChange={setName} />
          <TextInput id="portfolio-start" label="Start date" type="date" value={startDate} onChange={setStartDate} />
          <TextInput id="portfolio-end" label="End date" type="date" value={endDate} onChange={setEndDate} />
          <TextInput id="portfolio-benchmark" label="Benchmark" value={benchmark} onChange={value => setBenchmark(value.toUpperCase())} />
          <SelectInput label="Signal" value={signal} onChange={setSignal} options={[
            ['mom_20', '20-day momentum'], ['mr_z_20', '20-day mean reversion'], ['vol_20', '20-day volatility'], ['prob_up_1d', 'XGBoost probability'],
          ]} />
          <SelectInput label="Allocation" value={allocationMethod} onChange={value => setAllocationMethod(value as AllocationMethod)} options={[
            ['equal_weight', 'Equal Weight'], ['risk_parity', 'Risk Parity'], ['mean_variance', 'Mean Variance'], ['signal_weighted', 'Signal Weighted'], ['quantile', 'Quantile Long / Short'],
          ]} />
          <SelectInput label="Rebalance" value={rebalance} onChange={value => setRebalance(value as Rebalance)} options={[
            ['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly'],
          ]} />
          <NumberInput id="portfolio-cost" label="Transaction cost (bps)" value={costBps} min={0} max={1000} onChange={setCostBps} />
        </div>
        <div className="space-y-2">
          <Label>Tickers</Label>
          <TickerMultiSelect value={tickers} onChange={setTickers} />
        </div>
        {allocationMethod === 'quantile' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <NumberInput id="quantile-count" label="Quantiles" value={quantiles} min={2} max={20} onChange={setQuantiles} />
            <NumberInput id="long-quantile" label="Long quantile" value={longQuantile} min={1} max={quantiles} onChange={setLongQuantile} />
            <NumberInput id="short-quantile" label="Short quantile" value={shortQuantile} min={1} max={quantiles} onChange={setShortQuantile} />
          </div>
        )}
      </Card>

      {job && (
        <Card className="p-6 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold capitalize">{job.status.replace('_', ' ')}</h2>
              <p className="text-sm text-muted-foreground">{job.progress_phase || 'Waiting for worker'}</p>
            </div>
            <span className="font-mono text-sm">{job.progress_percent}%</span>
          </div>
          <Progress value={job.progress_percent} />
        </Card>
      )}

      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              ['sharpe', 'Sharpe'], ['cagr', 'CAGR'], ['max_drawdown', 'Max Drawdown'], ['turnover_annual', 'Annual Turnover'],
            ].map(([key, label]) => (
              <Card key={key} className="p-5">
                <div className="text-sm text-muted-foreground mb-1">{label}</div>
                <div className="text-2xl font-bold">{formatMetric(key, result.metrics[key])}</div>
              </Card>
            ))}
          </div>
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Portfolio vs Benchmark</h2>
            <EquityCurveChart data={mergeCurves(result)} />
          </Card>
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Weights Evolution</h2>
            <PortfolioWeightsChart data={result.weight_history} />
          </Card>
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Recent Return Attribution</h2>
            <AttributionChart data={result.attribution} />
          </Card>
        </>
      )}
    </div>
  );
}

function isPortfolioResult(value: unknown): value is PortfolioRunSummary {
  return Boolean(value && typeof value === 'object' && 'weight_history' in value && 'attribution' in value);
}

function mergeCurves(result: PortfolioRunSummary) {
  const benchmark = new Map(result.benchmark_curve.map(point => [point.date, point.value]));
  return result.equity_curve.map(point => ({ date: point.date, strategy: point.value, benchmark: benchmark.get(point.date) }));
}

function TextInput({ id, label, onChange, type = 'text', value }: { id: string; label: string; onChange: (value: string) => void; type?: string; value: string }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} type={type} value={value} onChange={event => onChange(event.target.value)} /></div>;
}

function NumberInput({ id, label, max, min, onChange, value }: { id: string; label: string; max: number; min: number; onChange: (value: number) => void; value: number }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} type="number" min={min} max={max} value={value} onChange={event => onChange(Number(event.target.value))} /></div>;
}

function SelectInput({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: string[][]; value: string }) {
  return <div className="space-y-2"><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map(([option, text]) => <SelectItem key={option} value={option}>{text}</SelectItem>)}</SelectContent></Select></div>;
}

function formatMetric(key: string, value: number | null | undefined) {
  if (value === null || value === undefined) return '-';
  if (['cagr', 'max_drawdown', 'turnover_annual'].includes(key)) return `${(value * 100).toFixed(1)}%`;
  return value.toFixed(2);
}