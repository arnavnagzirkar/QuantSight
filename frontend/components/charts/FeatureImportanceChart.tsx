import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { feature: 'momentum_20d', importance: 0.185 },
  { feature: 'volatility_20d', importance: 0.142 },
  { feature: 'rsi_14', importance: 0.128 },
  { feature: 'volume_ratio', importance: 0.105 },
  { feature: 'bb_width', importance: 0.095 },
  { feature: 'macd', importance: 0.087 },
  { feature: 'atr', importance: 0.075 },
  { feature: 'momentum_5d', importance: 0.068 },
  { feature: 'price_vs_ma20', importance: 0.055 },
  { feature: 'stoch_k', importance: 0.042 },
].sort((a, b) => b.importance - a.importance);

export function FeatureImportanceChart() {
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart 
          data={data} 
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
            formatter={(value: any) => [value.toFixed(4), 'Importance']}
          />
          <Bar dataKey="importance" fill="#14b8a6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
