// Utility functions for formatting data in the QuantSight Research Lab

/**
 * Format a number as currency
 */
export function formatCurrency(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format a number as percentage
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

/**
 * Format a number with commas
 */
export function formatNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format a date string
 */
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  };

  return new Intl.DateTimeFormat('en-US', defaultOptions).format(dateObj);
}

/**
 * Format a date range
 */
export function formatDateRange(startDate: string | Date, endDate: string | Date): string {
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

/**
 * Format a number with compact notation (1K, 1M, 1B)
 */
export function formatCompact(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toFixed(0);
}

/**
 * Format Sharpe ratio with color coding
 */
export function formatSharpeRatio(value: number): {
  formatted: string;
  color: string;
  quality: string;
} {
  const formatted = value.toFixed(2);
  
  if (value >= 2) {
    return { formatted, color: 'text-teal-600', quality: 'Excellent' };
  } else if (value >= 1) {
    return { formatted, color: 'text-green-600', quality: 'Good' };
  } else if (value >= 0) {
    return { formatted, color: 'text-yellow-600', quality: 'Fair' };
  } else {
    return { formatted, color: 'text-red-600', quality: 'Poor' };
  }
}

/**
 * Format return with appropriate color
 */
export function formatReturn(value: number, decimals: number = 1): {
  formatted: string;
  color: string;
} {
  const formatted = formatPercent(value, decimals);
  const color = value >= 0 ? 'text-teal-600' : 'text-red-600';
  return { formatted, color };
}

/**
 * Calculate and format time ago
 */
export function timeAgo(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((new Date().getTime() - dateObj.getTime()) / 1000);

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
    second: 1,
  };

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
    }
  }

  return 'just now';
}

/**
 * Format duration in days to human readable
 */
export function formatDuration(days: number): string {
  if (days >= 365) {
    const years = Math.floor(days / 365);
    return `${years} year${years === 1 ? '' : 's'}`;
  }
  if (days >= 30) {
    const months = Math.floor(days / 30);
    return `${months} month${months === 1 ? '' : 's'}`;
  }
  if (days >= 7) {
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks === 1 ? '' : 's'}`;
  }
  return `${days} day${days === 1 ? '' : 's'}`;
}

/**
 * Truncate string to specified length
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Parse CSV string to array
 */
export function parseCSV(csv: string): string[] {
  return csv.split(',').map(item => item.trim()).filter(Boolean);
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Generate color based on value (for heatmaps)
 */
export function valueToColor(
  value: number,
  min: number,
  max: number,
  colorScheme: 'red-green' | 'blue-red' = 'red-green'
): string {
  const normalized = (value - min) / (max - min);
  
  if (colorScheme === 'red-green') {
    if (normalized < 0.5) {
      // Red to yellow
      const r = 255;
      const g = Math.floor(normalized * 2 * 255);
      return `rgb(${r}, ${g}, 0)`;
    } else {
      // Yellow to green
      const r = Math.floor((1 - (normalized - 0.5) * 2) * 255);
      const g = 255;
      return `rgb(${r}, ${g}, 0)`;
    }
  } else {
    // Blue to red
    const r = Math.floor(normalized * 255);
    const b = Math.floor((1 - normalized) * 255);
    return `rgb(${r}, 0, ${b})`;
  }
}

/**
 * Sort array of objects by key
 */
export function sortBy<T>(
  array: T[],
  key: keyof T,
  direction: 'asc' | 'desc' = 'asc'
): T[] {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];

    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}

/**
 * Calculate percentage change
 */
export function percentageChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return 0;
  return ((newValue - oldValue) / oldValue) * 100;
}

/**
 * Calculate CAGR (Compound Annual Growth Rate)
 */
export function calculateCAGR(
  beginningValue: number,
  endingValue: number,
  years: number
): number {
  return (Math.pow(endingValue / beginningValue, 1 / years) - 1) * 100;
}

/**
 * Format confidence score as percentage with color
 */
export function formatConfidence(confidence: number): {
  formatted: string;
  color: string;
  level: string;
} {
  const percentage = confidence * 100;
  const formatted = `${percentage.toFixed(0)}%`;

  if (percentage >= 80) {
    return { formatted, color: 'text-teal-600', level: 'High' };
  } else if (percentage >= 60) {
    return { formatted, color: 'text-blue-600', level: 'Medium' };
  } else if (percentage >= 40) {
    return { formatted, color: 'text-yellow-600', level: 'Low' };
  } else {
    return { formatted, color: 'text-gray-600', level: 'Very Low' };
  }
}

/**
 * Validate date range
 */
export function validateDateRange(startDate: string, endDate: string): boolean {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return start < end;
}

/**
 * Get date range presets
 */
export function getDateRangePresets(): Record<string, { start: Date; end: Date }> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return {
    'Today': {
      start: today,
      end: now,
    },
    'Last 7 Days': {
      start: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
      end: now,
    },
    'Last 30 Days': {
      start: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
      end: now,
    },
    'Last 3 Months': {
      start: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000),
      end: now,
    },
    'Last 6 Months': {
      start: new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000),
      end: now,
    },
    'Last Year': {
      start: new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000),
      end: now,
    },
    'Year to Date': {
      start: new Date(now.getFullYear(), 0, 1),
      end: now,
    },
  };
}

/**
 * Format API error message
 */
export function formatAPIError(error: any): string {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  if (error.message) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

/**
 * Debounce function for search/input handlers
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Download data as CSV
 */
export function downloadCSV(data: any[], filename: string): void {
  if (data.length === 0) return;

  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Escape values that contain commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    ),
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Download data as JSON
 */
export function downloadJSON(data: any, filename: string): void {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.json`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
