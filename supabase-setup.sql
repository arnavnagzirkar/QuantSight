-- QuantSight Supabase schema
-- Run this file in the Supabase SQL editor as a project owner.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  username TEXT NOT NULL,
  use_case TEXT NOT NULL DEFAULT 'personal',
  company_name TEXT,
  role TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS use_case TEXT NOT NULL DEFAULT 'personal';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_key ON public.profiles (LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key ON public.profiles (LOWER(username));

CREATE OR REPLACE FUNCTION public.handle_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username TEXT;
  candidate_username TEXT;
  suffix_number INTEGER := 0;
BEGIN
  base_username := LOWER(COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'username', ''),
    NULLIF(SPLIT_PART(NEW.email, '@', 1), ''),
    'user'
  ));
  base_username := REGEXP_REPLACE(base_username, '[^a-z0-9_]', '', 'g');
  IF LENGTH(base_username) < 3 THEN
    base_username := 'user_' || SUBSTRING(REPLACE(NEW.id::TEXT, '-', '') FROM 1 FOR 8);
  END IF;
  base_username := LEFT(base_username, 30);
  candidate_username := base_username;

  WHILE EXISTS (
    SELECT 1 FROM public.profiles
    WHERE LOWER(username) = candidate_username AND id <> NEW.id
  ) LOOP
    suffix_number := suffix_number + 1;
    candidate_username := LEFT(base_username, 25) || '_' || suffix_number::TEXT;
  END LOOP;

  INSERT INTO public.profiles (
    id, email, full_name, username, use_case, company_name, role, email_verified, avatar_url
  ) VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      SPLIT_PART(COALESCE(NEW.email, ''), '@', 1),
      ''
    ),
    candidate_username,
    CASE
      WHEN NEW.raw_user_meta_data->>'use_case' IN ('personal', 'company', 'student')
        THEN NEW.raw_user_meta_data->>'use_case'
      ELSE 'personal'
    END,
    NULLIF(NEW.raw_user_meta_data->>'company_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'role', ''),
    NEW.email_confirmed_at IS NOT NULL,
    NULLIF(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    email_verified = EXCLUDED.email_verified,
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_changed ON auth.users;
CREATE TRIGGER on_auth_user_changed
  AFTER INSERT OR UPDATE OF email, email_confirmed_at, raw_user_meta_data
  ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user();

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  compact_mode BOOLEAN NOT NULL DEFAULT FALSE,
  default_tickers TEXT[] NOT NULL DEFAULT ARRAY['AAPL', 'MSFT', 'GOOGL'],
  default_model_type TEXT NOT NULL DEFAULT 'xgb' CHECK (default_model_type IN ('xgb', 'lstm', 'ensemble')),
  default_train_window INTEGER NOT NULL DEFAULT 750 CHECK (default_train_window BETWEEN 250 AND 3000),
  default_test_window INTEGER NOT NULL DEFAULT 63 CHECK (default_test_window BETWEEN 5 AND 252),
  default_max_folds INTEGER NOT NULL DEFAULT 10 CHECK (default_max_folds BETWEEN 1 AND 50),
  notify_job_complete BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('model_train', 'experiment_run', 'signal_analysis', 'backtest', 'portfolio_run')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancel_requested', 'cancelled')),
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  progress_phase TEXT,
  params JSONB NOT NULL DEFAULT '{}'::JSONB,
  result_summary JSONB,
  result_resource_type TEXT,
  result_resource_id UUID,
  idempotency_key TEXT,
  cancel_requested BOOLEAN NOT NULL DEFAULT FALSE,
  attempt INTEGER NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 2 CHECK (max_attempts BETWEEN 1 AND 5),
  error_code TEXT,
  error_message TEXT,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS jobs_user_idempotency_key
  ON public.jobs (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS jobs_user_status_created_idx
  ON public.jobs (user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (CHAR_LENGTH(name) BETWEEN 1 AND 100),
  description TEXT,
  ticker TEXT NOT NULL,
  model_type TEXT NOT NULL CHECK (model_type IN ('xgb', 'lstm', 'ensemble')),
  horizon TEXT NOT NULL CHECK (horizon IN ('1d', '5d', '20d')),
  status TEXT NOT NULL DEFAULT 'training' CHECK (status IN ('training', 'ready', 'failed', 'archived')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  config JSONB NOT NULL DEFAULT '{}'::JSONB,
  metrics JSONB,
  feature_importance JSONB,
  artifact_path TEXT,
  artifact_hash TEXT,
  trained_from DATE,
  trained_to DATE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name, version)
);
CREATE INDEX IF NOT EXISTS models_user_created_idx ON public.models (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (CHAR_LENGTH(name) BETWEEN 1 AND 100),
  description TEXT,
  ticker TEXT NOT NULL,
  model_type TEXT NOT NULL CHECK (model_type IN ('xgb', 'lstm', 'ensemble')),
  config JSONB NOT NULL DEFAULT '{}'::JSONB,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS experiments_user_created_idx ON public.experiments (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.experiment_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  experiment_id UUID NOT NULL REFERENCES public.experiments(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  model_id UUID REFERENCES public.models(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  config_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  metrics JSONB,
  summary JSONB,
  result_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS experiment_runs_experiment_created_idx
  ON public.experiment_runs (experiment_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.backtests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  model_id UUID REFERENCES public.models(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (CHAR_LENGTH(name) BETWEEN 1 AND 100),
  ticker TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  config JSONB NOT NULL DEFAULT '{}'::JSONB,
  metrics JSONB,
  chart_data JSONB,
  result_path TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS backtests_user_created_idx ON public.backtests (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (CHAR_LENGTH(name) BETWEEN 1 AND 100),
  description TEXT,
  tickers TEXT[] NOT NULL CHECK (CARDINALITY(tickers) BETWEEN 1 AND 100),
  allocation_method TEXT NOT NULL CHECK (allocation_method IN ('equal_weight', 'risk_parity', 'mean_variance', 'signal_weighted', 'quantile')),
  config JSONB NOT NULL DEFAULT '{}'::JSONB,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS portfolios_user_created_idx ON public.portfolios (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.portfolio_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  config_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  metrics JSONB,
  chart_data JSONB,
  risk_summary JSONB,
  result_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS portfolio_runs_portfolio_created_idx
  ON public.portfolio_runs (portfolio_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.signal_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  model_id UUID REFERENCES public.models(id) ON DELETE SET NULL,
  ticker TEXT NOT NULL,
  signal_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  config JSONB NOT NULL DEFAULT '{}'::JSONB,
  metrics JSONB,
  chart_data JSONB,
  result_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS signal_analyses_user_created_idx
  ON public.signal_analyses (user_id, created_at DESC);

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS user_settings_set_updated_at ON public.user_settings;
CREATE TRIGGER user_settings_set_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS jobs_set_updated_at ON public.jobs;
CREATE TRIGGER jobs_set_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS models_set_updated_at ON public.models;
CREATE TRIGGER models_set_updated_at BEFORE UPDATE ON public.models FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS experiments_set_updated_at ON public.experiments;
CREATE TRIGGER experiments_set_updated_at BEFORE UPDATE ON public.experiments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS backtests_set_updated_at ON public.backtests;
CREATE TRIGGER backtests_set_updated_at BEFORE UPDATE ON public.backtests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS portfolios_set_updated_at ON public.portfolios;
CREATE TRIGGER portfolios_set_updated_at BEFORE UPDATE ON public.portfolios FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiment_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backtests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING ((SELECT auth.uid()) = id);
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id) WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS user_settings_own ON public.user_settings;
CREATE POLICY user_settings_own ON public.user_settings FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS jobs_own ON public.jobs;
CREATE POLICY jobs_own ON public.jobs FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS models_own ON public.models;
CREATE POLICY models_own ON public.models FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS experiments_own ON public.experiments;
CREATE POLICY experiments_own ON public.experiments FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS experiment_runs_own ON public.experiment_runs;
CREATE POLICY experiment_runs_own ON public.experiment_runs FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS backtests_own ON public.backtests;
CREATE POLICY backtests_own ON public.backtests FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS portfolios_own ON public.portfolios;
CREATE POLICY portfolios_own ON public.portfolios FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS portfolio_runs_own ON public.portfolio_runs;
CREATE POLICY portfolio_runs_own ON public.portfolio_runs FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS signal_analyses_own ON public.signal_analyses;
CREATE POLICY signal_analyses_own ON public.signal_analyses FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings, public.jobs, public.models,
  public.experiments, public.experiment_runs, public.backtests, public.portfolios,
  public.portfolio_runs, public.signal_analyses TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('models', 'models', FALSE, 52428800),
  ('research-results', 'research-results', FALSE, 104857600)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS models_storage_select_own ON storage.objects;
CREATE POLICY models_storage_select_own ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'models' AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT);
DROP POLICY IF EXISTS models_storage_insert_own ON storage.objects;
CREATE POLICY models_storage_insert_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'models' AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT);
DROP POLICY IF EXISTS models_storage_update_own ON storage.objects;
CREATE POLICY models_storage_update_own ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'models' AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT)
  WITH CHECK (bucket_id = 'models' AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT);
DROP POLICY IF EXISTS models_storage_delete_own ON storage.objects;
CREATE POLICY models_storage_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'models' AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT);

DROP POLICY IF EXISTS results_storage_select_own ON storage.objects;
CREATE POLICY results_storage_select_own ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'research-results' AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT);
DROP POLICY IF EXISTS results_storage_insert_own ON storage.objects;
CREATE POLICY results_storage_insert_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'research-results' AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT);
DROP POLICY IF EXISTS results_storage_update_own ON storage.objects;
CREATE POLICY results_storage_update_own ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'research-results' AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT)
  WITH CHECK (bucket_id = 'research-results' AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT);
DROP POLICY IF EXISTS results_storage_delete_own ON storage.objects;
CREATE POLICY results_storage_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'research-results' AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT);