import type {
  APIEnvelope,
  DashboardData,
  ExperimentComparison,
  ExperimentRecord,
  ExperimentRequest,
  FactorAnalysis,
  FactorComputeParams,
  JobRecord,
  ModelTrainingRequest,
  PasswordSession,
  PortfolioRunRequest,
  SentimentAnalysis,
  SignalAnalysisRequest,
  StrategyBacktestRequest,
  TickerAnalysis,
  UserSettings,
  UsernameAvailability,
} from '../types/api';
import { supabase } from './supabase';

const configuredAPIBaseURL = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') || '';
const API_BASE_URL = configuredAPIBaseURL
  ? configuredAPIBaseURL.endsWith('/api') ? configuredAPIBaseURL : `${configuredAPIBaseURL}/api`
  : '/api';
const inFlightGetRequests = new Map<string, Promise<unknown>>();

export class APIRequestError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'APIRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function requestWithToken(url: string, options: RequestInit, accessToken?: string) {
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });
}

async function performFetchAPI<T>(endpoint: string, options: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const { data: sessionData } = await supabase.auth.getSession();
  let response = await requestWithToken(url, options, sessionData.session?.access_token);

  if (response.status === 401 && sessionData.session) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed.session?.access_token) {
      response = await requestWithToken(url, options, refreshed.session.access_token);
    }
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new APIRequestError(
      response.ok ? 'Server returned an invalid response' : `Request failed with status ${response.status}`,
      response.status,
    );
  }
  if (!response.ok || data.error) {
    const errorPayload = data.error;
    const message = typeof errorPayload === 'string'
      ? errorPayload
      : errorPayload?.message || `API Error: ${response.status} ${response.statusText}`;
    throw new APIRequestError(message, response.status, errorPayload?.code, errorPayload?.details);
  }
  return data as T;
}

async function fetchAPI<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  if (method !== 'GET') return performFetchAPI<T>(endpoint, options);

  const requestKey = `${API_BASE_URL}${endpoint}`;
  const existing = inFlightGetRequests.get(requestKey);
  if (existing) return existing as Promise<T>;

  const request = performFetchAPI<T>(endpoint, options)
    .finally(() => inFlightGetRequests.delete(requestKey));
  inFlightGetRequests.set(requestKey, request);
  return request;
}

function idempotencyHeaders(idempotencyKey?: string) {
  return idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined;
}

export const authAPI = {
  passwordSignIn: (identifier: string, password: string) =>
    fetchAPI<APIEnvelope<PasswordSession>>('/auth/password-sign-in', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),
  getUsernameAvailability: (username: string) =>
    fetchAPI<APIEnvelope<UsernameAvailability>>(`/auth/username-availability?username=${encodeURIComponent(username)}`),
};

export const dashboardAPI = {
  getDashboard: () => fetchAPI<APIEnvelope<DashboardData>>('/dashboard'),
};

export const tickerAPI = {
  getTickerData: (ticker: string, params?: { start_date?: string; end_date?: string }) =>
    fetchAPI<APIEnvelope<TickerAnalysis>>(
      `/tickers/${encodeURIComponent(ticker)}${params ? `?${new URLSearchParams(params).toString()}` : ''}`,
    ),
};

export const factorAPI = {
  computeFactors: (params: FactorComputeParams) =>
    fetchAPI<APIEnvelope<FactorAnalysis>>('/factors/compute', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
};

export const modelAPI = {
  trainModel: (params: ModelTrainingRequest, idempotencyKey?: string) =>
    fetchAPI<APIEnvelope<JobRecord>>('/models/train', {
      method: 'POST',
      body: JSON.stringify(params),
      headers: idempotencyHeaders(idempotencyKey),
    }),
};

export const experimentAPI = {
  getExperiments: () => fetchAPI<APIEnvelope<ExperimentRecord[]>>('/experiments'),
  createExperiment: (params: ExperimentRequest) => fetchAPI<APIEnvelope<ExperimentRecord>>('/experiments', {
    method: 'POST', body: JSON.stringify(params),
  }),
  getExperimentDetails: (experimentId: string) => fetchAPI<APIEnvelope<ExperimentRecord>>(`/experiments/${experimentId}`),
  updateExperiment: (experimentId: string, params: ExperimentRequest) => fetchAPI<APIEnvelope<ExperimentRecord>>(`/experiments/${experimentId}`, {
    method: 'PUT', body: JSON.stringify(params),
  }),
  deleteExperiment: (experimentId: string) => fetchAPI<void>(`/experiments/${experimentId}`, { method: 'DELETE' }),
  runExperiment: (experimentId: string, idempotencyKey?: string) => fetchAPI<APIEnvelope<JobRecord>>(`/experiments/${experimentId}/runs`, {
    method: 'POST', headers: idempotencyHeaders(idempotencyKey),
  }),
  compareRuns: (jobIds: string[]) => fetchAPI<APIEnvelope<ExperimentComparison[]>>('/experiment-runs/compare', {
    method: 'POST', body: JSON.stringify({ job_ids: jobIds }),
  }),
};

export const jobAPI = {
  listJobs: (limit = 50) => fetchAPI<APIEnvelope<JobRecord[]>>(`/jobs?limit=${limit}`),
  getJob: (jobId: string) => fetchAPI<APIEnvelope<JobRecord>>(`/jobs/${jobId}`),
  cancelJob: (jobId: string) => fetchAPI<APIEnvelope<JobRecord>>(`/jobs/${jobId}/cancel`, { method: 'POST' }),
};

export const signalAPI = {
  createAnalysis: (params: SignalAnalysisRequest, idempotencyKey?: string) => fetchAPI<APIEnvelope<JobRecord>>('/signal-analyses', {
    method: 'POST', body: JSON.stringify(params), headers: idempotencyHeaders(idempotencyKey),
  }),
};

export const backtestAPI = {
  createBacktest: (params: StrategyBacktestRequest, idempotencyKey?: string) => fetchAPI<APIEnvelope<JobRecord>>('/backtests', {
    method: 'POST', body: JSON.stringify(params), headers: idempotencyHeaders(idempotencyKey),
  }),
};

export const portfolioAPI = {
  createPortfolioRun: (params: PortfolioRunRequest, idempotencyKey?: string) => fetchAPI<APIEnvelope<JobRecord>>('/portfolio-runs', {
    method: 'POST', body: JSON.stringify(params), headers: idempotencyHeaders(idempotencyKey),
  }),
};

export const sentimentAPI = {
  getTickerSentiment: (ticker: string, params?: { start_date?: string; end_date?: string; limit?: number }) => {
    const query = params
      ? new URLSearchParams(Object.entries(params).reduce<Record<string, string>>((result, [key, value]) => {
          if (value !== undefined) result[key] = String(value);
          return result;
        }, {})).toString()
      : '';
    return fetchAPI<APIEnvelope<SentimentAnalysis>>(`/sentiment/${encodeURIComponent(ticker)}${query ? `?${query}` : ''}`);
  },
};

export const settingsAPI = {
  getSettings: () => fetchAPI<APIEnvelope<UserSettings>>('/settings'),
  updateSettings: (settings: UserSettings) => fetchAPI<APIEnvelope<UserSettings>>('/settings', {
    method: 'PUT', body: JSON.stringify(settings),
  }),
};