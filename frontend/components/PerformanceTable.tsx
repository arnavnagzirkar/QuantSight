import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

interface PerformanceTableProps {
  data: Array<{
    name: string;
    returns: number;
    sharpe: number;
    maxDrawdown: number;
  }>;
}

export function PerformanceTable({ data }: PerformanceTableProps) {
  if (!data || data.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No performance data available</div>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Strategy</TableHead>
            <TableHead className="text-right">Returns</TableHead>
            <TableHead className="text-right">Sharpe</TableHead>
            <TableHead className="text-right">Max DD</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.name}>
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell className="text-right font-mono">
                <span className={row.returns >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {(row.returns * 100).toFixed(2)}%
                </span>
              </TableCell>
              <TableCell className="text-right font-mono">{row.sharpe.toFixed(2)}</TableCell>
              <TableCell className="text-right font-mono text-red-600">
                {(row.maxDrawdown * 100).toFixed(2)}%
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
