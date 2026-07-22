import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, Shield, TrendingDown, TrendingUp } from 'lucide-react';

import { MetricCard } from '../MetricCard';
import { AttributionChart } from '../charts/AttributionChart';
import { CorrelationHeatmap } from '../charts/CorrelationHeatmap';
import { DrawdownChart } from '../charts/DrawdownChart';
import { EquityCurveChart } from '../charts/EquityCurveChart';
import { Alert, AlertDescription } from '../ui/alert';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Progress } from '../ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { jobAPI } from '../../services/api';
import { useUserPersistentState } from '../../hooks/usePersistentState';
import type { JobRecord, PortfolioRunSummary } from '../../types/api';

export function RiskPerformance() {
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [selectedJobId, setSelectedJobId] = useUserPersistentState('risk-performance:selected-job', '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marketShock, setMarketShock] = useUserPersistentState('risk-performance:market-shock', -20);
  const [activeTab, setActiveTab] = useUserPersistentState('risk-performance:active-tab', 'overview');

  useEffect(() => {
    let active = true;
    jobAPI.listJobs(100)
      .then(response => {
        if (!active) return;
        const completed = response.data.filter(job => job.job_type === 'portfolio_run' && job.status === 'completed' && isPortfolioResult(job.result_summary));
        setJobs(completed);
        setSelectedJobId(current => current || completed[0]?.id || '');
      })
      .catch(fetchError => {
        if (active) setError(fetchError instanceof Error ? fetchError.message : 'Unable to load portfolio runs');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [setSelectedJobId]);

  const selectedJob = jobs.find(job => job.id === selectedJobId);
  const result = isPortfolioResult(selectedJob?.result_summary) ? selectedJob.result_summary : null;
  const beta = result?.metrics.beta;
  const estimatedShock = typeof beta === 'number' ? beta * marketShock / 100 : null;

  if (loading) return <Card className="p-10 text-center text-muted-foreground">Loading completed portfolio runs...</Card>;
  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Risk & Performance</h1>
          <p className="text-muted-foreground">Risk evidence computed from a completed portfolio simulation</p>
        </div>
        <Select value={selectedJobId} onValueChange={setSelectedJobId} disabled={jobs.length === 0}>
          <SelectTrigger className="w-full md:w-72"><SelectValue placeholder="Select a portfolio run" /></SelectTrigger>
          <SelectContent>{jobs.map(job => {
            const summary = job.result_summary as PortfolioRunSummary;
            return <SelectItem key={job.id} value={job.id}>{summary.name}</SelectItem>;
          })}</SelectContent>
        </Select>
      </div>

      {!result ? (
        <Card className="p-10 text-center text-muted-foreground">Run a portfolio simulation to populate risk analytics.</Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <MetricCard title="VaR" value={formatPercent(result.risk.tail.var)} subtitle="95% historical, 1 period" changeType="negative" icon={AlertTriangle} />
            <MetricCard title="CVaR" value={formatPercent(result.risk.tail.cvar)} subtitle="Expected shortfall" changeType="negative" icon={TrendingDown} />
            <MetricCard title="Volatility" value={formatPercent(result.metrics.volatility)} subtitle="Annualized" icon={Activity} />
            <MetricCard title="Beta" value={formatNumber(result.metrics.beta)} subtitle="vs benchmark" icon={TrendingUp} />
            <MetricCard title="Tracking Error" value={formatPercent(result.risk.tracking_error)} subtitle="Annualized" icon={Shield} />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="drawdowns">Drawdowns</TabsTrigger>
              <TabsTrigger value="components">Risk Components</TabsTrigger>
              <TabsTrigger value="stress">Stress</TabsTrigger>
              <TabsTrigger value="attribution">Attribution</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Risk-Adjusted Equity</h2>
                <EquityCurveChart data={mergeCurves(result)} />
              </Card>
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Asset Correlation</h2>
                <CorrelationHeatmap labels={result.risk.correlation.labels} matrix={result.risk.correlation.matrix} />
              </Card>
            </TabsContent>

            <TabsContent value="drawdowns" className="space-y-6">
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Underwater Curve</h2>
                <DrawdownChart data={result.risk.drawdown.underwater} />
              </Card>
              <Card className="p-6 overflow-x-auto">
                <h2 className="text-xl font-semibold mb-4">Drawdown Periods</h2>
                <Table><TableHeader><TableRow>
                  <TableHead>Start</TableHead><TableHead>Trough</TableHead><TableHead>Recovery</TableHead><TableHead>Depth</TableHead><TableHead>Length</TableHead><TableHead>Recovery</TableHead>
                </TableRow></TableHeader><TableBody>{result.risk.drawdown.periods.map(period => (
                  <TableRow key={`${period.start_date}-${period.trough_date}`}>
                    <TableCell>{period.start_date}</TableCell><TableCell>{period.trough_date}</TableCell>
                    <TableCell>{period.recovery_date || 'Ongoing'}</TableCell><TableCell>{formatPercent(period.depth)}</TableCell>
                    <TableCell>{period.length_days} days</TableCell><TableCell>{period.recovery_days === null ? '-' : `${period.recovery_days} days`}</TableCell>
                  </TableRow>
                ))}</TableBody></Table>
              </Card>
            </TabsContent>

            <TabsContent value="components">
              <Card className="p-6 overflow-x-auto">
                <h2 className="text-xl font-semibold mb-4">Risk Contribution by Position</h2>
                <Table><TableHeader><TableRow>
                  <TableHead>Ticker</TableHead><TableHead>Weight</TableHead><TableHead>Volatility</TableHead><TableHead>Beta</TableHead><TableHead>Risk Contribution</TableHead>
                </TableRow></TableHeader><TableBody>{result.risk.components.map(component => (
                  <TableRow key={component.ticker}>
                    <TableCell className="font-medium">{component.ticker}</TableCell>
                    <TableCell>{formatPercent(component.weight)}</TableCell><TableCell>{formatPercent(component.volatility)}</TableCell>
                    <TableCell>{component.beta.toFixed(2)}</TableCell>
                    <TableCell><div className="flex items-center gap-3"><Progress value={Math.abs(component.risk_contribution) * 100} className="w-28" /><span>{formatPercent(component.risk_contribution)}</span></div></TableCell>
                  </TableRow>
                ))}</TableBody></Table>
              </Card>
            </TabsContent>

            <TabsContent value="stress" className="space-y-6">
              <Card className="p-6 overflow-x-auto">
                <h2 className="text-xl font-semibold mb-4">Observed Historical Stress</h2>
                <Table><TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Dates</TableHead><TableHead>Realized Return</TableHead><TableHead>Observations</TableHead></TableRow></TableHeader>
                  <TableBody>{result.risk.historical_stress.map(scenario => (
                    <TableRow key={scenario.name}><TableCell>{scenario.name}</TableCell><TableCell>{scenario.start_date} to {scenario.end_date}</TableCell><TableCell>{formatPercent(scenario.realized_return)}</TableCell><TableCell>{scenario.observations}</TableCell></TableRow>
                  ))}</TableBody>
                </Table>
                {result.risk.historical_stress.length === 0 && <p className="text-center text-muted-foreground py-6">The run does not overlap a configured historical stress period.</p>}
              </Card>
              <Card className="p-6 space-y-4 max-w-xl">
                <h2 className="text-xl font-semibold">Beta Shock Estimate</h2>
                <p className="text-sm text-muted-foreground">A linear estimate using the run's benchmark beta, not a forecast.</p>
                <Label htmlFor="market-shock">Benchmark shock: {marketShock}%</Label>
                <Input id="market-shock" type="range" min="-50" max="20" step="1" value={marketShock} onChange={event => setMarketShock(Number(event.target.value))} />
                <div className="text-2xl font-bold">Estimated portfolio impact: {formatPercent(estimatedShock)}</div>
              </Card>
            </TabsContent>

            <TabsContent value="attribution">
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Recent Return Attribution</h2>
                <AttributionChart data={result.attribution} />
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function isPortfolioResult(value: unknown): value is PortfolioRunSummary {
  return Boolean(value && typeof value === 'object' && 'risk' in value && 'weight_history' in value);
}

function mergeCurves(result: PortfolioRunSummary) {
  const benchmark = new Map(result.benchmark_curve.map(point => [point.date, point.value]));
  return result.equity_curve.map(point => ({ date: point.date, strategy: point.value, benchmark: benchmark.get(point.date) }));
}

function formatPercent(value: number | null | undefined) {
  return value === null || value === undefined ? '-' : `${(value * 100).toFixed(2)}%`;
}

function formatNumber(value: number | null | undefined) {
  return value === null || value === undefined ? '-' : value.toFixed(2);
}