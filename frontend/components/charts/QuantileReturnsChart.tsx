import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface QuantileReturnsChartProps {
  data: Array<{ quantile: number; mean_return: number | null }>;
}

export function QuantileReturnsChart({ data }: QuantileReturnsChartProps) {
  if (data.length === 0) {
    return <div className="h-80 flex items-center justify-center text-muted-foreground">No quantile return data available</div>;
  }
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
          <XAxis dataKey="quantile" tick={{ fontSize: 12 }} tickFormatter={(value: number) => `Q${value}`} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(value: number) => `${(value * 100).toFixed(1)}%`} />
          <Tooltip
            contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.95)', border: '1px solid rgba(75, 85, 99, 0.5)', borderRadius: '8px', color: '#fff' }}
            formatter={(value: number) => [`${(value * 100).toFixed(2)}%`, 'Mean Forward Return']}
          />
          <Bar dataKey="mean_return" fill="#14b8a6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}