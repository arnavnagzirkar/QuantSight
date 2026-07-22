import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface DrawdownChartProps {
  data: Array<{ date: string; value: number }>;
}

export function DrawdownChart({ data }: DrawdownChartProps) {
  if (data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-muted-foreground">No drawdown data available</div>;
  }
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 8, left: 8, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
          <XAxis dataKey="date" minTickGap={32} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(value: number) => `${(value * 100).toFixed(0)}%`} />
          <Tooltip
            formatter={(value: number) => [`${(value * 100).toFixed(2)}%`, 'Drawdown']}
            contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.95)', border: '1px solid rgba(75, 85, 99, 0.5)', borderRadius: '8px', color: '#fff' }}
          />
          <Area type="monotone" dataKey="value" stroke="#ef4444" fill="#ef4444" fillOpacity={0.35} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}