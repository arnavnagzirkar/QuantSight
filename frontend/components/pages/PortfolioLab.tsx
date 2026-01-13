import { useState } from 'react';
import { Play, Settings } from 'lucide-react';
import { PortfolioWeightsChart } from '../charts/PortfolioWeightsChart';
import { AttributionChart } from '../charts/AttributionChart';

const ALLOCATION_METHODS = [
  { value: 'equal_weight', label: 'Equal Weight' },
  { value: 'risk_parity', label: 'Risk Parity' },
  { value: 'mean_variance', label: 'Mean-Variance' },
  { value: 'signal_weighted', label: 'Signal Weighted' },
  { value: 'quantile', label: 'Quantile Based' },
];

const REBALANCE_FREQ = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export function PortfolioLab() {
  const [allocMethod, setAllocMethod] = useState('signal_weighted');
  const [rebalanceFreq, setRebalanceFreq] = useState('weekly');
  const [turnoverCost, setTurnoverCost] = useState(0.001);
  const [running, setRunning] = useState(false);

  const handleRun = () => {
    setRunning(true);
    setTimeout(() => setRunning(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Portfolio Lab</h1>
          <p className="text-muted-foreground">
            Multi-ticker portfolio construction with cross-sectional allocation engines
          </p>
        </div>
        <button
          onClick={handleRun}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {running ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Running...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              <span>Run Backtest</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="text-sm text-muted-foreground mb-1">Portfolio Sharpe</div>
          <div className="text-2xl font-bold text-foreground">1.92</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="text-sm text-muted-foreground mb-1">Portfolio CAGR</div>
          <div className="text-2xl font-bold text-foreground">16.8%</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="text-sm text-muted-foreground mb-1">Avg Turnover</div>
          <div className="text-2xl font-bold text-foreground">12.3%</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="text-sm text-muted-foreground mb-1">Turnover Cost</div>
          <div className="text-2xl font-bold text-foreground">-0.8%</div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <Settings className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Portfolio Configuration</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              Allocation Method
            </label>
            <select
              value={allocMethod}
              onChange={(e) => setAllocMethod(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            >
              {ALLOCATION_METHODS.map(method => (
                <option key={method.value} value={method.value}>{method.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              Rebalance Frequency
            </label>
            <select
              value={rebalanceFreq}
              onChange={(e) => setRebalanceFreq(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            >
              {REBALANCE_FREQ.map(freq => (
                <option key={freq.value} value={freq.value}>{freq.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              Turnover Cost (bps)
            </label>
            <input
              type="number"
              value={turnoverCost * 10000}
              onChange={(e) => setTurnoverCost(parseFloat(e.target.value) / 10000)}
              step="0.1"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-1">Portfolio Weights Evolution</h2>
            <p className="text-sm text-muted-foreground">Stacked area showing weight allocation over time</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 text-sm bg-primary/10 text-primary rounded border border-primary/20">
              Area
            </button>
            <button className="px-3 py-1 text-sm text-muted-foreground hover:bg-accent rounded">
              Heatmap
            </button>
          </div>
        </div>
        <PortfolioWeightsChart />
      </div>

      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-1">6-Month Attribution</h2>
            <p className="text-sm text-muted-foreground">Contribution to portfolio returns by ticker</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 text-sm bg-primary/10 text-primary rounded border border-primary/20">
              Absolute
            </button>
            <button className="px-3 py-1 text-sm text-muted-foreground hover:bg-accent rounded">
              Percentage
            </button>
          </div>
        </div>
        <AttributionChart />
      </div>
    </div>
  );
}
