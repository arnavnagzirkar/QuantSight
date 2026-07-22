import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface SentimentTrendChartProps {
  data: Array<{
    date: string;
    positive: number;
    neutral: number;
    negative: number;
  }>;
}

export function SentimentTrendChart({ data }: SentimentTrendChartProps) {
  if (data.length === 0) {
    return <div className="h-80 flex items-center justify-center text-muted-foreground">No sentiment trend available</div>;
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(17, 24, 39, 0.95)',
              border: '1px solid rgba(75, 85, 99, 0.5)',
              borderRadius: '8px',
              color: '#fff'
            }}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Legend />
          <Area 
            type="monotone" 
            dataKey="positive" 
            stackId="1"
            stroke="#14b8a6" 
            fill="#14b8a6"
            fillOpacity={0.7}
            name="Positive"
          />
          <Area 
            type="monotone" 
            dataKey="neutral" 
            stackId="1"
            stroke="#9ca3af" 
            fill="#9ca3af"
            fillOpacity={0.7}
            name="Neutral"
          />
          <Area 
            type="monotone" 
            dataKey="negative" 
            stackId="1"
            stroke="#f97316" 
            fill="#f97316"
            fillOpacity={0.7}
            name="Negative"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
