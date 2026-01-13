import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { cn } from '../utils/cn';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number | string;
  changeLabel?: string;
  changeType?: string;
  subtitle?: string;
  icon?: any;
  className?: string;
}

export function MetricCard({ title, value, change, changeLabel, className }: MetricCardProps) {
  const isPositive = change !== undefined && (typeof change === 'number' ? change >= 0 : !change.toString().startsWith('-'));

  return (
    <Card className={cn('', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change !== undefined && (
          <p className="text-xs text-muted-foreground">
            <span className={cn(isPositive ? 'text-green-600' : 'text-red-600')}>
              {isPositive ? '↑' : '↓'} {typeof change === 'number' ? Math.abs(change).toFixed(2) : change}%
            </span>
            {changeLabel && ` ${changeLabel}`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
