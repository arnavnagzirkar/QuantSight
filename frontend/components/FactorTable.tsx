import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

interface FactorTableProps {
  data: Array<Record<string, any>>;
  columns?: string[];
}

export function FactorTable({ data, columns }: FactorTableProps) {
  if (!data || data.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No data available</div>;
  }

  const displayColumns = columns || Object.keys(data[0]);

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {displayColumns.map((col) => (
              <TableHead key={col} className="font-semibold">
                {col}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.slice(0, 100).map((row, idx) => (
            <TableRow key={idx}>
              {displayColumns.map((col) => (
                <TableCell key={col} className="font-mono text-sm">
                  {typeof row[col] === 'number' ? row[col].toFixed(4) : row[col]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
