import { useCallback, useEffect, useState } from 'react';
import { Copy, Edit, GitCompare, Play, Plus, Trash2 } from 'lucide-react';

import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Textarea } from '../ui/textarea';
import { experimentAPI, jobAPI } from '../../services/api';
import { useUserPersistentState } from '../../hooks/usePersistentState';
import type { ExperimentComparison, ExperimentRecord, ExperimentRequest, JobRecord, ModelTrainingSummary } from '../../types/api';

const DEFAULT_FORM: ExperimentRequest = {
  name: 'AAPL Research Experiment',
  description: '',
  ticker: 'AAPL',
  model_type: 'xgb',
  horizon: '1d',
  start_date: '2018-01-01',
  end_date: new Date().toISOString().slice(0, 10),
  train_window: 750,
  test_window: 63,
  max_folds: 10,
  xgb_params: { n_estimators: 400, max_depth: 4, learning_rate: 0.05, subsample: 0.9, colsample_bytree: 0.9 },
  lstm_params: { sequence_length: 20, hidden_size: 64, num_layers: 1, dropout: 0.1, learning_rate: 0.001, batch_size: 32, max_epochs: 50, patience: 8 },
  ensemble_weights: { xgb: 0.5, lstm: 0.5 },
};

export function ExperimentManager() {
  const [experiments, setExperiments] = useState<ExperimentRecord[]>([]);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [selected, setSelected] = useUserPersistentState<string[]>('experiments:selected', []);
  const [comparison, setComparison] = useUserPersistentState<ExperimentComparison[]>('experiments:comparison', []);
  const [editorOpen, setEditorOpen] = useUserPersistentState('experiments:editor-open', false);
  const [editingId, setEditingId] = useUserPersistentState<string | null>('experiments:editing-id', null);
  const [form, setForm] = useUserPersistentState<ExperimentRequest>('experiments:form', DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [experimentResponse, jobResponse] = await Promise.all([
        experimentAPI.getExperiments(),
        jobAPI.listJobs(100),
      ]);
      setExperiments(experimentResponse.data);
      setJobs(jobResponse.data.filter(job => job.job_type === 'experiment_run'));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load experiments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!jobs.some(job => ['queued', 'running', 'cancel_requested'].includes(job.status))) return;
    const timer = setInterval(() => { void load(); }, 3000);
    return () => clearInterval(timer);
  }, [jobs, load]);

  const latestRun = (experimentId: string) => jobs.find(job => job.params?.experiment_id === experimentId);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...DEFAULT_FORM, end_date: new Date().toISOString().slice(0, 10) });
    setEditorOpen(true);
  };

  const openEdit = (experiment: ExperimentRecord) => {
    setEditingId(experiment.id);
    setForm(toRequest(experiment));
    setEditorOpen(true);
  };

  const saveExperiment = async () => {
    setSaving(true);
    setError(null);
    try {
      if (editingId) await experimentAPI.updateExperiment(editingId, form);
      else await experimentAPI.createExperiment(form);
      setEditorOpen(false);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save experiment');
    } finally {
      setSaving(false);
    }
  };

  const duplicateExperiment = async (experiment: ExperimentRecord) => {
    try {
      await experimentAPI.createExperiment({ ...toRequest(experiment), name: `${experiment.name} Copy` });
      await load();
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : 'Unable to duplicate experiment');
    }
  };

  const deleteExperiment = async (experimentId: string) => {
    try {
      await experimentAPI.deleteExperiment(experimentId);
      setSelected(current => current.filter(id => id !== experimentId));
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete experiment');
    }
  };

  const runExperiment = async (experimentId: string) => {
    try {
      const response = await experimentAPI.runExperiment(experimentId, `${experimentId}-${Date.now()}`);
      setJobs(current => [response.data, ...current]);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Unable to run experiment');
    }
  };

  const compareSelected = async () => {
    const jobIds = selected.map(id => latestRun(id)).filter((job): job is JobRecord => job?.status === 'completed').map(job => job.id);
    if (jobIds.length < 2) {
      setError('Select at least two experiments with completed runs.');
      return;
    }
    try {
      const response = await experimentAPI.compareRuns(jobIds);
      setComparison(response.data);
    } catch (compareError) {
      setError(compareError instanceof Error ? compareError.message : 'Unable to compare experiment runs');
    }
  };

  if (loading) return <Card className="p-10 text-center text-muted-foreground">Loading experiments...</Card>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div><h1 className="text-3xl font-bold text-foreground mb-2">Experiment Manager</h1><p className="text-muted-foreground">Save, rerun, and compare walk-forward model configurations</p></div>
        <div className="flex gap-3">
          {selected.length > 1 && <Button variant="outline" onClick={compareSelected}><GitCompare className="w-4 h-4 mr-2" />Compare ({selected.length})</Button>}
          <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />New Experiment</Button>
        </div>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Summary label="Experiments" value={experiments.length} />
        <Summary label="Running" value={jobs.filter(job => ['queued', 'running', 'cancel_requested'].includes(job.status)).length} />
        <Summary label="Completed Runs" value={jobs.filter(job => job.status === 'completed').length} />
        <Summary label="Selected" value={selected.length} />
      </div>

      <Card className="p-6 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-10" /><TableHead>Name</TableHead><TableHead>Ticker</TableHead><TableHead>Model</TableHead><TableHead>Horizon</TableHead><TableHead>Status</TableHead><TableHead>Sharpe</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>{experiments.map(experiment => {
            const run = latestRun(experiment.id);
            const summary = isModelSummary(run?.result_summary) ? run.result_summary : null;
            return (
              <TableRow key={experiment.id}>
                <TableCell><input type="checkbox" aria-label={`Select ${experiment.name}`} checked={selected.includes(experiment.id)} onChange={event => setSelected(current => event.target.checked ? [...current, experiment.id] : current.filter(id => id !== experiment.id))} /></TableCell>
                <TableCell><div className="font-medium">{experiment.name}</div><div className="text-xs text-muted-foreground max-w-xs truncate">{experiment.description || 'No description'}</div></TableCell>
                <TableCell>{experiment.ticker}</TableCell><TableCell className="capitalize">{experiment.model_type}</TableCell><TableCell>{experiment.config.horizon}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{run?.status.replace('_', ' ') || 'draft'}</Badge></TableCell>
                <TableCell>{formatMetric(summary?.metrics.sharpe)}</TableCell>
                <TableCell><div className="flex justify-end gap-1">
                  <IconButton label="Run" onClick={() => void runExperiment(experiment.id)} disabled={Boolean(run && ['queued', 'running', 'cancel_requested'].includes(run.status))}><Play className="w-4 h-4" /></IconButton>
                  <IconButton label="Duplicate" onClick={() => void duplicateExperiment(experiment)}><Copy className="w-4 h-4" /></IconButton>
                  <IconButton label="Edit" onClick={() => openEdit(experiment)}><Edit className="w-4 h-4" /></IconButton>
                  <IconButton label="Delete" onClick={() => void deleteExperiment(experiment.id)}><Trash2 className="w-4 h-4 text-destructive" /></IconButton>
                </div></TableCell>
              </TableRow>
            );
          })}</TableBody>
        </Table>
        {experiments.length === 0 && <p className="text-center text-muted-foreground py-10">No saved experiments</p>}
      </Card>

      {comparison.length > 0 && (
        <Card className="p-6 overflow-x-auto">
          <h2 className="text-xl font-semibold mb-4">Run Comparison</h2>
          <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Model</TableHead><TableHead>Horizon</TableHead><TableHead>Sharpe</TableHead><TableHead>Sortino</TableHead><TableHead>Return</TableHead><TableHead>Drawdown</TableHead></TableRow></TableHeader>
            <TableBody>{comparison.map(run => <TableRow key={run.id}><TableCell>{run.name}</TableCell><TableCell className="capitalize">{run.model_type}</TableCell><TableCell>{run.horizon}</TableCell><TableCell>{formatMetric(run.metrics.sharpe)}</TableCell><TableCell>{formatMetric(run.metrics.sortino)}</TableCell><TableCell>{formatPercent(run.metrics.cum_return)}</TableCell><TableCell>{formatPercent(run.metrics.mdd)}</TableCell></TableRow>)}</TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Edit Experiment' : 'New Experiment'}</DialogTitle><DialogDescription>Save a complete walk-forward model configuration.</DialogDescription></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <TextField label="Name" value={form.name} onChange={value => setForm(current => ({ ...current, name: value }))} />
            <TextField label="Ticker" value={form.ticker} onChange={value => setForm(current => ({ ...current, ticker: value.toUpperCase() }))} />
            <div className="md:col-span-2 space-y-2"><Label>Description</Label><Textarea value={form.description || ''} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} /></div>
            <SelectField label="Model" value={form.model_type} onChange={value => setForm(current => ({ ...current, model_type: value as ExperimentRequest['model_type'] }))} options={[['xgb', 'XGBoost'], ['lstm', 'LSTM'], ['ensemble', 'XGBoost + LSTM']]} />
            <SelectField label="Horizon" value={form.horizon} onChange={value => setForm(current => ({ ...current, horizon: value as ExperimentRequest['horizon'] }))} options={[['1d', '1 day'], ['5d', '5 days'], ['20d', '20 days']]} />
            <TextField label="Start date" type="date" value={form.start_date} onChange={value => setForm(current => ({ ...current, start_date: value }))} />
            <TextField label="End date" type="date" value={form.end_date || ''} onChange={value => setForm(current => ({ ...current, end_date: value }))} />
            <NumberField label="Training window" value={form.train_window} min={250} max={3000} onChange={value => setForm(current => ({ ...current, train_window: value }))} />
            <NumberField label="Test window" value={form.test_window} min={5} max={252} onChange={value => setForm(current => ({ ...current, test_window: value }))} />
            <NumberField label="Maximum folds" value={form.max_folds} min={1} max={50} onChange={value => setForm(current => ({ ...current, max_folds: value }))} />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button><Button onClick={saveExperiment} disabled={saving}>{saving ? 'Saving...' : 'Save Experiment'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function toRequest(experiment: ExperimentRecord): ExperimentRequest {
  return { name: experiment.name, description: experiment.description, ticker: experiment.ticker, model_type: experiment.model_type, ...experiment.config };
}

function isModelSummary(value: unknown): value is ModelTrainingSummary {
  return Boolean(value && typeof value === 'object' && 'feature_importance' in value && 'metrics' in value);
}

function Summary({ label, value }: { label: string; value: number }) { return <Card className="p-5"><div className="text-sm text-muted-foreground">{label}</div><div className="text-2xl font-bold mt-1">{value}</div></Card>; }
function IconButton({ children, disabled, label, onClick }: { children: React.ReactNode; disabled?: boolean; label: string; onClick: () => void }) { return <Button variant="ghost" size="sm" title={label} aria-label={label} onClick={onClick} disabled={disabled}>{children}</Button>; }
function TextField({ label, onChange, type = 'text', value }: { label: string; onChange: (value: string) => void; type?: string; value: string }) { return <div className="space-y-2"><Label>{label}</Label><Input type={type} value={value} onChange={event => onChange(event.target.value)} /></div>; }
function NumberField({ label, max, min, onChange, value }: { label: string; max: number; min: number; onChange: (value: number) => void; value: number }) { return <div className="space-y-2"><Label>{label}</Label><Input type="number" min={min} max={max} value={value} onChange={event => onChange(Number(event.target.value))} /></div>; }
function SelectField({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: string[][]; value: string }) { return <div className="space-y-2"><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map(([option, text]) => <SelectItem key={option} value={option}>{text}</SelectItem>)}</SelectContent></Select></div>; }
function formatMetric(value: string | number | boolean | null | undefined) { return typeof value === 'number' ? value.toFixed(2) : '-'; }
function formatPercent(value: string | number | boolean | null | undefined) { return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '-'; }