import { useState } from 'react';
import { Play, Download, Calendar, DollarSign } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { DateRangePicker } from '../DateRangePicker';
import { TickerMultiSelect } from '../TickerMultiSelect';
import { EquityCurveChart } from '../charts/EquityCurveChart';
import { LongShortEquityChart } from '../charts/LongShortEquityChart';
import { MetricCard } from '../MetricCard';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';

interface BacktestResult {
  totalReturn: number;
  cagr: number;
  sharpe: number;
  sortino: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
}

export function StrategyBacktest() {
  const [isRunning, setIsRunning] = useState(false);
  const [hasResults, setHasResults] = useState(true); // Set to true for demo
  const [strategyType, setStrategyType] = useState('long-short');
  const [tickers, setTickers] = useState<string[]>(['AAPL', 'MSFT', 'GOOGL']);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});

  // Mock results for demonstration
  const mockResults: BacktestResult = {
    totalReturn: 42.5,
    cagr: 18.3,
    sharpe: 1.85,
    sortino: 2.41,
    maxDrawdown: -12.4,
    winRate: 58.2,
    profitFactor: 1.82,
    totalTrades: 247,
  };

  const mockTrades = [
    { date: '2024-11-20', ticker: 'AAPL', side: 'LONG', entry: 185.20, exit: 192.40, return: 3.9, pnl: 720 },
    { date: '2024-11-18', ticker: 'MSFT', side: 'LONG', entry: 370.50, exit: 378.20, return: 2.1, pnl: 385 },
    { date: '2024-11-15', ticker: 'GOOGL', side: 'SHORT', entry: 142.80, exit: 138.90, return: 2.7, pnl: 390 },
    { date: '2024-11-12', ticker: 'TSLA', side: 'LONG', entry: 238.50, exit: 235.10, return: -1.4, pnl: -170 },
    { date: '2024-11-10', ticker: 'NVDA', side: 'LONG', entry: 485.20, exit: 498.70, return: 2.8, pnl: 675 },
  ];

  const handleRunBacktest = () => {
    setIsRunning(true);
    // Simulate API call
    setTimeout(() => {
      setIsRunning(false);
      setHasResults(true);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Strategy Backtest</h1>
        <p className="text-muted-foreground">
          Test trading strategies with historical data and analyze performance
        </p>
      </div>

      {/* Configuration Panel */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">Backtest Configuration</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="strategy">Strategy Type</Label>
              <Select value={strategyType} onValueChange={setStrategyType}>
                <SelectTrigger id="strategy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="long-only">Long Only</SelectItem>
                  <SelectItem value="long-short">Long-Short</SelectItem>
                  <SelectItem value="market-neutral">Market Neutral</SelectItem>
                  <SelectItem value="pairs-trading">Pairs Trading</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Select defaultValue="model_1">
                <SelectTrigger id="model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="model_1">Momentum + Value XGBoost</SelectItem>
                  <SelectItem value="model_2">Quality Factor Ensemble</SelectItem>
                  <SelectItem value="model_3">Mean Reversion RF</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tickers</Label>
              <TickerMultiSelect value={tickers} onChange={setTickers} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Date Range</Label>
              <DateRangePicker 
                from={dateRange.from} 
                to={dateRange.to} 
                onSelect={setDateRange} 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="capital">Initial Capital</Label>
              <Input
                id="capital"
                type="number"
                defaultValue="100000"
                placeholder="100000"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rebalance">Rebalance</Label>
                <Select defaultValue="daily">
                  <SelectTrigger id="rebalance">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="commission">Commission (bps)</Label>
                <Input
                  id="commission"
                  type="number"
                  defaultValue="5"
                  placeholder="5"
                />
              </div>
            </div>

            <Button 
              onClick={handleRunBacktest} 
              disabled={isRunning}
              className="w-full"
            >
              {isRunning ? (
                <>Running Backtest...</>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Backtest
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Results Section */}
      {hasResults && (
        <>
          {/* Performance Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              title="Total Return"
              value={`${mockResults.totalReturn >= 0 ? '+' : ''}${mockResults.totalReturn.toFixed(1)}%`}
              changeType={mockResults.totalReturn >= 0 ? 'positive' : 'negative'}
              icon={DollarSign}
            />
            <MetricCard
              title="CAGR"
              value={`${mockResults.cagr.toFixed(1)}%`}
              subtitle="Annualized"
              icon={Calendar}
            />
            <MetricCard
              title="Sharpe Ratio"
              value={mockResults.sharpe.toFixed(2)}
              subtitle="Risk-adjusted"
            />
            <MetricCard
              title="Max Drawdown"
              value={`${mockResults.maxDrawdown.toFixed(1)}%`}
              changeType="negative"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              title="Sortino Ratio"
              value={mockResults.sortino.toFixed(2)}
            />
            <MetricCard
              title="Win Rate"
              value={`${mockResults.winRate.toFixed(1)}%`}
            />
            <MetricCard
              title="Profit Factor"
              value={mockResults.profitFactor.toFixed(2)}
            />
            <MetricCard
              title="Total Trades"
              value={mockResults.totalTrades.toString()}
            />
          </div>

          {/* Charts and Analysis */}
          <Tabs defaultValue="equity" className="space-y-4">
            <TabsList>
              <TabsTrigger value="equity">Equity Curve</TabsTrigger>
              <TabsTrigger value="long-short">Long/Short Breakdown</TabsTrigger>
              <TabsTrigger value="trades">Trade History</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="equity" className="space-y-4">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-gray-900 dark:text-white mb-1">Equity Curve</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Strategy performance vs benchmark
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </div>
                <EquityCurveChart />
              </Card>
            </TabsContent>

            <TabsContent value="long-short" className="space-y-4">
              <Card className="p-6">
                <h2 className="text-gray-900 dark:text-white mb-6">Long/Short Attribution</h2>
                <LongShortEquityChart />
              </Card>
            </TabsContent>

            <TabsContent value="trades" className="space-y-4">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-gray-900 dark:text-white">Trade History</h2>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Export Trades
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Ticker</TableHead>
                      <TableHead>Side</TableHead>
                      <TableHead>Entry</TableHead>
                      <TableHead>Exit</TableHead>
                      <TableHead>Return</TableHead>
                      <TableHead className="text-right">P&L</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockTrades.map((trade, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-gray-600 dark:text-gray-400">
                          {new Date(trade.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-gray-900 dark:text-white">
                          {trade.ticker}
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs ${
                            trade.side === 'LONG'
                              ? 'bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-400'
                              : 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400'
                          }`}>
                            {trade.side}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-600 dark:text-gray-400">
                          ${trade.entry.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-gray-600 dark:text-gray-400">
                          ${trade.exit.toFixed(2)}
                        </TableCell>
                        <TableCell className={trade.return >= 0 ? 'text-teal-600' : 'text-red-600'}>
                          {trade.return >= 0 ? '+' : ''}{trade.return.toFixed(1)}%
                        </TableCell>
                        <TableCell className={`text-right ${trade.pnl >= 0 ? 'text-teal-600' : 'text-red-600'}`}>
                          ${trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h3 className="text-gray-900 dark:text-white mb-4">Risk Metrics</h3>
                  <div className="space-y-3">
                    <MetricRow label="Annualized Volatility" value="15.2%" />
                    <MetricRow label="Downside Deviation" value="9.8%" />
                    <MetricRow label="VaR (95%)" value="-2.4%" />
                    <MetricRow label="CVaR (95%)" value="-3.8%" />
                    <MetricRow label="Beta" value="0.72" />
                    <MetricRow label="Alpha" value="5.2%" />
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-gray-900 dark:text-white mb-4">Trade Statistics</h3>
                  <div className="space-y-3">
                    <MetricRow label="Avg Win" value="+2.8%" />
                    <MetricRow label="Avg Loss" value="-1.5%" />
                    <MetricRow label="Largest Win" value="+8.4%" />
                    <MetricRow label="Largest Loss" value="-4.2%" />
                    <MetricRow label="Avg Hold Time" value="3.2 days" />
                    <MetricRow label="Turnover" value="145%" />
                  </div>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-800 last:border-0">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <span className="text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}
