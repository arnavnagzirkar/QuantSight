import { useState } from 'react';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { X } from 'lucide-react';

interface TickerMultiSelectProps {
  value: string[];
  onChange: (tickers: string[]) => void;
  placeholder?: string;
}

export function TickerMultiSelect({ value, onChange, placeholder = 'Add ticker (e.g., AAPL)' }: TickerMultiSelectProps) {
  const [input, setInput] = useState('');

  // Handle undefined or null value
  const tickers = value || [];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      const ticker = input.trim().toUpperCase();
      if (!tickers.includes(ticker)) {
        onChange([...tickers, ticker]);
      }
      setInput('');
    }
  };

  const removeTicker = (ticker: string) => {
    onChange(tickers.filter((t) => t !== ticker));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 mb-2">
        {tickers.map((ticker) => (
          <Badge key={ticker} variant="secondary" className="pl-2 pr-1">
            {ticker}
            <button
              onClick={() => removeTicker(ticker)}
              className="ml-1 hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
    </div>
  );
}
