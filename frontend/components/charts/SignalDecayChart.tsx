import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface SignalDecayChartProps {
  data: Array<{ horizon: number; pearson: number | null; spearman: number | null }>;
}

export function SignalDecayChart({ data }: SignalDecayChartProps) {
  if (data.length === 0) {
    return <div className="h-80 flex items-center justify-center text-muted-foreground">No signal decay data available</div>;
  }
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
          <XAxis dataKey="horizon" tick={{ fontSize: 12 }} tickFormatter={(value: number) => `${value}d`} />
          <YAxis tick={{ fontSize: 12 }} domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.95)', border: '1px solid rgba(75, 85, 99, 0.5)', borderRadius: '8px', color: '#fff' }}
            formatter={(value: number) => [value.toFixed(3), '']}
          />
          <Legend />
          <Line type="monotone" dataKey="pearson" stroke="#14b8a6" strokeWidth={2} dot={{ r: 4 }} name="IC (Pearson)" />
          <Line type="monotone" dataKey="spearman" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} name="IC (Spearman)" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}