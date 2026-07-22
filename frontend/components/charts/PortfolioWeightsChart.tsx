import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const colors = ['#14b8a6', '#10b981', '#06b6d4', '#8b5cf6', '#ec4899'];

interface PortfolioWeightsChartProps {
  data: Array<{ date: string; weights: Record<string, number> }>;
}

export function PortfolioWeightsChart({ data }: PortfolioWeightsChartProps) {
  if (data.length === 0) {
    return <div className="h-96 flex items-center justify-center text-muted-foreground">No portfolio weights available</div>;
  }
  const tickers = Array.from(new Set(data.flatMap(point => Object.keys(point.weights))));
  const chartData = data.map(point => ({
    date: point.date,
    ...Object.fromEntries(Object.entries(point.weights).map(([ticker, value]) => [ticker, value * 100])),
  }));

  return (
    <div className="h-96">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
            className="text-gray-600 dark:text-gray-400"
            tickFormatter={(value: string) => {
              const date = new Date(`${value}T00:00:00`);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            className="text-gray-600 dark:text-gray-400"
            tickFormatter={(value) => `${value.toFixed(0)}%`}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(17, 24, 39, 0.95)',
              border: '1px solid rgba(75, 85, 99, 0.5)',
              borderRadius: '8px',
              color: '#fff'
            }}
            formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Legend />
          {tickers.map((ticker, idx) => (
            <Area
              key={ticker}
              type="monotone"
              dataKey={ticker}
              stackId="1"
              stroke={colors[idx % colors.length]}
              fill={colors[idx % colors.length]}
              fillOpacity={0.7}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
