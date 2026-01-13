import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const data = [
  { quantile: 'Q1', ret_1d: -0.065, ret_5d: -0.32, ret_20d: -1.42 },
  { quantile: 'Q2', ret_1d: -0.012, ret_5d: -0.05, ret_20d: -0.28 },
  { quantile: 'Q3', ret_1d: 0.018, ret_5d: 0.09, ret_20d: 0.45 },
  { quantile: 'Q4', ret_1d: 0.045, ret_5d: 0.23, ret_20d: 1.12 },
  { quantile: 'Q5', ret_1d: 0.082, ret_5d: 0.41, ret_20d: 1.85 },
];

export function QuantileReturnsChart() {
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
          <XAxis 
            dataKey="quantile" 
            tick={{ fontSize: 12 }}
            className="text-gray-600 dark:text-gray-400"
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            className="text-gray-600 dark:text-gray-400"
            tickFormatter={(value) => `${(value * 100).toFixed(1)}%`}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(17, 24, 39, 0.95)',
              border: '1px solid rgba(75, 85, 99, 0.5)',
              borderRadius: '8px',
              color: '#fff'
            }}
            formatter={(value: any) => [`${(value * 100).toFixed(2)}%`, '']}
          />
          <Legend />
          <Bar dataKey="ret_1d" fill="#14b8a6" name="1D Return" />
          <Bar dataKey="ret_5d" fill="#10b981" name="5D Return" />
          <Bar dataKey="ret_20d" fill="#06b6d4" name="20D Return" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
