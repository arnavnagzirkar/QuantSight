import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface AttributionChartProps {
  data?: Array<{ ticker: string; contribution: number }>;
}

export function AttributionChart({ data = [] }: AttributionChartProps) {
  if (data.length === 0) {
    return <div className="h-80 flex items-center justify-center text-muted-foreground">No attribution data available</div>;
  }
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
          <XAxis 
            dataKey="ticker" 
            tick={{ fontSize: 12 }}
            className="text-gray-600 dark:text-gray-400"
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            className="text-gray-600 dark:text-gray-400"
            tickFormatter={(value: number) => `${(value * 100).toFixed(1)}%`}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(17, 24, 39, 0.95)',
              border: '1px solid rgba(75, 85, 99, 0.5)',
              borderRadius: '8px',
              color: '#fff'
            }}
            formatter={(value: number) => [`${(value * 100).toFixed(2)}%`, 'Contribution']}
          />
          <Bar dataKey="contribution" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.contribution >= 0 ? '#14b8a6' : '#f97316'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
