import { useState } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Shield, Activity } from 'lucide-react';
import { Card } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { MetricCard } from '../MetricCard';
import { EquityCurveChart } from '../charts/EquityCurveChart';
import { AttributionChart } from '../charts/AttributionChart';
import { CorrelationHeatmap } from '../charts/CorrelationHeatmap';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Progress } from '../ui/progress';

interface DrawdownPeriod {
  start: string;
  end: string;
  depth: number;
  length: number;
  recovery?: string;
}

interface RiskContribution {
  ticker: string;
  weight: number;
  volatility: number;
  beta: number;
  varContribution: number;
  marginalVar: number;
}

export function RiskPerformance() {
  const [selectedPortfolio, setSelectedPortfolio] = useState('main');
  const [timeHorizon, setTimeHorizon] = useState('1y');

  // Mock data
  const mockDrawdowns: DrawdownPeriod[] = [
    { start: '2024-08-15', end: '2024-09-20', depth: -12.4, length: 36, recovery: '2024-10-05' },
    { start: '2024-03-10', end: '2024-04-05', depth: -8.7, length: 26, recovery: '2024-04-18' },
    { start: '2023-11-02', end: '2023-11-22', depth: -6.2, length: 20, recovery: '2023-12-01' },
  ];

  const mockRiskContributions: RiskContribution[] = [
    { ticker: 'AAPL', weight: 15.2, volatility: 22.5, beta: 1.15, varContribution: 18.3, marginalVar: 1.20 },
    { ticker: 'MSFT', weight: 14.8, volatility: 20.1, beta: 1.08, varContribution: 16.9, marginalVar: 1.14 },
    { ticker: 'GOOGL', weight: 12.5, volatility: 24.8, beta: 1.22, varContribution: 15.2, marginalVar: 1.22 },
    { ticker: 'NVDA', weight: 11.3, volatility: 35.2, beta: 1.45, varContribution: 19.8, marginalVar: 1.75 },
    { ticker: 'TSLA', weight: 8.2, volatility: 42.1, beta: 1.68, varContribution: 14.5, marginalVar: 1.77 },
  ];

  const mockStressScenarios = [
    { name: '2008 Financial Crisis', impact: -24.5, probability: 'Low' },
    { name: 'COVID-19 Crash (2020)', impact: -18.2, probability: 'Low' },
    { name: 'Tech Bubble (2000)', impact: -31.7, probability: 'Very Low' },
    { name: 'Flash Crash (2010)', impact: -12.8, probability: 'Low' },
    { name: 'Rate Spike +200bps', impact: -15.3, probability: 'Medium' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Risk & Performance</h1>
          <p className="text-muted-foreground">
            Comprehensive risk analytics and performance attribution
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={timeHorizon} onValueChange={setTimeHorizon}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1m">1 Month</SelectItem>
              <SelectItem value="3m">3 Months</SelectItem>
              <SelectItem value="6m">6 Months</SelectItem>
              <SelectItem value="1y">1 Year</SelectItem>
              <SelectItem value="3y">3 Years</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedPortfolio} onValueChange={setSelectedPortfolio}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="main">Main Portfolio</SelectItem>
              <SelectItem value="aggressive">Aggressive Growth</SelectItem>
              <SelectItem value="conservative">Conservative</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Key Risk Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard
          title="Portfolio VaR"
          value="-2.4%"
          subtitle="95% 1-day"
          changeType="negative"
          icon={AlertTriangle}
        />
        <MetricCard
          title="CVaR"
          value="-3.8%"
          subtitle="Expected shortfall"
          changeType="negative"
          icon={TrendingDown}
        />
        <MetricCard
          title="Volatility"
          value="15.2%"
          subtitle="Annualized"
          icon={Activity}
        />
        <MetricCard
          title="Beta"
          value="0.82"
          subtitle="vs SPY"
          icon={TrendingUp}
        />
        <MetricCard
          title="Tracking Error"
          value="4.2%"
          subtitle="vs Benchmark"
          icon={Shield}
        />
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="drawdowns">Drawdowns</TabsTrigger>
          <TabsTrigger value="risk-decomp">Risk Decomposition</TabsTrigger>
          <TabsTrigger value="stress-test">Stress Testing</TabsTrigger>
          <TabsTrigger value="attribution">Attribution</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="p-6">
                <h2 className="text-xl font-semibold text-foreground mb-6">Risk-Adjusted Returns</h2>
                <EquityCurveChart />
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Performance Summary</h3>
                <div className="space-y-3">
                  <MetricRow label="Total Return" value="+42.5%" positive />
                  <MetricRow label="CAGR" value="18.3%" />
                  <MetricRow label="Sharpe Ratio" value="1.85" />
                  <MetricRow label="Sortino Ratio" value="2.41" />
                  <MetricRow label="Calmar Ratio" value="1.48" />
                  <MetricRow label="Max Drawdown" value="-12.4%" negative />
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Risk Metrics</h3>
                <div className="space-y-3">
                  <MetricRow label="Annualized Vol" value="15.2%" />
                  <MetricRow label="Downside Dev" value="9.8%" />
                  <MetricRow label="Skewness" value="-0.15" />
                  <MetricRow label="Kurtosis" value="2.84" />
                  <MetricRow label="Tail Risk" value="3.2%" />
                </div>
              </Card>
            </div>
          </div>

          <Card className="p-6">
            <h2 className="text-xl font-semibold text-foreground mb-6">Correlation Matrix</h2>
            <CorrelationHeatmap />
          </Card>
        </TabsContent>

        <TabsContent value="drawdowns" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-foreground mb-6">Major Drawdown Periods</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Depth</TableHead>
                  <TableHead>Length (days)</TableHead>
                  <TableHead>Recovery Date</TableHead>
                  <TableHead>Recovery Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockDrawdowns.map((dd, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-muted-foreground">
                      {new Date(dd.start).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(dd.end).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-destructive">
                      {dd.depth.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-foreground">
                      {dd.length}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {dd.recovery ? new Date(dd.recovery).toLocaleDateString() : 'Ongoing'}
                    </TableCell>
                    <TableCell className="text-foreground">
                      {dd.recovery 
                        ? Math.floor((new Date(dd.recovery).getTime() - new Date(dd.end).getTime()) / (1000 * 60 * 60 * 24)) + ' days'
                        : '-'
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Drawdown Statistics</h3>
              <div className="space-y-3">
                <MetricRow label="Max Drawdown" value="-12.4%" />
                <MetricRow label="Avg Drawdown" value="-9.1%" />
                <MetricRow label="Avg Recovery Time" value="28 days" />
                <MetricRow label="Total Drawdown Periods" value="3" />
                <MetricRow label="Current Drawdown" value="-2.1%" />
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Underwater Chart</h3>
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                Underwater drawdown visualization
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="risk-decomp" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-foreground mb-6">Risk Contribution by Position</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>Volatility</TableHead>
                  <TableHead>Beta</TableHead>
                  <TableHead>VaR Contribution</TableHead>
                  <TableHead>Marginal VaR</TableHead>
                  <TableHead>Risk Contribution</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockRiskContributions.map((risk) => (
                  <TableRow key={risk.ticker}>
                    <TableCell className="text-foreground">
                      {risk.ticker}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {risk.weight.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {risk.volatility.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-foreground">
                      {risk.beta.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {risk.varContribution.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {risk.marginalVar.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={risk.varContribution} className="w-24" />
                        <span className="text-sm text-muted-foreground">
                          {risk.varContribution.toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Portfolio Composition</h3>
              <div className="space-y-3">
                <MetricRow label="Number of Positions" value="15" />
                <MetricRow label="Avg Position Size" value="6.7%" />
                <MetricRow label="Largest Position" value="15.2%" />
                <MetricRow label="Concentration (HHI)" value="0.082" />
                <MetricRow label="Effective N" value="12.2" />
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Factor Exposures</h3>
              <div className="space-y-3">
                <FactorExposure label="Market" value={0.82} />
                <FactorExposure label="Size" value={-0.15} />
                <FactorExposure label="Value" value={0.32} />
                <FactorExposure label="Momentum" value={0.58} />
                <FactorExposure label="Quality" value={0.41} />
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="stress-test" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-foreground mb-6">Historical Stress Scenarios</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scenario</TableHead>
                  <TableHead>Expected Impact</TableHead>
                  <TableHead>Probability</TableHead>
                  <TableHead>Visualization</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockStressScenarios.map((scenario, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-foreground">
                      {scenario.name}
                    </TableCell>
                    <TableCell className="text-destructive">
                      {scenario.impact.toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${
                        scenario.probability === 'Medium'
                          ? 'bg-chart-3/10 text-chart-3'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {scenario.probability}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-destructive"
                          style={{ width: `${Math.abs(scenario.impact) / 35 * 100}%` }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Custom Stress Test</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Market Shock (%)</label>
                  <input 
                    type="range" 
                    min="-50" 
                    max="0" 
                    defaultValue="-20"
                    className="w-full"
                  />
                  <div className="text-sm text-foreground text-center">-20%</div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Volatility Multiplier</label>
                  <input 
                    type="range" 
                    min="1" 
                    max="5" 
                    step="0.5"
                    defaultValue="2"
                    className="w-full"
                  />
                  <div className="text-sm text-foreground text-center">2.0x</div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Stress Test Results</h3>
              <div className="space-y-3">
                <MetricRow label="Portfolio Impact" value="-18.5%" />
                <MetricRow label="Expected Loss" value="$18,500" />
                <MetricRow label="Most Affected" value="NVDA (-28.3%)" />
                <MetricRow label="Best Hedge" value="TLT (+4.2%)" />
                <MetricRow label="Recovery Time" value="~45 days" />
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="attribution" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-foreground mb-6">Performance Attribution</h2>
            <AttributionChart />
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Return Decomposition</h3>
              <div className="space-y-3">
                <MetricRow label="Total Return" value="+42.5%" positive />
                <MetricRow label="Market Return" value="+28.3%" />
                <MetricRow label="Selection Effect" value="+10.2%" />
                <MetricRow label="Allocation Effect" value="+4.0%" />
                <MetricRow label="Interaction" value="+0.0%" />
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Top Contributors</h3>
              <div className="space-y-3">
                <ContributorRow ticker="NVDA" contribution={8.5} />
                <ContributorRow ticker="AAPL" contribution={6.2} />
                <ContributorRow ticker="MSFT" contribution={5.8} />
                <ContributorRow ticker="GOOGL" contribution={4.3} />
                <ContributorRow ticker="META" contribution={3.9} />
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricRow({ label, value, positive, negative }: { 
  label: string; 
  value: string; 
  positive?: boolean;
  negative?: boolean;
}) {
  const colorClass = positive 
    ? 'text-chart-4' 
    : negative 
    ? 'text-destructive' 
    : 'text-foreground';

  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={colorClass}>{value}</span>
    </div>
  );
}

function FactorExposure({ label, value }: { label: string; value: number }) {
  const percentage = Math.abs(value) * 50; // Scale -2 to +2 range
  const isPositive = value >= 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground">{value.toFixed(2)}</span>
      </div>
      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={`absolute h-full ${isPositive ? 'bg-chart-4' : 'bg-chart-3'}`}
          style={{ 
            left: isPositive ? '50%' : `${50 - percentage}%`,
            width: `${percentage}%`
          }}
        />
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-muted-foreground/20" />
      </div>
    </div>
  );
}

function ContributorRow({ ticker, contribution }: { ticker: string; contribution: number }) {
  return (
    <div className="flex items-center justify-between p-2 bg-accent rounded">
      <span className="text-foreground">{ticker}</span>
      <div className="flex items-center gap-2">
        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-chart-4"
            style={{ width: `${(contribution / 10) * 100}%` }}
          />
        </div>
        <span className="text-sm text-chart-4 w-12 text-right">
          +{contribution.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
