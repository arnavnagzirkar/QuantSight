import { useState } from 'react';
import { Download, Play, Square } from 'lucide-react';

import { EquityCurveChart } from '../charts/EquityCurveChart';
import { JobHistorySelect } from '../JobHistorySelect';
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
import { backtestAPI } from '../../services/api';
import type { StrategyBacktestRequest, StrategyBacktestSummary } from '../../types/api';
import { downloadCSV } from '../../utils/formatters';

type ModelType = StrategyBacktestRequest['model_type'];
type Horizon = StrategyBacktestRequest['horizon'];
type PositionRule = StrategyBacktestRequest['position_rule'];

export function StrategyBacktest() {
  const [name, setName] = useUserPersistentState('strategy-backtest:name', 'AAPL Strategy Backtest');
  const [ticker, setTicker] = useUserPersistentState('strategy-backtest:ticker', 'AAPL');
  const [modelType, setModelType] = useUserPersistentState<ModelType>('strategy-backtest:model-type', 'xgb');
  const [horizon, setHorizon] = useUserPersistentState<Horizon>('strategy-backtest:horizon', '1d');
  const [positionRule, setPositionRule] = useUserPersistentState<PositionRule>('strategy-backtest:position-rule', 'long_short');
  const [startDate, setStartDate] = useUserPersistentState('strategy-backtest:start-date', '2018-01-01');
  const [endDate, setEndDate] = useUserPersistentState('strategy-backtest:end-date', () => new Date().toISOString().slice(0, 10));
  const [initialCapital, setInitialCapital] = useUserPersistentState('strategy-backtest:initial-capital', 100000);
  const [costBps, setCostBps] = useUserPersistentState('strategy-backtest:cost-bps', 5);
  const [trainWindow, setTrainWindow] = useUserPersistentState('strategy-backtest:train-window', 750);
  const [testWindow, setTestWindow] = useUserPersistentState('strategy-backtest:test-window', 63);
  const [maxFolds, setMaxFolds] = useUserPersistentState('strategy-backtest:max-folds', 10);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { jobId, setJobId, job, history, error: jobError, cancel } = useRestorableJob('strategy-backtest', 'backtest');
  const result = isStrategyResult(job?.result_summary) ? job.result_summary : null;
  const running = submitting || ['queued', 'running', 'cancel_requested'].includes(job?.status ?? '');

  const handleRun = async () => {
    const symbol = ticker.trim().toUpperCase();
    if (!name.trim() || !/^[A-Z0-9.^-]{1,15}$/.test(symbol)) {
      setFormError('Enter a name and valid ticker symbol.');
      return;
    }
    if (startDate > endDate || testWindow >= trainWindow) {
      setFormError('Check the date range and walk-forward windows.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setTicker(symbol);
    try {
      const response = await backtestAPI.createBacktest({
        name: name.trim(),
        ticker: symbol,
        model_type: modelType,
        horizon,
        position_rule: positionRule,
        start_date: startDate,
        end_date: endDate,
        initial_capital: initialCapital,
        cost_bps: costBps,
        train_window: trainWindow,
        test_window: testWindow,
        max_folds: maxFolds,
        xgb_params: {
          n_estimators: 400,
          max_depth: 4,
          learning_rate: 0.05,
          subsample: 0.9,
          colsample_bytree: 0.9,
        },
        lstm_params: {
          sequence_length: 20,
          hidden_size: 64,
          num_layers: 1,
          dropout: 0.1,
          learning_rate: 0.001,
          batch_size: 32,
          max_epochs: 50,
          patience: 8,
        },
        ensemble_weights: { xgb: 0.5, lstm: 0.5 },
      }, `${symbol}-${modelType}-${horizon}-${positionRule}-${Date.now()}`);
      setJobId(response.data.id);
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : 'Unable to start backtest');
    } finally {
      setSubmitting(false);
    }
  };

  const chartData = result ? mergeCurves(result) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Strategy Backtest</h1>
          <p className="text-muted-foreground">Evaluate a single-ticker model with a chronological out-of-sample position ledger</p>
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
            {running ? 'Running...' : 'Run backtest'}
          </Button>
        </div>
      </div>

      {(formError || jobError || job?.status === 'failed') && (
        <Alert variant="destructive">
          <AlertDescription>{formError || jobError?.message || job?.error_message || 'Backtest failed'}</AlertDescription>
        </Alert>
      )}

      <JobHistorySelect jobs={history} label="Saved backtests" value={jobId} onValueChange={setJobId} />

      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <TextInput id="backtest-name" label="Name" value={name} onChange={setName} />
          <TextInput id="backtest-ticker" label="Ticker" value={ticker} onChange={value => setTicker(value.toUpperCase())} />
          <SelectInput label="Model" value={modelType} onChange={value => setModelType(value as ModelType)} options={[
            ['xgb', 'XGBoost'], ['lstm', 'LSTM'], ['ensemble', 'XGBoost + LSTM'],
          ]} />
          <SelectInput label="Prediction horizon" value={horizon} onChange={value => setHorizon(value as Horizon)} options={[
            ['1d', '1 day'], ['5d', '5 days'], ['20d', '20 days'],
          ]} />
          <SelectInput label="Position rule" value={positionRule} onChange={value => setPositionRule(value as PositionRule)} options={[
            ['long_short', 'Long / Short'], ['long_only', 'Long Only'],
          ]} />
          <TextInput id="backtest-start" label="Start date" type="date" value={startDate} onChange={setStartDate} />
          <TextInput id="backtest-end" label="End date" type="date" value={endDate} onChange={setEndDate} />
          <NumberInput id="capital" label="Initial capital" value={initialCapital} min={1} max={1000000000} onChange={setInitialCapital} />
          <NumberInput id="cost" label="Transaction cost (bps)" value={costBps} min={0} max={1000} onChange={setCostBps} />
          <NumberInput id="bt-train" label="Training window" value={trainWindow} min={250} max={3000} onChange={setTrainWindow} />
          <NumberInput id="bt-test" label="Test window" value={testWindow} min={5} max={252} onChange={setTestWindow} />
          <NumberInput id="bt-folds" label="Maximum folds" value={maxFolds} min={1} max={50} onChange={setMaxFolds} />
        </div>
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
            {['cum_return', 'sharpe', 'sortino', 'mdd'].map(metric => (
              <Card key={metric} className="p-5">
                <div className="text-sm text-muted-foreground mb-1">{metricLabel(metric)}</div>
                <div className="text-2xl font-bold">{metricValue(metric, result.metrics[metric])}</div>
              </Card>
            ))}
          </div>
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Equity Curve</h2>
            <EquityCurveChart data={chartData} valueFormat="currency" />
          </Card>
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Position Ledger</h2>
                <p className="text-sm text-muted-foreground">One record per realized return period</p>
              </div>
              <Button variant="outline" onClick={() => downloadCSV(result.ledger, `${result.ticker.toLowerCase()}-backtest-ledger`)}>
                <Download className="w-4 h-4 mr-2" />Export CSV
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead><TableHead>Probability</TableHead><TableHead>Position</TableHead>
                  <TableHead>Gross Return</TableHead><TableHead>Cost</TableHead><TableHead>Net Return</TableHead><TableHead>Equity</TableHead>
                </TableRow></TableHeader>
                <TableBody>{result.ledger.slice(-100).reverse().map(row => (
                  <TableRow key={row.date}>
                    <TableCell>{row.date}</TableCell>
                    <TableCell>{formatNumber(row.probability)}</TableCell>
                    <TableCell>{formatNumber(row.position)}</TableCell>
                    <TableCell>{formatPercent(row.gross_return)}</TableCell>
                    <TableCell>{formatPercent(row.transaction_cost)}</TableCell>
                    <TableCell>{formatPercent(row.net_return)}</TableCell>
                    <TableCell>{row.equity === null ? '-' : `$${row.equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function isStrategyResult(value: unknown): value is StrategyBacktestSummary {
  return Boolean(value && typeof value === 'object' && 'ledger' in value && 'position_rule' in value);
}

function mergeCurves(result: StrategyBacktestSummary) {
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

function metricLabel(value: string) {
  return value.split('_').map(part => part[0].toUpperCase() + part.slice(1)).join(' ');
}

function metricValue(metric: string, value: string | number | boolean | null | undefined) {
  if (typeof value !== 'number') return '-';
  return metric === 'cum_return' || metric === 'mdd' ? `${(value * 100).toFixed(1)}%` : value.toFixed(2);
}

function formatNumber(value: number | null) {
  return value === null ? '-' : value.toFixed(3);
}

function formatPercent(value: number | null) {
  return value === null ? '-' : `${(value * 100).toFixed(2)}%`;
}