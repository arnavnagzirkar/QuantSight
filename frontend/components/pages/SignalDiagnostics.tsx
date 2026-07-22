import { useState } from 'react';
import { Play, Square } from 'lucide-react';

import { LongShortEquityChart } from '../charts/LongShortEquityChart';
import { JobHistorySelect } from '../JobHistorySelect';
import { QuantileReturnsChart } from '../charts/QuantileReturnsChart';
import { SignalDecayChart } from '../charts/SignalDecayChart';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Progress } from '../ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { useRestorableJob } from '../../hooks/useRestorableJob';
import { useUserPersistentState } from '../../hooks/usePersistentState';
import { signalAPI } from '../../services/api';
import type { SignalAnalysisRequest, SignalAnalysisSummary } from '../../types/api';

type ReturnHorizon = SignalAnalysisRequest['return_horizon'];

export function SignalDiagnostics() {
  const [ticker, setTicker] = useUserPersistentState('signal-diagnostics:ticker', 'AAPL');
  const [startDate, setStartDate] = useUserPersistentState('signal-diagnostics:start-date', '2018-01-01');
  const [endDate, setEndDate] = useUserPersistentState('signal-diagnostics:end-date', () => new Date().toISOString().slice(0, 10));
  const [signal, setSignal] = useUserPersistentState('signal-diagnostics:signal', 'mom_20');
  const [returnHorizon, setReturnHorizon] = useUserPersistentState<ReturnHorizon>('signal-diagnostics:return-horizon', 5);
  const [quantiles, setQuantiles] = useUserPersistentState('signal-diagnostics:quantiles', 5);
  const [rollingWindow, setRollingWindow] = useUserPersistentState('signal-diagnostics:rolling-window', 252);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { jobId, setJobId, job, history, error: jobError, cancel } = useRestorableJob('signal-diagnostics', 'signal_analysis');
  const result = isSignalResult(job?.result_summary) ? job.result_summary : null;
  const running = submitting || ['queued', 'running', 'cancel_requested'].includes(job?.status ?? '');

  const handleRun = async () => {
    const symbol = ticker.trim().toUpperCase();
    if (!/^[A-Z0-9.^-]{1,15}$/.test(symbol)) {
      setFormError('Enter a valid ticker symbol.');
      return;
    }
    if (startDate > endDate) {
      setFormError('Start date must be on or before end date.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setTicker(symbol);
    try {
      const response = await signalAPI.createAnalysis({
        ticker: symbol,
        start_date: startDate,
        end_date: endDate,
        signal,
        horizons: [1, 3, 5, 10, 20],
        return_horizon: returnHorizon,
        quantiles,
        rolling_window: rollingWindow,
      }, `${symbol}-${signal}-${returnHorizon}-${Date.now()}`);
      setJobId(response.data.id);
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : 'Unable to start signal analysis');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedDecay = result?.decay.find(row => row.horizon === result.return_horizon);
  const spread = selectedDecay?.top_return !== null && selectedDecay?.top_return !== undefined
    && selectedDecay.bottom_return !== null && selectedDecay.bottom_return !== undefined
    ? selectedDecay.top_return - selectedDecay.bottom_return
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Signal Diagnostics</h1>
          <p className="text-muted-foreground">Measure information coefficient decay and rolling quantile separation</p>
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
            {running ? 'Running...' : 'Analyze signal'}
          </Button>
        </div>
      </div>

      {(formError || jobError || job?.status === 'failed') && (
        <Alert variant="destructive"><AlertDescription>{formError || jobError?.message || job?.error_message || 'Signal analysis failed'}</AlertDescription></Alert>
      )}

      <JobHistorySelect jobs={history} label="Saved signal analyses" value={jobId} onValueChange={setJobId} />

      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <TextInput id="signal-ticker" label="Ticker" value={ticker} onChange={value => setTicker(value.toUpperCase())} />
          <TextInput id="signal-start" label="Start date" type="date" value={startDate} onChange={setStartDate} />
          <TextInput id="signal-end" label="End date" type="date" value={endDate} onChange={setEndDate} />
          <SelectInput label="Signal" value={signal} onChange={setSignal} options={[
            ['mom_20', '20-day momentum'], ['mr_z_20', '20-day mean reversion'], ['vol_20', '20-day volatility'], ['corr_spy_20', '20-day SPY correlation'], ['prob_up_1d', 'XGBoost 1-day probability'],
          ]} />
          <SelectInput label="Forward return" value={String(returnHorizon)} onChange={value => setReturnHorizon(Number(value) as ReturnHorizon)} options={[
            ['1', '1 day'], ['3', '3 days'], ['5', '5 days'], ['10', '10 days'], ['20', '20 days'],
          ]} />
          <NumberInput id="signal-quantiles" label="Quantiles" value={quantiles} min={2} max={10} onChange={setQuantiles} />
          <NumberInput id="signal-window" label="Rolling window" value={rollingWindow} min={60} max={1000} onChange={setRollingWindow} />
        </div>
      </Card>

      {job && (
        <Card className="p-6 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div><h2 className="font-semibold capitalize">{job.status.replace('_', ' ')}</h2><p className="text-sm text-muted-foreground">{job.progress_phase || 'Waiting for worker'}</p></div>
            <span className="font-mono text-sm">{job.progress_percent}%</span>
          </div>
          <Progress value={job.progress_percent} />
        </Card>
      )}

      {result && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Metric label="Pearson IC" value={formatNumber(selectedDecay?.pearson)} />
            <Metric label="Spearman IC" value={formatNumber(selectedDecay?.spearman)} />
            <Metric label="Top / Bottom Spread" value={formatPercent(spread)} />
            <Metric label="Rows Used" value={result.rows_used.toLocaleString()} />
          </div>
          <Card className="p-6"><h2 className="text-xl font-semibold mb-1">Signal Decay IC</h2><p className="text-sm text-muted-foreground mb-5">Correlation with future returns by horizon</p><SignalDecayChart data={result.decay} /></Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6"><h2 className="text-xl font-semibold mb-1">Quantile Forward Returns</h2><p className="text-sm text-muted-foreground mb-5">Mean {result.return_horizon}-day return by rolling signal quantile</p><QuantileReturnsChart data={result.quantiles} /></Card>
            <Card className="p-6"><h2 className="text-xl font-semibold mb-1">Long / Short Equity</h2><p className="text-sm text-muted-foreground mb-5">Top quantile minus bottom quantile</p><LongShortEquityChart data={result.long_short_curve} /></Card>
          </div>
          <Card className="p-6 overflow-x-auto">
            <h2 className="text-xl font-semibold mb-4">Quantile Statistics</h2>
            <Table><TableHeader><TableRow><TableHead>Quantile</TableHead><TableHead>Mean Forward Return</TableHead></TableRow></TableHeader>
              <TableBody>{result.quantiles.map(row => <TableRow key={row.quantile}><TableCell>Q{row.quantile}</TableCell><TableCell>{formatPercent(row.mean_return)}</TableCell></TableRow>)}</TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}

function isSignalResult(value: unknown): value is SignalAnalysisSummary {
  return Boolean(value && typeof value === 'object' && 'decay' in value && 'quantiles' in value && 'long_short_curve' in value);
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

function Metric({ label, value }: { label: string; value: string }) {
  return <Card className="p-5"><div className="text-sm text-muted-foreground mb-1">{label}</div><div className="text-2xl font-bold">{value}</div></Card>;
}

function formatNumber(value: number | null | undefined) {
  return value === null || value === undefined ? '-' : value.toFixed(3);
}

function formatPercent(value: number | null | undefined) {
  return value === null || value === undefined ? '-' : `${(value * 100).toFixed(2)}%`;
}