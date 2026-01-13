import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const tickers = ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'META'];
const colors = ['#14b8a6', '#10b981', '#06b6d4', '#8b5cf6', '#ec4899'];

// Generate mock portfolio weights over time
const generateWeightsData = () => {
  const data = [];
  const startDate = new Date('2024-01-01');
  
  for (let i = 0; i < 52; i++) { // Weekly for 1 year
    const date = new Date(startDate);
    date.setDate(date.getDate() + i * 7);
    
    const weights: any = {
      date: date.toISOString().split('T')[0],
    };
    
    // Generate random weights that sum to 100
    let remaining = 100;
    tickers.forEach((ticker, idx) => {
      if (idx === tickers.length - 1) {
        weights[ticker] = remaining;
      } else {
        const weight = Math.random() * (remaining / (tickers.length - idx)) * 1.5;
        weights[ticker] = weight;
        remaining -= weight;
      }
    });
    
    data.push(weights);
  }
  
  return data;
};

const data = generateWeightsData();

export function PortfolioWeightsChart() {
  return (
    <div className="h-96">
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
            tickFormatter={(value) => `${value.toFixed(0)}%`}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(17, 24, 39, 0.95)',
              border: '1px solid rgba(75, 85, 99, 0.5)',
              borderRadius: '8px',
              color: '#fff'
            }}
            formatter={(value: any) => [`${value.toFixed(1)}%`, '']}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Legend />
          {tickers.map((ticker, idx) => (
            <Area
              key={ticker}
              type="monotone"
              dataKey={ticker}
              stackId="1"
              stroke={colors[idx]}
              fill={colors[idx]}
              fillOpacity={0.7}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
