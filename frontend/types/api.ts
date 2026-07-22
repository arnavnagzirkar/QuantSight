export interface APIEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface PCAComponentLoading {
  feature: string;
  loading: number;
  abs_loading: number;
}

export interface PCAAnalysis {
  n_samples: number;
  n_features: number;
  explained_variance_ratio: number[];
  components: Array<{
    component: number;
    top_loadings: PCAComponentLoading[];
  }>;
  features_used: string[];
  error?: string;
}

export interface CorrelationAnalysis {
  labels: string[];
  matrix: Array<Array<number | null>>;
}

export interface FactorAnalysis {
  ticker: string;
  columns: string[];
  records: Array<Record<string, string | number | null>>;
  rows_returned: number;
  available_factors: string[];
  date_range: {
    start: string | null;
    end: string | null;
  };
  pca: PCAAnalysis | null;
  correlation: CorrelationAnalysis;
}

export interface FactorComputeParams {
  ticker: string;
  start_date: string;
  end_date?: string;
  rows: number;
  factors: string[];
  include_pca: boolean;
}

export interface TickerAnalysis {
  ticker: string;
  as_of: string;
  current_price: number;
  price_change: number;
  price_change_pct: number;
  volume: number | null;
  history: Array<{
    date: string;
    close: number;
  }>;
  metrics: {
    annualized_volatility: number;
    momentum_20d: number;
  };
  baseline_signal: {
    model: 'momentum_baseline';
    label: 'LONG' | 'NEUTRAL' | 'SHORT';
    probability: number;
  };
  factor_snapshot: Array<{
    factor: string;
    value: number | null;
  }>;
}

export interface SentimentAnalysis {
  ticker: string;
  engine: 'vader';
  summary: {
    positive: number;
    neutral: number;
    negative: number;
    total: number;
    average_confidence: number;
  };
  articles: Array<{
    title: string;
    source: string;
    url: string;
    published_at: string;
    sentiment: 'positive' | 'neutral' | 'negative';
    confidence: number;
    score: number;
  }>;
  trend: Array<{
    date: string;
    positive: number;
    neutral: number;
    negative: number;
  }>;
}

export interface PasswordSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface UsernameAvailability {
  username: string;
  available: boolean;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  timezone: string;
  default_tickers: string[];
  default_model_type: 'xgb' | 'lstm' | 'ensemble';
  default_train_window: number;
  default_test_window: number;
  default_max_folds: number;
  notify_job_complete: boolean;
}

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancel_requested' | 'cancelled';

export interface ModelTrainingSummary {
  experiment_id?: string;
  name: string;
  ticker: string;
  model_type: 'xgb' | 'lstm' | 'ensemble';
  horizon: '1d' | '5d' | '20d';
  metrics: Record<string, string | number | boolean | null>;
  feature_importance: Array<{ feature: string; importance: number }>;
  component_metrics?: Record<string, Record<string, string | number | boolean | null>> | null;
  equity_curve: Array<{ date: string; value: number }>;
}

export interface StrategyBacktestSummary {
  name: string;
  ticker: string;
  model_type: 'xgb' | 'lstm' | 'ensemble';
  horizon: '1d' | '5d' | '20d';
  position_rule: 'long_only' | 'long_short';
  initial_capital: number;
  metrics: Record<string, string | number | boolean | null>;
  equity_curve: Array<{ date: string; value: number }>;
  benchmark_curve: Array<{ date: string; value: number }>;
  ledger: Array<{
    date: string;
    probability: number | null;
    position: number | null;
    gross_return: number | null;
    transaction_cost: number | null;
    net_return: number | null;
    equity: number | null;
  }>;
}

export interface PortfolioRunSummary {
  name: string;
  tickers: string[];
  signal: string;
  allocation_method: string;
  rebalance: string;
  metrics: Record<string, number | null>;
  equity_curve: Array<{ date: string; value: number }>;
  benchmark_curve: Array<{ date: string; value: number }>;
  weight_history: Array<{ date: string; weights: Record<string, number> }>;
  attribution: Array<{ ticker: string; contribution: number }>;
  risk: {
    tail: {
      confidence: number;
      var: number | null;
      cvar: number | null;
    };
    drawdown: {
      max_drawdown: number | null;
      underwater: Array<{ date: string; value: number }>;
      periods: Array<{
        start_date: string;
        trough_date: string;
        recovery_date: string | null;
        depth: number;
        length_days: number;
        recovery_days: number | null;
      }>;
    };
    components: Array<{
      ticker: string;
      weight: number;
      volatility: number;
      beta: number;
      risk_contribution: number;
      marginal_risk: number;
    }>;
    correlation: {
      labels: string[];
      matrix: Array<Array<number | null>>;
    };
    historical_stress: Array<{
      name: string;
      start_date: string;
      end_date: string;
      realized_return: number;
      observations: number;
    }>;
    tracking_error: number | null;
  };
}

export interface SignalAnalysisSummary {
  ticker: string;
  signal: string;
  return_horizon: 1 | 3 | 5 | 10 | 20;
  rows_used: number;
  decay: Array<{
    horizon: number;
    pearson: number | null;
    spearman: number | null;
    top_return: number | null;
    bottom_return: number | null;
  }>;
  quantiles: Array<{ quantile: number; mean_return: number | null }>;
  long_short_curve: Array<{ date: string; value: number }>;
}

export type JobResultSummary = ModelTrainingSummary | StrategyBacktestSummary | PortfolioRunSummary | SignalAnalysisSummary;

export interface JobRecord {
  id: string;
  job_type: string;
  status: JobStatus;
  progress_percent: number;
  progress_phase?: string | null;
  cancel_requested?: boolean;
  error_code?: string | null;
  error_message?: string | null;
  result_summary?: JobResultSummary | null;
  params?: Record<string, unknown>;
  created_at?: string;
}

export interface ModelTrainingRequest {
  name: string;
  ticker: string;
  model_type: 'xgb' | 'lstm' | 'ensemble';
  horizon: '1d' | '5d' | '20d';
  start_date: string;
  end_date?: string;
  train_window: number;
  test_window: number;
  max_folds: number;
  xgb_params: Record<string, number | string | boolean>;
  lstm_params: Record<string, number | string | boolean>;
  ensemble_weights: { xgb: number; lstm: number };
}

export interface StrategyBacktestRequest extends ModelTrainingRequest {
  position_rule: 'long_only' | 'long_short';
  initial_capital: number;
  cost_bps: number;
}

export interface PortfolioRunRequest {
  name: string;
  tickers: string[];
  start_date: string;
  end_date?: string;
  signal: string;
  allocation_method: 'equal_weight' | 'risk_parity' | 'mean_variance' | 'signal_weighted' | 'quantile';
  rebalance: 'daily' | 'weekly' | 'monthly';
  cost_bps: number;
  benchmark: string;
  n_quantiles: number;
  long_quantile: number;
  short_quantile: number;
}

export interface SignalAnalysisRequest {
  ticker: string;
  start_date: string;
  end_date?: string;
  signal: string;
  horizons: number[];
  return_horizon: 1 | 3 | 5 | 10 | 20;
  quantiles: number;
  rolling_window: number;
}

export interface ExperimentRequest extends ModelTrainingRequest {
  description?: string | null;
}

export interface ExperimentRecord {
  id: string;
  name: string;
  description: string | null;
  ticker: string;
  model_type: 'xgb' | 'lstm' | 'ensemble';
  config: Omit<ExperimentRequest, 'name' | 'description' | 'ticker' | 'model_type'>;
  created_at: string;
  updated_at: string;
}

export interface ExperimentComparison {
  id: string;
  experiment_id: string;
  name: string;
  ticker: string;
  model_type: 'xgb' | 'lstm' | 'ensemble';
  horizon: '1d' | '5d' | '20d';
  metrics: Record<string, string | number | boolean | null>;
}

export interface DashboardData {
  overview: {
    latest_equity: number | null;
    sharpe: number | null;
    max_drawdown: number | null;
    active_jobs: number;
    completed_models: number;
  };
  latest_run: { id: string; name: string | null; job_type: string } | null;
  equity_curve: Array<{ date: string; strategy: number; benchmark: number | null }>;
  holdings: Array<{ ticker: string; weight: number; contribution: number | null }>;
  recent_jobs: Array<{
    id: string;
    job_type: string;
    status: JobStatus;
    progress_percent: number;
    progress_phase: string | null;
    created_at: string;
    name: string | null;
  }>;
}