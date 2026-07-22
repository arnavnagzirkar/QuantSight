import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface LongShortEquityChartProps {
  data?: Array<{ date: string; value: number }>;
}

export function LongShortEquityChart({ data = [] }: LongShortEquityChartProps) {
  if (data.length === 0) {
    return <div className="h-80 flex items-center justify-center text-muted-foreground">No long/short equity data available</div>;
  }
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <defs>
            <linearGradient id="colorDiff" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
          <XAxis dataKey="date" minTickGap={36} tick={{ fontSize: 12 }} tickFormatter={(value: string) => {
            const date = new Date(`${value}T00:00:00`);
            return `${date.getMonth() + 1}/${date.getDate()}`;
          }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(value: number) => `${((value - 1) * 100).toFixed(0)}%`} />
          <Tooltip
            contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.95)', border: '1px solid rgba(75, 85, 99, 0.5)', borderRadius: '8px', color: '#fff' }}
            formatter={(value: number) => [`${((value - 1) * 100).toFixed(2)}%`, 'Top - Bottom']}
          />
          <Area type="monotone" dataKey="value" stroke="#14b8a6" strokeWidth={2} fill="url(#colorDiff)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}