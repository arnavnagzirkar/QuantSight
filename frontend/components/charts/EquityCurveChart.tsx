import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Mock data for equity curve
const generateEquityCurve = () => {
  const data = [];
  let strategyValue = 100000;
  let benchmarkValue = 100000;
  const startDate = new Date('2024-01-01');
  
  for (let i = 0; i < 250; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    
    strategyValue *= (1 + (Math.random() * 0.003 + 0.0005));
    benchmarkValue *= (1 + (Math.random() * 0.002 + 0.0002));
    
    data.push({
      date: date.toISOString().split('T')[0],
      strategy: Math.round(strategyValue),
      benchmark: Math.round(benchmarkValue),
    });
  }
  
  return data;
};

const data = generateEquityCurve();

export function EquityCurveChart() {
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
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(17, 24, 39, 0.95)',
              border: '1px solid rgba(75, 85, 99, 0.5)',
              borderRadius: '8px',
              color: '#fff'
            }}
            formatter={(value: any) => [`$${value.toLocaleString()}`, '']}
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
          <Line 
            type="monotone" 
            dataKey="benchmark" 
            stroke="#9ca3af" 
            strokeWidth={2}
            dot={false}
            name="Benchmark"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
