interface CorrelationHeatmapProps {
  labels?: string[];
  matrix?: Array<Array<number | null>>;
}

export function CorrelationHeatmap({ labels = [], matrix = [] }: CorrelationHeatmapProps) {
  const getColor = (value: number) => {
    if (value > 0.5) return 'bg-teal-600';
    if (value > 0.2) return 'bg-teal-400';
    if (value > -0.2) return 'bg-gray-300 dark:bg-gray-700';
    if (value > -0.5) return 'bg-orange-400';
    return 'bg-orange-600';
  };

  if (labels.length === 0 || matrix.length === 0) {
    return <div className="h-64 flex items-center justify-center text-muted-foreground">No correlation data available</div>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-grid min-w-max" style={{ gridTemplateColumns: `96px repeat(${labels.length}, 48px)` }}>
        <div></div>
        {labels.map(factor => (
          <div key={factor} className="text-xs text-gray-600 dark:text-gray-400 text-center py-1 truncate" title={factor}>
            {factor.slice(0, 5)}
          </div>
        ))}
        
        {labels.map((factor, i) => (
          <div key={factor} className="contents">
            <div className="text-xs text-gray-600 dark:text-gray-400 text-right pr-2 py-1 truncate" title={factor}>
              {factor}
            </div>
            {matrix[i].map((rawValue, j) => {
              const value = rawValue ?? 0;
              return (
              <div
                key={j}
                className={`${getColor(value)} flex items-center justify-center text-xs border border-white dark:border-gray-900`}
                title={`${labels[i]} vs ${labels[j]}: ${rawValue === null ? 'N/A' : value.toFixed(2)}`}
              >
                <span className={Math.abs(value) > 0.2 ? 'text-white' : 'text-gray-900 dark:text-gray-100'}>
                  {rawValue !== null && Math.abs(value) > 0.3 ? value.toFixed(1) : ''}
                </span>
              </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
