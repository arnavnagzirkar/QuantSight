import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const data = [
  { horizon: '1d', ic_pearson: 0.182, ic_spearman: 0.195 },
  { horizon: '2d', ic_pearson: 0.168, ic_spearman: 0.178 },
  { horizon: '5d', ic_pearson: 0.142, ic_spearman: 0.158 },
  { horizon: '10d', ic_pearson: 0.118, ic_spearman: 0.135 },
  { horizon: '15d', ic_pearson: 0.095, ic_spearman: 0.112 },
  { horizon: '20d', ic_pearson: 0.078, ic_spearman: 0.095 },
  { horizon: '30d', ic_pearson: 0.052, ic_spearman: 0.068 },
  { horizon: '40d', ic_pearson: 0.035, ic_spearman: 0.048 },
];

export function SignalDecayChart() {
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
          <XAxis 
            dataKey="horizon" 
            tick={{ fontSize: 12 }}
            className="text-gray-600 dark:text-gray-400"
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            className="text-gray-600 dark:text-gray-400"
            domain={[0, 0.25]}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(17, 24, 39, 0.95)',
              border: '1px solid rgba(75, 85, 99, 0.5)',
              borderRadius: '8px',
              color: '#fff'
            }}
            formatter={(value: any) => [value.toFixed(3), '']}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="ic_pearson" 
            stroke="#14b8a6" 
            strokeWidth={2}
            dot={{ r: 4 }}
            name="IC (Pearson)"
          />
          <Line 
            type="monotone" 
            dataKey="ic_spearman" 
            stroke="#10b981" 
            strokeWidth={2}
            dot={{ r: 4 }}
            name="IC (Spearman)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
