// API Service for QuantSight Research Lab
// Connect to Flask backend - maps React frontend to existing Flask endpoints

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '';

// Generic fetch wrapper with error handling
async function fetchAPI<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Server returned non-JSON: ${text.slice(0, 200)}`);
    }

    if (!response.ok || data.error) {
      throw new Error(data.error || `API Error: ${response.status} ${response.statusText}`);
    }

    return data;
  } catch (error) {
    console.error('API Request failed:', error);
    throw error;
  }
}

// Dashboard API
export const dashboardAPI = {
  getOverview: () => fetchAPI('/dashboard/overview'),
  getEquityCurve: (params?: { startDate?: string; endDate?: string }) => 
    fetchAPI(`/dashboard/equity-curve${params ? `?${new URLSearchParams(params as any).toString()}` : ''}`),
  getRecentSignals: (limit?: number) => fetchAPI(`/dashboard/signals${limit ? `?limit=${limit}` : ''}`),
  getTopHoldings: () => fetchAPI('/dashboard/holdings'),
};

// Ticker Intelligence API
export const tickerAPI = {
  getTickerData: (ticker: string) => fetchAPI(`/tickers/${ticker}`),
  getTickerHistory: (ticker: string, params?: { startDate?: string; endDate?: string }) =>
    fetchAPI(`/tickers/${ticker}/history${params ? `?${new URLSearchParams(params as any).toString()}` : ''}`),
  getTickerMetrics: (ticker: string) => fetchAPI(`/tickers/${ticker}/metrics`),
  searchTickers: (query: string) => fetchAPI(`/tickers/search?q=${encodeURIComponent(query)}`),
};

// Factor Explorer API
export const factorAPI = {
  getFactors: () => fetchAPI('/factors'),
  computeFactors: (params: { tickers: string[]; factors: string[]; startDate?: string; endDate?: string }) =>
    fetchAPI('/factors/compute', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  getFactorAnalysis: (factorName: string) => fetchAPI(`/factors/${factorName}/analysis`),
  getPCAAnalysis: (params: { factors: string[] }) =>
    fetchAPI('/factors/pca', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  getCorrelation: (params: { factors: string[] }) =>
    fetchAPI('/factors/correlation', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
};

// Model Lab API
export const modelAPI = {
  getModels: () => fetchAPI('/models'),
  trainModel: (params: {
    name: string;
    factors: string[];
    tickers: string[];
    target: string;
    params: Record<string, any>;
    walkForwardParams?: {
      trainDays: number;
      testDays: number;
      retrainFrequency: number;
    };
  }) => fetchAPI('/models/train', {
    method: 'POST',
    body: JSON.stringify(params),
  }),
  getModelDetails: (modelId: string) => fetchAPI(`/models/${modelId}`),
  getFeatureImportance: (modelId: string) => fetchAPI(`/models/${modelId}/feature-importance`),
  predictModel: (modelId: string, data: any) =>
    fetchAPI(`/models/${modelId}/predict`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteModel: (modelId: string) =>
    fetchAPI(`/models/${modelId}`, { method: 'DELETE' }),
};

// Experiment Manager API
export const experimentAPI = {
  getExperiments: () => fetchAPI('/experiments'),
  createExperiment: (params: {
    name: string;
    description?: string;
    config: Record<string, any>;
  }) => fetchAPI('/experiments', {
    method: 'POST',
    body: JSON.stringify(params),
  }),
  getExperimentDetails: (experimentId: string) => fetchAPI(`/experiments/${experimentId}`),
  updateExperiment: (experimentId: string, params: any) =>
    fetchAPI(`/experiments/${experimentId}`, {
      method: 'PUT',
      body: JSON.stringify(params),
    }),
  deleteExperiment: (experimentId: string) =>
    fetchAPI(`/experiments/${experimentId}`, { method: 'DELETE' }),
  runExperiment: (experimentId: string) =>
    fetchAPI(`/experiments/${experimentId}/run`, { method: 'POST' }),
  compareExperiments: (experimentIds: string[]) =>
    fetchAPI('/experiments/compare', {
      method: 'POST',
      body: JSON.stringify({ experimentIds }),
    }),
};

// Signal Diagnostics API
export const signalAPI = {
  getSignals: (params?: { startDate?: string; endDate?: string; ticker?: string }) =>
    fetchAPI(`/signals${params ? `?${new URLSearchParams(params as any).toString()}` : ''}`),
  getSignalDecay: (params: { signalType: string; horizons: number[] }) =>
    fetchAPI('/signals/decay', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  getQuantileReturns: (params: { signalType: string; quantiles: number }) =>
    fetchAPI('/signals/quantile-returns', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  getSignalStats: (signalType: string) => fetchAPI(`/signals/${signalType}/stats`),
};

// Strategy Backtest API
export const backtestAPI = {
  runBacktest: (params: {
    strategy: string;
    tickers: string[];
    startDate: string;
    endDate: string;
    initialCapital?: number;
    config?: Record<string, any>;
  }) => fetchAPI('/backtest/run', {
    method: 'POST',
    body: JSON.stringify(params),
  }),
  getBacktestResults: (backtestId: string) => fetchAPI(`/backtest/${backtestId}`),
  getBacktestHistory: () => fetchAPI('/backtest/history'),
  compareBacktests: (backtestIds: string[]) =>
    fetchAPI('/backtest/compare', {
      method: 'POST',
      body: JSON.stringify({ backtestIds }),
    }),
};

// Portfolio Lab API
export const portfolioAPI = {
  optimizePortfolio: (params: {
    tickers: string[];
    method: string; // 'mean-variance', 'risk-parity', 'black-litterman', 'hrp'
    constraints?: Record<string, any>;
    targetReturn?: number;
    targetRisk?: number;
  }) => fetchAPI('/portfolio/optimize', {
    method: 'POST',
    body: JSON.stringify(params),
  }),
  getPortfolioAnalytics: (portfolioId: string) => fetchAPI(`/portfolio/${portfolioId}/analytics`),
  getPortfolios: () => fetchAPI('/portfolio'),
  rebalancePortfolio: (portfolioId: string, params: any) =>
    fetchAPI(`/portfolio/${portfolioId}/rebalance`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),
};

// Risk & Performance API
export const riskAPI = {
  getRiskMetrics: (portfolioId?: string) =>
    fetchAPI(`/risk/metrics${portfolioId ? `?portfolioId=${portfolioId}` : ''}`),
  getVaR: (params: { portfolioId: string; confidence: number; horizon: number }) =>
    fetchAPI('/risk/var', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  getStressTest: (params: { portfolioId: string; scenarios: string[] }) =>
    fetchAPI('/risk/stress-test', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  getAttribution: (portfolioId: string, params?: { startDate?: string; endDate?: string }) =>
    fetchAPI(`/risk/attribution/${portfolioId}${params ? `?${new URLSearchParams(params as any).toString()}` : ''}`),
  getDrawdownAnalysis: (portfolioId: string) => fetchAPI(`/risk/drawdown/${portfolioId}`),
};

// Sentiment Analyzer API
export const sentimentAPI = {
  analyzeSentiment: (params: { tickers: string[]; startDate?: string; endDate?: string }) =>
    fetchAPI('/sentiment/analyze', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  getHeadlines: (params?: { ticker?: string; startDate?: string; endDate?: string; limit?: number }) =>
    fetchAPI(`/sentiment/headlines${params ? `?${new URLSearchParams(params as any).toString()}` : ''}`),
  getSentimentTrends: (ticker: string, params?: { startDate?: string; endDate?: string }) =>
    fetchAPI(`/sentiment/trends/${ticker}${params ? `?${new URLSearchParams(params as any).toString()}` : ''}`),
  classifyHeadlines: (headlines: string[]) =>
    fetchAPI('/sentiment/classify', {
      method: 'POST',
      body: JSON.stringify({ headlines }),
    }),
};

// Data Monitor API
export const dataAPI = {
  getDataStatus: () => fetchAPI('/data/status'),
  getDataQuality: (source?: string) =>
    fetchAPI(`/data/quality${source ? `?source=${source}` : ''}`),
  refreshData: (params: { sources: string[] }) =>
    fetchAPI('/data/refresh', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  getDataSources: () => fetchAPI('/data/sources'),
};

// Settings API
export const settingsAPI = {
  getSettings: () => fetchAPI('/settings'),
  updateSettings: (settings: Record<string, any>) =>
    fetchAPI('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
  testConnection: (params: { type: string; config: Record<string, any> }) =>
    fetchAPI('/settings/test-connection', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
};

export default {
  dashboard: dashboardAPI,
  ticker: tickerAPI,
  factor: factorAPI,
  model: modelAPI,
  experiment: experimentAPI,
  signal: signalAPI,
  backtest: backtestAPI,
  portfolio: portfolioAPI,
  risk: riskAPI,
  sentiment: sentimentAPI,
  data: dataAPI,
  settings: settingsAPI,
};
