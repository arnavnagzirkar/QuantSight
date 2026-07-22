import { useEffect } from 'react';
import { Activity, BrainCircuit, TrendingDown, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

import { MetricCard } from '../MetricCard';
import { EquityCurveChart } from '../charts/EquityCurveChart';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { usePersistentAPI } from '../../hooks/usePersistentAPI';
import { dashboardAPI } from '../../services/api';
import type { APIEnvelope, DashboardData } from '../../types/api';

export function Dashboard() {
  const { data, loading, error, execute } = usePersistentAPI<APIEnvelope<DashboardData>>('dashboard', dashboardAPI.getDashboard);
  const dashboard = data?.data;

  useEffect(() => {
    void execute();
  }, [execute]);

  if (loading && !dashboard) {
    return <Card className="p-10 text-center text-muted-foreground">Loading your research dashboard...</Card>;
  }
  if (error) {
    return <Alert variant="destructive"><AlertDescription>{error.message}</AlertDescription></Alert>;
  }

  const overview = dashboard?.overview;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Your latest completed research and active background work</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Latest Equity"
          value={overview?.latest_equity === null || overview?.latest_equity === undefined ? '-' : `${overview.latest_equity.toFixed(2)}x`}
          subtitle={dashboard?.latest_run?.name || 'No completed portfolio or backtest'}
          icon={TrendingUp}
        />
        <MetricCard title="Sharpe Ratio" value={formatNumber(overview?.sharpe)} subtitle="Latest completed run" icon={Activity} />
        <MetricCard title="Max Drawdown" value={formatPercent(overview?.max_drawdown)} changeType="negative" icon={TrendingDown} />
        <MetricCard title="Active Jobs" value={overview?.active_jobs ?? 0} subtitle={`${overview?.completed_models ?? 0} completed models`} icon={BrainCircuit} />
      </div>

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold">Latest Equity Curve</h2>
            <p className="text-sm text-muted-foreground">Strategy versus configured benchmark</p>
          </div>
          {dashboard?.latest_run && <Badge variant="outline">{dashboard.latest_run.job_type.replace('_', ' ')}</Badge>}
        </div>
        <EquityCurveChart data={(dashboard?.equity_curve ?? []).map(point => ({
          date: point.date,
          strategy: point.strategy,
          benchmark: point.benchmark ?? undefined,
        }))} />
        {!dashboard?.latest_run && (
          <p className="text-center text-sm text-muted-foreground mt-3">
            Run a <Link className="text-primary hover:underline" to="/strategy-backtest">strategy backtest</Link> or{' '}
            <Link className="text-primary hover:underline" to="/portfolio-lab">portfolio simulation</Link> to populate this view.
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Latest Portfolio Weights</h2>
          <Table>
            <TableHeader><TableRow><TableHead>Ticker</TableHead><TableHead>Weight</TableHead><TableHead>Recent Contribution</TableHead></TableRow></TableHeader>
            <TableBody>{(dashboard?.holdings ?? []).map(holding => (
              <TableRow key={holding.ticker}>
                <TableCell className="font-medium">{holding.ticker}</TableCell>
                <TableCell>{(holding.weight * 100).toFixed(1)}%</TableCell>
                <TableCell>{formatPercent(holding.contribution)}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
          {dashboard?.holdings.length === 0 && <EmptyText text="No completed portfolio run yet" />}
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Research Jobs</h2>
          <div className="space-y-3">{(dashboard?.recent_jobs ?? []).map(job => (
            <div key={job.id} className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
              <div className="min-w-0">
                <p className="font-medium truncate">{job.name || job.job_type.replace('_', ' ')}</p>
                <p className="text-xs text-muted-foreground">{new Date(job.created_at).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="capitalize">{job.status.replace('_', ' ')}</Badge>
                {['queued', 'running', 'cancel_requested'].includes(job.status) && <p className="text-xs text-muted-foreground mt-1">{job.progress_percent}%</p>}
              </div>
            </div>
          ))}</div>
          {dashboard?.recent_jobs.length === 0 && <EmptyText text="No research jobs yet" />}
        </Card>
      </div>
    </div>
  );
}

function formatNumber(value: number | null | undefined) {
  return value === null || value === undefined ? '-' : value.toFixed(2);
}

function formatPercent(value: number | null | undefined) {
  return value === null || value === undefined ? '-' : `${(value * 100).toFixed(1)}%`;
}

function EmptyText({ text }: { text: string }) {
  return <p className="text-center text-sm text-muted-foreground py-8">{text}</p>;
}