import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface ParamGridEditorProps {
  params: Record<string, any>;
  onChange: (params: Record<string, any>) => void;
}

export function ParamGridEditor({ params, onChange }: ParamGridEditorProps) {
  const handleChange = (key: string, value: string) => {
    onChange({
      ...params,
      [key]: isNaN(Number(value)) ? value : Number(value),
    });
  };

  // Handle null or undefined params
  if (!params || typeof params !== 'object') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Model Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No parameters available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Model Parameters</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        {Object.entries(params).map(([key, value]) => (
          <div key={key} className="space-y-2">
            <Label htmlFor={key}>{key}</Label>
            <Input
              id={key}
              type="text"
              value={value}
              onChange={(e) => handleChange(key, e.target.value)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
