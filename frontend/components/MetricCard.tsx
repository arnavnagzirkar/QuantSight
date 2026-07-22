import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { cn } from '../utils/cn';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number | string;
  changeLabel?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  subtitle?: string;
  icon?: LucideIcon;
  className?: string;
}

export function MetricCard({ title, value, change, changeLabel, changeType, subtitle, icon: Icon, className }: MetricCardProps) {
  const isPositive = changeType
    ? changeType === 'positive'
    : change !== undefined && (typeof change === 'number' ? change >= 0 : !change.toString().startsWith('-'));

  return (
    <Card className={cn('', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        {change !== undefined && (
          <p className="text-xs text-muted-foreground">
            <span className={cn(isPositive ? 'text-green-600' : 'text-red-600')}>
              {isPositive ? '↑' : '↓'} {typeof change === 'number' ? `${Math.abs(change).toFixed(2)}%` : change}
            </span>
            {changeLabel && ` ${changeLabel}`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
