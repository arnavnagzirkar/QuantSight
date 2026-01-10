// import { TrendingUp, BarChart3 } from 'lucide-react';
import { SignalDecayChart } from '../charts/SignalDecayChart';
import { QuantileReturnsChart } from '../charts/QuantileReturnsChart';
import { LongShortEquityChart } from '../charts/LongShortEquityChart';

export function SignalDiagnostics() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Signal Diagnostics</h1>
        <p className="text-muted-foreground">
          Analyze signal decay and quantile-based forward returns
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="text-sm text-muted-foreground mb-1">Avg IC (Pearson)</div>
          <div className="text-2xl font-bold text-foreground">0.142</div>
          <div className="text-sm text-chart-4 mt-1">5-day horizon</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="text-sm text-muted-foreground mb-1">Avg IC (Spearman)</div>
          <div className="text-2xl font-bold text-foreground">0.158</div>
          <div className="text-sm text-chart-4 mt-1">5-day horizon</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="text-sm text-muted-foreground mb-1">Long/Short Spread</div>
          <div className="text-2xl font-bold text-foreground">+8.3%</div>
          <div className="text-sm text-muted-foreground mt-1">Q5 vs Q1</div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-1">Signal Decay IC</h2>
          <p className="text-sm text-muted-foreground">
            Information Coefficient vs forward return horizons
          </p>
        </div>
        <SignalDecayChart />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-foreground mb-1">Quantile Forward Returns</h2>
            <p className="text-sm text-muted-foreground">
              Mean returns by signal strength quintile
            </p>
          </div>
          <QuantileReturnsChart />
        </div>

        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-foreground mb-1">Long/Short Equity Curve</h2>
            <p className="text-sm text-muted-foreground">
              Q5 (top quintile) vs Q1 (bottom quintile)
            </p>
          </div>
          <LongShortEquityChart />
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-foreground mb-4">Quantile Statistics</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-muted-foreground">Quantile</th>
                <th className="text-right py-3 px-4 text-muted-foreground">Mean Return (1d)</th>
                <th className="text-right py-3 px-4 text-muted-foreground">Mean Return (5d)</th>
                <th className="text-right py-3 px-4 text-muted-foreground">Mean Return (20d)</th>
                <th className="text-right py-3 px-4 text-muted-foreground">Hit Rate</th>
              </tr>
            </thead>
            <tbody>
              {[
                { q: 'Q5 (Top)', ret1d: 0.082, ret5d: 0.41, ret20d: 1.85, hit: 0.58 },
                { q: 'Q4', ret1d: 0.045, ret5d: 0.23, ret20d: 1.12, hit: 0.54 },
                { q: 'Q3', ret1d: 0.018, ret5d: 0.09, ret20d: 0.45, hit: 0.51 },
                { q: 'Q2', ret1d: -0.012, ret5d: -0.05, ret20d: -0.28, hit: 0.48 },
                { q: 'Q1 (Bottom)', ret1d: -0.065, ret5d: -0.32, ret20d: -1.42, hit: 0.42 },
              ].map((row) => (
                <tr key={row.q} className="border-b border-border">
                  <td className="py-3 px-4 font-medium text-foreground">{row.q}</td>
                  <td className={`text-right py-3 px-4 ${row.ret1d >= 0 ? 'text-chart-4' : 'text-chart-3'}`}>
                    {(row.ret1d * 100).toFixed(2)}%
                  </td>
                  <td className={`text-right py-3 px-4 ${row.ret5d >= 0 ? 'text-chart-4' : 'text-chart-3'}`}>
                    {(row.ret5d * 100).toFixed(2)}%
                  </td>
                  <td className={`text-right py-3 px-4 ${row.ret20d >= 0 ? 'text-chart-4' : 'text-chart-3'}`}>
                    {(row.ret20d * 100).toFixed(2)}%
                  </td>
                  <td className="text-right py-3 px-4 text-foreground">
                    {(row.hit * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
