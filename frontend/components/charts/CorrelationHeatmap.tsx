const factors = ['momentum', 'volatility', 'rsi', 'macd', 'volume', 'atr'];

// Generate mock correlation matrix
const generateCorrelation = () => {
  const matrix: number[][] = [];
  for (let i = 0; i < factors.length; i++) {
    matrix[i] = [];
    for (let j = 0; j < factors.length; j++) {
      if (i === j) {
        matrix[i][j] = 1;
      } else if (i > j) {
        matrix[i][j] = matrix[j][i];
      } else {
        matrix[i][j] = (Math.random() - 0.5) * 2;
      }
    }
  }
  return matrix;
};

const correlation = generateCorrelation();

export function CorrelationHeatmap() {
  const getColor = (value: number) => {
    if (value > 0.5) return 'bg-teal-600';
    if (value > 0.2) return 'bg-teal-400';
    if (value > -0.2) return 'bg-gray-300 dark:bg-gray-700';
    if (value > -0.5) return 'bg-orange-400';
    return 'bg-orange-600';
  };

  return (
    <div className="overflow-x-auto">
      <div className="inline-grid" style={{ gridTemplateColumns: `40px repeat(${factors.length}, 40px)` }}>
        <div></div>
        {factors.map(factor => (
          <div key={factor} className="text-xs text-gray-600 dark:text-gray-400 text-center py-1 truncate" title={factor}>
            {factor.slice(0, 3)}
          </div>
        ))}
        
        {factors.map((factor, i) => (
          <div key={factor} className="contents">
            <div className="text-xs text-gray-600 dark:text-gray-400 text-right pr-2 py-1 truncate" title={factor}>
              {factor.slice(0, 3)}
            </div>
            {correlation[i].map((value, j) => (
              <div
                key={j}
                className={`${getColor(value)} flex items-center justify-center text-xs border border-white dark:border-gray-900`}
                title={`${factors[i]} vs ${factors[j]}: ${value.toFixed(2)}`}
              >
                <span className={value > 0 ? 'text-white' : value < -0.2 ? 'text-white' : 'text-gray-900'}>
                  {Math.abs(value) > 0.3 ? value.toFixed(1) : ''}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
