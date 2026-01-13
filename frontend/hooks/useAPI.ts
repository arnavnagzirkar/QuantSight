import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

interface UseAPIOptions {
  immediate?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

interface UseAPIResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  execute: (...args: any[]) => Promise<T | void>;
  reset: () => void;
}

export function useAPI<T = any>(
  apiFunction: (...args: any[]) => Promise<T>,
  options: UseAPIOptions = {}
): UseAPIResult<T> {
  const { immediate = false, onSuccess, onError } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (...args: any[]) => {
      try {
        setLoading(true);
        setError(null);
        const result = await apiFunction(...args);
        setData(result);
        if (onSuccess) {
          onSuccess(result);
        }
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('An error occurred');
        setError(error);
        if (onError) {
          onError(error);
        }
      } finally {
        setLoading(false);
      }
    },
    [apiFunction, onSuccess, onError]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate, execute]);

  return { data, loading, error, execute, reset };
}

// Specialized hooks for common API operations

export function useDashboard() {
  return {
    overview: useAPI(api.dashboard.getOverview),
    equityCurve: useAPI(api.dashboard.getEquityCurve),
    signals: useAPI(api.dashboard.getRecentSignals),
    holdings: useAPI(api.dashboard.getTopHoldings),
  };
}

export function useTickers() {
  return {
    getData: useAPI(api.ticker.getTickerData),
    getHistory: useAPI(api.ticker.getTickerHistory),
    getMetrics: useAPI(api.ticker.getTickerMetrics),
    search: useAPI(api.ticker.searchTickers),
  };
}

export function useFactors() {
  return {
    getAll: useAPI(api.factor.getFactors),
    compute: useAPI(api.factor.computeFactors),
    getAnalysis: useAPI(api.factor.getFactorAnalysis),
    getPCA: useAPI(api.factor.getPCAAnalysis),
    getCorrelation: useAPI(api.factor.getCorrelation),
  };
}

export function useModels() {
  return {
    getAll: useAPI(api.model.getModels),
    train: useAPI(api.model.trainModel),
    getDetails: useAPI(api.model.getModelDetails),
    getFeatureImportance: useAPI(api.model.getFeatureImportance),
    predict: useAPI(api.model.predictModel),
    delete: useAPI(api.model.deleteModel),
  };
}

export function useExperiments() {
  return {
    getAll: useAPI(api.experiment.getExperiments),
    create: useAPI(api.experiment.createExperiment),
    getDetails: useAPI(api.experiment.getExperimentDetails),
    update: useAPI(api.experiment.updateExperiment),
    delete: useAPI(api.experiment.deleteExperiment),
    run: useAPI(api.experiment.runExperiment),
    compare: useAPI(api.experiment.compareExperiments),
  };
}

export function useSignals() {
  return {
    getAll: useAPI(api.signal.getSignals),
    getDecay: useAPI(api.signal.getSignalDecay),
    getQuantileReturns: useAPI(api.signal.getQuantileReturns),
    getStats: useAPI(api.signal.getSignalStats),
  };
}

export function useBacktest() {
  return {
    run: useAPI(api.backtest.runBacktest),
    getResults: useAPI(api.backtest.getBacktestResults),
    getHistory: useAPI(api.backtest.getBacktestHistory),
    compare: useAPI(api.backtest.compareBacktests),
  };
}

export function usePortfolio() {
  return {
    optimize: useAPI(api.portfolio.optimizePortfolio),
    getAnalytics: useAPI(api.portfolio.getPortfolioAnalytics),
    getAll: useAPI(api.portfolio.getPortfolios),
    rebalance: useAPI(api.portfolio.rebalancePortfolio),
  };
}

export function useRisk() {
  return {
    getMetrics: useAPI(api.risk.getRiskMetrics),
    getVaR: useAPI(api.risk.getVaR),
    getStressTest: useAPI(api.risk.getStressTest),
    getAttribution: useAPI(api.risk.getAttribution),
    getDrawdownAnalysis: useAPI(api.risk.getDrawdownAnalysis),
  };
}

export function useSentiment() {
  return {
    analyze: useAPI(api.sentiment.analyzeSentiment),
    getHeadlines: useAPI(api.sentiment.getHeadlines),
    getTrends: useAPI(api.sentiment.getSentimentTrends),
    classify: useAPI(api.sentiment.classifyHeadlines),
  };
}

export function useData() {
  return {
    getStatus: useAPI(api.data.getDataStatus),
    getQuality: useAPI(api.data.getDataQuality),
    refresh: useAPI(api.data.refreshData),
    getSources: useAPI(api.data.getDataSources),
  };
}

export function useSettings() {
  return {
    get: useAPI(api.settings.getSettings),
    update: useAPI(api.settings.updateSettings),
    testConnection: useAPI(api.settings.testConnection),
  };
}
