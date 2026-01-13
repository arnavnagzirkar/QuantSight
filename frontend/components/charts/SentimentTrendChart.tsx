import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// Generate mock sentiment trend data
const generateSentimentData = () => {
  const data = [];
  const startDate = new Date('2024-11-01');
  
  for (let i = 0; i < 21; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    
    data.push({
      date: date.toISOString().split('T')[0],
      positive: Math.floor(Math.random() * 20 + 30),
      neutral: Math.floor(Math.random() * 15 + 20),
      negative: Math.floor(Math.random() * 15 + 10),
    });
  }
  
  return data;
};

const data = generateSentimentData();

export function SentimentTrendChart() {
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
