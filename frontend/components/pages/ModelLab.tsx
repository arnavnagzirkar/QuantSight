import { useState } from 'react';
import { Play, Settings as SettingsIcon, Square } from 'lucide-react';

import { EquityCurveChart } from '../charts/EquityCurveChart';
import { FeatureImportanceChart } from '../charts/FeatureImportanceChart';
import { JobHistorySelect } from '../JobHistorySelect';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Progress } from '../ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useRestorableJob } from '../../hooks/useRestorableJob';
import { useUserPersistentState } from '../../hooks/usePersistentState';
import { modelAPI } from '../../services/api';
import type { ModelTrainingRequest, ModelTrainingSummary } from '../../types/api';

type ModelType = ModelTrainingRequest['model_type'];
type Horizon = ModelTrainingRequest['horizon'];

export function ModelLab() {
  const [name, setName] = useUserPersistentState('model-lab:name', 'AAPL Research Model');
  const [ticker, setTicker] = useUserPersistentState('model-lab:ticker', 'AAPL');
  const [modelType, setModelType] = useUserPersistentState<ModelType>('model-lab:model-type', 'xgb');
  const [horizon, setHorizon] = useUserPersistentState<Horizon>('model-lab:horizon', '1d');
  const [startDate, setStartDate] = useUserPersistentState('model-lab:start-date', '2018-01-01');
  const [endDate, setEndDate] = useUserPersistentState('model-lab:end-date', () => new Date().toISOString().slice(0, 10));
  const [trainWindow, setTrainWindow] = useUserPersistentState('model-lab:train-window', 750);
  const [testWindow, setTestWindow] = useUserPersistentState('model-lab:test-window', 63);
  const [maxFolds, setMaxFolds] = useUserPersistentState('model-lab:max-folds', 10);
  const [xgbParams, setXgbParams] = useUserPersistentState('model-lab:xgb-params', {
    n_estimators: 400,
    max_depth: 4,
    learning_rate: 0.05,
    subsample: 0.9,
    colsample_bytree: 0.9,
  });
  const [lstmParams, setLstmParams] = useUserPersistentState('model-lab:lstm-params', {
    sequence_length: 20,
    hidden_size: 64,
    num_layers: 1,
    dropout: 0.1,
    learning_rate: 0.001,
    batch_size: 32,
    max_epochs: 50,
    patience: 8,
  });
  const [xgbWeight, setXgbWeight] = useUserPersistentState('model-lab:xgb-weight', 0.5);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { jobId, setJobId, job, history, error: jobError, cancel } = useRestorableJob('model-lab', 'model_train');

  const running = submitting || job?.status === 'queued' || job?.status === 'running' || job?.status === 'cancel_requested';
  const result = isModelResult(job?.result_summary) ? job.result_summary : null;

  const handleRun = async () => {
    const normalizedTicker = ticker.trim().toUpperCase();
    if (!name.trim()) {
      setFormError('Enter a model name.');
      return;
    }
    if (!/^[A-Z0-9.^-]{1,15}$/.test(normalizedTicker)) {
      setFormError('Enter a valid ticker symbol.');
      return;
    }
    if (startDate > endDate) {
      setFormError('Start date must be on or before end date.');
      return;
    }
    if (testWindow >= trainWindow) {
      setFormError('Test window must be smaller than the training window.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setTicker(normalizedTicker);
    try {
      const response = await modelAPI.trainModel(
        {
          name: name.trim(),
          ticker: normalizedTicker,
          model_type: modelType,
          horizon,
          start_date: startDate,
          end_date: endDate,
          train_window: trainWindow,
          test_window: testWindow,
          max_folds: maxFolds,
          xgb_params: xgbParams,
          lstm_params: lstmParams,
          ensemble_weights: { xgb: xgbWeight, lstm: 1 - xgbWeight },
        },
        `${normalizedTicker}-${modelType}-${horizon}-${Date.now()}`,
      );
      setJobId(response.data.id);
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : 'Unable to start model training');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Model Lab</h1>
          <p className="text-muted-foreground">Train leak-resistant walk-forward XGBoost, LSTM, and ensemble models</p>
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
            {running ? 'Running...' : 'Run model'}
          </Button>
        </div>
      </div>

      {(formError || jobError || job?.status === 'failed') && (
        <Alert variant="destructive">
          <AlertDescription>{formError || jobError?.message || job?.error_message || 'Model training failed'}</AlertDescription>
        </Alert>
      )}

      <JobHistorySelect jobs={history} label="Saved model runs" value={jobId} onValueChange={setJobId} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Model</h2>
          </div>
          <TextField id="model-name" label="Name" value={name} onChange={setName} />
          <TextField id="model-ticker" label="Ticker" value={ticker} onChange={value => setTicker(value.toUpperCase())} />
          <div className="space-y-2">
            <Label htmlFor="model-type">Family</Label>
            <Select value={modelType} onValueChange={(value: ModelType) => setModelType(value)}>
              <SelectTrigger id="model-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="xgb">XGBoost</SelectItem>
                <SelectItem value="lstm">LSTM</SelectItem>
                <SelectItem value="ensemble">XGBoost + LSTM</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="model-horizon">Prediction horizon</Label>
            <Select value={horizon} onValueChange={(value: Horizon) => setHorizon(value)}>
              <SelectTrigger id="model-horizon"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">1 day</SelectItem>
                <SelectItem value="5d">5 days</SelectItem>
                <SelectItem value="20d">20 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField id="model-start" label="Start" type="date" value={startDate} onChange={setStartDate} />
            <TextField id="model-end" label="End" type="date" value={endDate} onChange={setEndDate} />
          </div>
          <NumberField id="train-window" label="Training window" value={trainWindow} min={250} max={3000} onChange={setTrainWindow} />
          <NumberField id="test-window" label="Test window" value={testWindow} min={5} max={252} onChange={setTestWindow} />
          <NumberField id="max-folds" label="Maximum folds" value={maxFolds} min={1} max={50} onChange={setMaxFolds} />
        </Card>

        <div className="lg:col-span-2 space-y-6">
          {(modelType === 'xgb' || modelType === 'ensemble') && (
            <Card className="p-6 space-y-4">
              <h2 className="text-lg font-semibold">XGBoost Parameters</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <NumberField id="trees" label="Trees" value={xgbParams.n_estimators} min={50} max={2000} onChange={value => setXgbParams(current => ({ ...current, n_estimators: value }))} />
                <NumberField id="depth" label="Max depth" value={xgbParams.max_depth} min={1} max={16} onChange={value => setXgbParams(current => ({ ...current, max_depth: value }))} />
                <DecimalField id="xgb-rate" label="Learning rate" value={xgbParams.learning_rate} min={0.001} max={1} step={0.001} onChange={value => setXgbParams(current => ({ ...current, learning_rate: value }))} />
                <DecimalField id="subsample" label="Subsample" value={xgbParams.subsample} min={0.1} max={1} step={0.05} onChange={value => setXgbParams(current => ({ ...current, subsample: value }))} />
                <DecimalField id="columns" label="Column sample" value={xgbParams.colsample_bytree} min={0.1} max={1} step={0.05} onChange={value => setXgbParams(current => ({ ...current, colsample_bytree: value }))} />
              </div>
            </Card>
          )}

          {(modelType === 'lstm' || modelType === 'ensemble') && (
            <Card className="p-6 space-y-4">
              <h2 className="text-lg font-semibold">LSTM Parameters</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <NumberField id="sequence" label="Sequence" value={lstmParams.sequence_length} min={2} max={252} onChange={value => setLstmParams(current => ({ ...current, sequence_length: value }))} />
                <NumberField id="hidden" label="Hidden size" value={lstmParams.hidden_size} min={4} max={256} onChange={value => setLstmParams(current => ({ ...current, hidden_size: value }))} />
                <NumberField id="layers" label="Layers" value={lstmParams.num_layers} min={1} max={4} onChange={value => setLstmParams(current => ({ ...current, num_layers: value }))} />
                <DecimalField id="dropout" label="Dropout" value={lstmParams.dropout} min={0} max={0.8} step={0.05} onChange={value => setLstmParams(current => ({ ...current, dropout: value }))} />
                <DecimalField id="lstm-rate" label="Learning rate" value={lstmParams.learning_rate} min={0.00001} max={0.1} step={0.0001} onChange={value => setLstmParams(current => ({ ...current, learning_rate: value }))} />
                <NumberField id="batch" label="Batch size" value={lstmParams.batch_size} min={4} max={512} onChange={value => setLstmParams(current => ({ ...current, batch_size: value }))} />
                <NumberField id="epochs" label="Max epochs" value={lstmParams.max_epochs} min={1} max={500} onChange={value => setLstmParams(current => ({ ...current, max_epochs: value }))} />
                <NumberField id="patience" label="Patience" value={lstmParams.patience} min={1} max={50} onChange={value => setLstmParams(current => ({ ...current, patience: value }))} />
              </div>
            </Card>
          )}

          {modelType === 'ensemble' && (
            <Card className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="ensemble-weight">XGBoost weight</Label>
                <span className="text-sm text-muted-foreground">{xgbWeight.toFixed(2)} XGBoost / {(1 - xgbWeight).toFixed(2)} LSTM</span>
              </div>
              <input id="ensemble-weight" type="range" min="0" max="1" step="0.05" value={xgbWeight} onChange={event => setXgbWeight(Number(event.target.value))} className="w-full" />
            </Card>
          )}
        </div>
      </div>

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

      {result && job?.status === 'completed' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['sharpe', 'sortino', 'cum_return', 'mdd'].map(metric => (
              <Card key={metric} className="p-5">
                <div className="text-sm text-muted-foreground mb-1">{formatMetricLabel(metric)}</div>
                <div className="text-2xl font-bold">{formatMetricValue(metric, result.metrics[metric])}</div>
              </Card>
            ))}
          </div>
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Out-of-Sample Equity</h2>
            <EquityCurveChart data={result.equity_curve.map(point => ({ date: point.date, strategy: point.value }))} />
          </Card>
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Feature Importance</h2>
            <FeatureImportanceChart data={result.feature_importance} />
          </Card>
        </>
      )}
    </div>
  );
}

function TextField({ id, label, onChange, type = 'text', value }: { id: string; label: string; onChange: (value: string) => void; type?: string; value: string }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} type={type} value={value} onChange={event => onChange(event.target.value)} /></div>;
}

function NumberField({ id, label, max, min, onChange, value }: { id: string; label: string; max: number; min: number; onChange: (value: number) => void; value: number }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} type="number" min={min} max={max} value={value} onChange={event => onChange(Number(event.target.value))} /></div>;
}

function DecimalField({ id, label, max, min, onChange, step, value }: { id: string; label: string; max: number; min: number; onChange: (value: number) => void; step: number; value: number }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} type="number" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} /></div>;
}

function formatMetricLabel(metric: string) {
  return metric.split('_').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
}

function formatMetricValue(metric: string, value: string | number | boolean | null | undefined) {
  if (typeof value !== 'number') return '-';
  if (metric === 'cum_return' || metric === 'mdd') return `${(value * 100).toFixed(1)}%`;
  return value.toFixed(2);
}

function isModelResult(value: unknown): value is ModelTrainingSummary {
  return Boolean(value && typeof value === 'object' && 'feature_importance' in value && !('ledger' in value));
}