import { TrendingUp, TrendingDown, Activity, DollarSign } from 'lucide-react';
import { MetricCard } from '../MetricCard';
import { EquityCurveChart } from '../charts/EquityCurveChart';
import { PerformanceTable } from '../PerformanceTable';

export function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your quantitative research and portfolio performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Portfolio Value"
          value="$1,245,678"
          change="+12.4%"
          changeType="positive"
          icon={DollarSign}
        />
        <MetricCard
          title="Sharpe Ratio"
          value="1.82"
          subtitle="Annual"
          icon={TrendingUp}
        />
        <MetricCard
          title="Max Drawdown"
          value="-8.3%"
          changeType="negative"
          icon={TrendingDown}
        />
        <MetricCard
          title="Active Models"
          value="3"
          subtitle="Running"
          icon={Activity}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-1">Portfolio Equity Curve</h2>
                <p className="text-sm text-muted-foreground">Strategy vs Buy & Hold Benchmark</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 bg-chart-1 rounded-full"></span>
                  <span className="text-foreground">Strategy</span>
                </span>
                <span className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 bg-muted-foreground rounded-full"></span>
                  <span className="text-foreground">Benchmark</span>
                </span>
              </div>
            </div>
            <EquityCurveChart />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-4">Key Metrics</h3>
            <div className="space-y-4">
              <MetricRow label="CAGR" value="18.5%" />
              <MetricRow label="Annual Vol" value="14.2%" />
              <MetricRow label="Sortino" value="2.41" />
              <MetricRow label="Alpha" value="4.8%" />
              <MetricRow label="Beta" value="0.78" />
              <MetricRow label="Information Ratio" value="1.23" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-4">Recent Signals</h3>
            <div className="space-y-3">
              <SignalItem ticker="AAPL" signal="LONG" confidence={0.78} />
              <SignalItem ticker="MSFT" signal="LONG" confidence={0.65} />
              <SignalItem ticker="GOOGL" signal="SHORT" confidence={0.52} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-foreground mb-4">Top Holdings Performance</h2>
        <PerformanceTable data={[
          { name: 'AAPL', returns: 12.4, sharpe: 1.8, maxDrawdown: -8.2 },
          { name: 'MSFT', returns: 15.7, sharpe: 2.1, maxDrawdown: -6.5 },
          { name: 'GOOGL', returns: 8.9, sharpe: 1.5, maxDrawdown: -11.3 }
        ]} />
      </div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function SignalItem({ ticker, signal, confidence }: { ticker: string; signal: string; confidence: number }) {
  const isLong = signal === 'LONG';
  return (
    <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
      <div className="flex items-center gap-3">
        <span className="font-medium text-foreground">{ticker}</span>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          isLong 
            ? 'bg-chart-1/10 text-chart-1' 
            : 'bg-chart-3/10 text-chart-3'
        }`}>
          {signal}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-chart-1"
            style={{ width: `${confidence * 100}%` }}
          />
        </div>
        <span className="text-sm text-muted-foreground w-12 text-right">
          {(confidence * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
