import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface FeatureImportanceChartProps {
  data: Array<{ feature: string; importance: number }>;
}

export function FeatureImportanceChart({ data }: FeatureImportanceChartProps) {
  const sortedData = [...data].sort((a, b) => b.importance - a.importance).slice(0, 15);
  if (sortedData.length === 0) {
    return <div className="h-80 flex items-center justify-center text-muted-foreground">Feature importance is not available for this model</div>;
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart 
          data={sortedData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
          <XAxis 
            type="number"
            tick={{ fontSize: 12 }}
            className="text-gray-600 dark:text-gray-400"
            tickFormatter={(value) => value.toFixed(2)}
          />
          <YAxis 
            type="category"
            dataKey="feature"
            tick={{ fontSize: 11 }}
            className="text-gray-600 dark:text-gray-400"
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(17, 24, 39, 0.95)',
              border: '1px solid rgba(75, 85, 99, 0.5)',
              borderRadius: '8px',
              color: '#fff'
            }}
            formatter={(value: number) => [value.toFixed(4), 'Importance']}
          />
          <Bar dataKey="importance" fill="#14b8a6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
