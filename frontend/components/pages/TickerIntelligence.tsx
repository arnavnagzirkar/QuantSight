// import { TrendingUp, DollarSign, Activity, BarChart3 } from 'lucide-react';
import { EquityCurveChart } from '../charts/EquityCurveChart';
import { FactorTable } from '../FactorTable';

export function TickerIntelligence() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Ticker Intelligence</h1>
        <p className="text-muted-foreground">
          Deep dive into ticker price action, sentiment, and factor snapshot
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="text-sm text-muted-foreground mb-1">Current Price</div>
          <div className="text-2xl font-bold text-foreground">$178.42</div>
          <div className="text-sm text-chart-4 mt-1">+2.4%</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="text-sm text-muted-foreground mb-1">Model Signal</div>
          <div className="text-2xl font-bold text-foreground">LONG</div>
          <div className="text-sm text-muted-foreground mt-1">78% confidence</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="text-sm text-muted-foreground mb-1">20D Volatility</div>
          <div className="text-2xl font-bold text-foreground">24.3%</div>
          <div className="text-sm text-muted-foreground mt-1">Annualized</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="text-sm text-muted-foreground mb-1">Sentiment</div>
          <div className="text-2xl font-bold text-foreground">Positive</div>
          <div className="text-sm text-chart-4 mt-1">42 headlines</div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-foreground mb-4">Price Chart (1Y)</h2>
        <EquityCurveChart />
      </div>

      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-foreground mb-4">Factor Snapshot (Last 20 Days)</h2>
        <FactorTable data={[
          { factor: 'PE Ratio', value: 28.5 },
          { factor: 'ROE', value: 0.42 },
          { factor: 'Debt/Equity', value: 1.2 }
        ]} />
      </div>
    </div>
  );
}
