// This is an example file showing how to integrate API calls into your components
// You can use this as a reference for updating other pages

import { useEffect, useState } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Skeleton } from '../ui/skeleton';
import { toast } from 'sonner';
import { useDashboard, useModels } from '../../hooks/useAPI';

export function APIIntegrationExample() {
  // Example 1: Using hooks for automatic data fetching
  const { overview, equityCurve, signals } = useDashboard();

  // Fetch data on component mount
  useEffect(() => {
    overview.execute();
    signals.execute(5); // Get 5 most recent signals
  }, []);

  // Example 2: Manual data fetching with button click
  const handleRefresh = () => {
    overview.execute();
    toast.info('Refreshing data...');
  };

  // Example 3: Fetching with parameters
  const handleLoadEquityCurve = () => {
    equityCurve.execute({
      startDate: '2023-01-01',
      endDate: '2024-01-01'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">API Integration Example</h1>
          <p className="text-muted-foreground">
            Reference implementation for connecting to Flask backend
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={overview.loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${overview.loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Example 1: Display loading state */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">Portfolio Overview</h2>
        
        {overview.loading && (
          <div className="space-y-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
          </div>
        )}

        {overview.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load data: {overview.error.message}
            </AlertDescription>
          </Alert>
        )}

        {(overview.data ? (
          <div className="space-y-3">
            <MetricRow label="Portfolio Value" value={`$${(overview.data as any).portfolioValue?.toLocaleString()}`} />
            <MetricRow label="Total Return" value={`${(overview.data as any).totalReturn}%`} />
            <MetricRow label="Sharpe Ratio" value={(overview.data as any).sharpeRatio?.toFixed(2)} />
            <MetricRow label="Max Drawdown" value={`${(overview.data as any).maxDrawdown}%`} />
            <MetricRow label="Active Models" value={(overview.data as any).activeModels} />
          </div>
        ) : null)}
      </Card>

      {/* Example 2: Display signals data */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">Recent Signals</h2>
        
        {signals.loading && <Skeleton className="h-32 w-full" />}

        {signals.error && (
          <p className="text-destructive text-sm">Error loading signals: {signals.error.message}</p>
        )}

        {signals.data && (signals.data as any).length > 0 ? (
          <div className="space-y-2">
            {(signals.data as any).map((signal: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-accent rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-foreground">{signal.ticker}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    signal.side === 'LONG'
                      ? 'bg-chart-4/10 text-chart-4'
                      : 'bg-chart-3/10 text-chart-3'
                  }`}>
                    {signal.side}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  Confidence: {(signal.confidence * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        ) : (
          !signals.loading && <p className="text-muted-foreground">No signals available</p>
        )}
      </Card>

      {/* Example 3: Load data on demand */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Equity Curve</h2>
          <Button 
            onClick={handleLoadEquityCurve} 
            disabled={equityCurve.loading}
            size="sm"
          >
            {equityCurve.loading ? 'Loading...' : 'Load Data'}
          </Button>
        </div>

        {(equityCurve.data ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Data points: {(equityCurve.data as any).dates?.length || 0}
            </p>
            {/* Render your chart here with equityCurve.data */}
          </div>
        ) : null)}
      </Card>

      {/* Example 4: Using multiple hooks */}
      <ModelTrainingExample />

      {/* Code examples */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">Code Examples</h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="text-sm text-foreground mb-2">1. Basic Hook Usage</h3>
            <pre className="bg-card border border-border p-4 rounded-lg text-xs overflow-x-auto">
{`import { useDashboard } from '../hooks/useAPI';

function MyComponent() {
  const { overview } = useDashboard();

  useEffect(() => {
    overview.execute();
  }, []);

  if (overview.loading) return <div>Loading...</div>;
  if (overview.error) return <div>Error!</div>;
  
  return <div>{overview.data?.portfolioValue}</div>;
}`}
            </pre>
          </div>

          <div>
            <h3 className="text-sm text-gray-900 dark:text-white mb-2">2. With Parameters</h3>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto">
{`const { compute } = useFactors();

const handleCompute = () => {
  compute.execute({
    tickers: ['AAPL', 'MSFT'],
    factors: ['momentum', 'value'],
    startDate: '2023-01-01',
    endDate: '2024-01-01'
  });
};`}
            </pre>
          </div>

          <div>
            <h3 className="text-sm text-gray-900 dark:text-white mb-2">3. Direct API Call</h3>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto">
{`import api from '../services/api';

async function fetchData() {
  try {
    const data = await api.model.trainModel({
      name: 'My Model',
      factors: ['momentum', 'value'],
      tickers: ['AAPL'],
      target: 'returns_5d',
      params: { max_depth: 5 }
    });
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}`}
            </pre>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Example component showing model training integration
function ModelTrainingExample() {
  const { train } = useModels();
  const [formData, setFormData] = useState({
    name: 'Example Model',
    factors: ['momentum_12m', 'pe_ratio'],
    tickers: ['AAPL', 'MSFT'],
    target: 'returns_5d',
  });

  const handleTrainModel = () => {
    train.execute({
      ...formData,
      params: {
        max_depth: 5,
        learning_rate: 0.1,
        n_estimators: 100,
      },
      walkForwardParams: {
        trainDays: 252,
        testDays: 63,
        retrainFrequency: 21,
      },
    });

    toast.success('Model training started');
  };

  return (
    <Card className="p-6">
      <h2 className="text-gray-900 dark:text-white mb-4">Model Training Example</h2>
      
      <div className="space-y-4">
        <div>
          <label className="text-sm text-gray-600 dark:text-gray-400 block mb-1">
            Model Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
        </div>

        <Button 
          onClick={handleTrainModel} 
          disabled={train.loading}
        >
          {train.loading ? 'Training...' : 'Train Model'}
        </Button>

        {(train.data ? (
          <Alert>
            <AlertDescription>
              Model training started! Model ID: {(train.data as any).modelId}
            </AlertDescription>
          </Alert>
        ) : null)}

        {train.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Training failed: {train.error.message}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </Card>
  );
}

function MetricRow({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-800 last:border-0">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <span className="text-gray-900 dark:text-white">{value || 'N/A'}</span>
    </div>
  );
}
