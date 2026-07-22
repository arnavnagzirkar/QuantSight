import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface EquityCurvePoint {
  date: string;
  strategy: number;
  benchmark?: number;
}

interface EquityCurveChartProps {
  data?: EquityCurvePoint[];
  valueFormat?: 'multiple' | 'currency';
}

export function EquityCurveChart({ data = [], valueFormat = 'multiple' }: EquityCurveChartProps) {
  if (data.length === 0) {
    return <div className="h-80 flex items-center justify-center text-muted-foreground">No equity data available</div>;
  }
  const hasBenchmark = data.some(point => point.benchmark !== undefined);
  const formatValue = (value: number) => valueFormat === 'currency'
    ? `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : `${value.toFixed(2)}x`;

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
            className="text-gray-600 dark:text-gray-400"
            tickFormatter={(value) => {
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            className="text-gray-600 dark:text-gray-400"
            tickFormatter={(value: number) => formatValue(value)}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(17, 24, 39, 0.95)',
              border: '1px solid rgba(75, 85, 99, 0.5)',
              borderRadius: '8px',
              color: '#fff'
            }}
            formatter={(value: number) => [formatValue(value), '']}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="strategy" 
            stroke="#14b8a6" 
            strokeWidth={2}
            dot={false}
            name="Strategy"
          />
          {hasBenchmark && (
            <Line
              type="monotone"
              dataKey="benchmark"
              stroke="#9ca3af"
              strokeWidth={2}
              dot={false}
              name="Benchmark"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
