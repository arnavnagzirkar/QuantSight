# QuantSight

QuantSight is a multi-user quantitative research application for delayed market data, walk-forward model evaluation, portfolio simulation, signal diagnostics, risk analysis, and news sentiment. It is a research platform, not a live trading or brokerage system.

## Architecture

- React 18, TypeScript, Vite, Tailwind CSS, and Recharts frontend
- Flask API protected by Supabase access tokens
- Supabase PostgreSQL, Row Level Security, and private Storage
- Redis and RQ for model training, experiments, backtests, portfolios, and signal analysis
- XGBoost, PyTorch LSTM, and weighted XGBoost/LSTM ensembles
- yfinance for delayed market data and NewsAPI with VADER classification for headlines

The Flask process serves JSON only. The React application is the only maintained UI.

## Prerequisites

- Python 3.13.2
- Node.js 20 or newer
- Docker Desktop for local Redis, or another Redis-compatible service
- A Supabase project
- A NewsAPI key

## Placeholder Values

This repository intentionally contains placeholders. Fill them locally or in deployment dashboards:

| Placeholder | Location |
|---|---|
| `YOUR_PROJECT` | Supabase project reference |
| `YOUR_SUPABASE_ANON_KEY` | Supabase publishable or anon key |
| `YOUR_SUPABASE_SERVICE_ROLE_KEY` | Backend-only Supabase service-role key |
| `YOUR_NEWSAPI_KEY` | NewsAPI credential |
| `YOUR_BACKEND` | Render backend service name |
| `YOUR_FRONTEND` | Vercel frontend project name |

Never put the service-role key or NewsAPI key in frontend environment variables.

## Supabase Setup

1. Open the Supabase SQL editor.
2. Run [supabase-setup.sql](supabase-setup.sql).
3. Confirm email/password authentication is enabled.
4. Configure Google and GitHub OAuth only if you plan to use those buttons.
5. Add local and production callback URLs ending in `/auth/callback`.
6. Use asymmetric JWT signing keys so the Flask API can verify tokens through JWKS.

The SQL creates profiles, user settings, jobs, models, experiments, backtests, portfolios, signal analyses, private Storage buckets, ownership indexes, and Row Level Security policies.

## Environment Files

Create local files from the checked-in templates:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Fill [backend/.env.example](backend/.env.example) and [frontend/.env.example](frontend/.env.example) locally. Real `.env` files are ignored by Git.

## Local Development

Create and populate the Python environment:

```powershell
py -3.13 -m venv .venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
& .\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
```

Start Redis:

```powershell
docker compose up -d redis
```

Start the API:

```powershell
cd backend
python main.py
```

Start the worker in a second terminal:

```powershell
& .\.venv\Scripts\Activate.ps1
cd backend
python worker.py
```

Start the frontend in a third terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`.

## Tests

Backend:

```powershell
& .\.venv\Scripts\python.exe -m compileall -q backend
& .\.venv\Scripts\python.exe -m pytest backend/tests -q
```

Frontend:

```powershell
cd frontend
npm test
npm run build
```

The backend suite covers authentication, ownership boundaries, request validation, market-data contracts, target leakage, position timing, portfolio weight timing, LSTM sequence causality, ensemble weighting, jobs, experiments, dashboard aggregation, settings, sentiment, risk, and API contracts.

## API And Worker Health

- `GET /healthz` checks that the Flask process is alive.
- `GET /readyz` checks placeholder configuration and live Supabase, Redis, and NewsAPI readiness.
- All `/api/*` routes except `/api/auth/*` require `Authorization: Bearer <Supabase access token>`.
- Long-running create endpoints return `202` with a job ID. The frontend polls `/api/jobs/{id}` and supports cooperative cancellation.

## Persistence

- Supabase is the source of truth for profiles, settings, experiments, jobs, models, backtests, portfolios, portfolio runs, signal analyses, and experiment runs.
- Every completed research job is linked to a dedicated domain record and a full JSON artifact in private Supabase Storage.
- Tool forms, selected runs, result views, tabs, and sidebar state are stored per user in browser storage and synchronize across tabs.
- Model, backtest, portfolio, and signal pages restore the latest matching Supabase job on a new device and provide selectors for prior saved runs.
- Ticker, factor, sentiment, and dashboard responses restore instantly after route changes or refreshes without requiring another provider request.
- Passwords, password confirmations, transient errors, and loading flags are never persisted.
- Local market-data caches, Python bytecode, and frontend build output are reproducible performance artifacts, not sources of truth.

## Deployment

[render.yaml](render.yaml) defines placeholder-backed Render services for:

- Gunicorn Flask web service
- RQ worker service
- Render Key Value Redis service

Set the `sync: false` values in the Render dashboard. Deploy the `frontend` folder to Vercel and fill the three `VITE_*` variables there using [frontend/.env.example](frontend/.env.example) as the template.

## Data And Modeling Notes

- yfinance data is delayed and may be revised or unavailable.
- Model metrics are calculated from chronological out-of-sample predictions.
- Multi-day model horizons still realize one tradable daily portfolio return at a time.
- Portfolio weights become effective after the signal timestamp to avoid lookahead.
- LSTM scaling is fit only on each training fold.
- Historical stress results report observed performance only. Custom beta shock results are linear estimates, not forecasts.

## License

MIT, see [LICENSE](LICENSE).