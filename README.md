# 📈 QuantSight - Intelligent Quantitative Research Platform

> **Transform market data into actionable insights with machine learning-powered stock analysis**

QuantSight is a professional-grade quantitative research platform that combines the power of machine learning, statistical analysis, and modern web technologies to help traders, analysts, and researchers make data-driven investment decisions. Whether you're backtesting trading strategies, analyzing alpha factors, or exploring market sentiment, QuantSight provides the tools you need in an intuitive, elegant interface.

## ✨ Key Features

- **🔐 Secure Authentication** - Email/password and OAuth (Google, GitHub) with email verification
- **🤖 Walk-Forward ML Models** - XGBoost predictions with proper out-of-sample validation
- **📊 Portfolio Backtesting** - Multi-asset strategies with various allocation methods
- **🔍 Factor Analysis** - 60+ alpha factors with PCA diagnostics and IC analysis
- **📰 Sentiment Analysis** - NLP-powered news sentiment extraction
- **📈 Signal Diagnostics** - Validate signal quality with decay analysis
- **⚡ Modern UI** - React + TypeScript frontend with dark mode
- **🔧 RESTful API** - Production-ready endpoints for automation

---

## 🚀 Quick Start

### Prerequisites

1. **Supabase Account** - Sign up at [supabase.com](https://supabase.com)
2. **Node.js 16+** and **Python 3.9+**

### Local Development

The project is organized into two main directories:
- `frontend/` - React + TypeScript (Vite)
- `backend/` - Flask + Python

**Terminal 1 - Backend:**
```powershell
cd backend
pip install -r requirements.txt
python main.py
```
Backend runs at `http://localhost:5000`

**Terminal 2 - Frontend:**
```powershell
cd frontend
npm install
npm run dev
```
Frontend runs at `http://localhost:5173`

### First-Time Setup

1. **Set up Supabase database:**
   - Follow instructions in [SUPABASE_SETUP.md](SUPABASE_SETUP.md)
   - Run the SQL script to create the profiles table
   - Enable email authentication and OAuth providers

2. **Configure environment variables:**
   
   `frontend/.env`:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   VITE_API_BASE_URL=http://localhost:5000
   ```
   
   `backend/.env`:
   ```env
   NEWS_API_KEY=your_news_api_key
   PORT=5000
   ```

3. **Access the app:**
   - Open `http://localhost:5173`
   - Create an account or sign in
   - Verify your email to access the platform

---

## 🌐 Deployment

This project is designed to deploy on:
- **Frontend:** Vercel (free tier)
- **Backend:** Render (free tier)

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment instructions.

**Quick Deploy:**
1. Push to GitHub
2. Connect Render to deploy backend
3. Connect Vercel to deploy frontend
4. Update environment variables on both platforms

---

## 🔐 Authentication

QuantSight uses Supabase for secure authentication:

- **Email/Password**: Traditional registration with email verification
- **OAuth**: Sign in with Google or GitHub
- **Protected Routes**: All app features require authentication
- **User Profiles**: Stores user information and preferences

See [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for detailed setup instructions.

## 🏗️ Tech Stack

**Frontend:** React 18 • TypeScript • Vite • TailwindCSS • Recharts • Radix UI  
**Backend:** Flask 3 • Python 3.9+ • Flask-CORS • XGBoost • pandas • numpy  
**Auth:** Supabase Authentication • Row Level Security  
**Data:** yfinance (market data) • NewsAPI (sentiment) • local file cache  
**Deployment:** Vercel (Frontend) • Render (Backend)

## 📁 Project Structure

```
QuantSight/
├── frontend/                  # React + TypeScript (→ Vercel)
│   ├── components/           # React components
│   ├── contexts/             # Auth context
│   ├── services/             # API & Supabase client
│   ├── App.tsx               # Main app
│   ├── package.json          # Frontend deps
│   └── vercel.json           # Deployment config
├── backend/                   # Flask API (→ Render)
│   ├── core/                 # Python backend logic
│   │   ├── adapter_api.py   # REST API endpoints
│   │   ├── model.py         # XGBoost ML models
│   │   ├── backtest.py      # Backtesting engine
│   │   └── research/        # Factor analysis, portfolios
│   ├── main.py              # Flask app entry
│   └── requirements.txt     # Python deps
├── DEPLOYMENT.md            # Deployment guide
├── SUPABASE_SETUP.md        # Supabase setup
└── README.md                # This file
```

See [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for detailed structure information.
│   ├── adapter_api.py        # REST API endpoints
│   ├── model.py              # XGBoost ML models
│   ├── backtest.py           # Backtesting engine
│   └── research/             # Factor analysis, portfolios, experiments
├── components/               # React frontend
│   ├── pages/                # 11 main pages (Dashboard, ModelLab, etc.)
│   ├── ui/                   # Reusable UI components
│   └── charts/               # Data visualizations
├── data/                     # Cached market data
├── models/                   # Trained ML models
└── dist/                     # Production build
```

## 🔧 API Endpoints

### Main Endpoints
- `POST /api/models/train` - Train walk-forward XGBoost model
- `POST /api/portfolio/backtest` - Multi-asset portfolio backtest
- `POST /api/factors/compute` - Calculate 60+ alpha factors
- `POST /api/experiments/run` - Hyperparameter grid search
- `POST /api/signals/decay` - Signal decay analysis
- `POST /api/sentiment/analyze` - News sentiment extraction
- `GET /api/dashboard/overview` - Portfolio metrics
- `GET /api/tickers/:ticker` - Single-stock analysis
- `GET /api/risk/metrics` - Risk analytics

**Example Request:**
```bash
curl -X POST http://localhost:5000/api/models/train \
  -H "Content-Type: application/json" \
  -d '{"tickers": ["AAPL"], "startDate": "2015-01-01", "horizon": "1d"}'
```

## 💡 Usage Example

**Train a model and backtest a strategy:**

```bash
# 1. Train XGBoost model
curl -X POST http://localhost:5000/api/models/train \
  -H "Content-Type: application/json" \
  -d '{"tickers": ["AAPL"], "startDate": "2015-01-01", "horizon": "1d"}'

# 2. Run portfolio backtest
curl -X POST http://localhost:5000/api/portfolio/backtest \
  -H "Content-Type: application/json" \
  -d '{
    "tickers": ["AAPL", "MSFT", "GOOGL"],
    "start": "2015-01-01",
    "signal": "prob_up_1d",
    "allocator": "equal_weight",
    "rebalance": "weekly"
  }'
```

**Or use the web interface** - navigate to Model Lab or Portfolio Backtest pages.

## ⚙️ Configuration

Create a `.env` file for API keys:
```bash
NEWS_API_KEY=your_news_api_key_here  # Get free key at newsapi.org
VITE_API_BASE_URL=http://localhost:5000
```

**Customize factors** in `core/research/factors.py` or **model parameters** in `core/model.py`.

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| `ModuleNotFoundError` | Run `pip install -r requirements.txt` |
| `Cannot find module 'react'` | Run `npm install` |
| Port 5000 in use | Change port in `main.py` or kill process |
| "Failed to fetch" errors | Ensure Flask backend is running |
| Slow model training | Reduce date range or use fewer tickers |

---

## 🚀 Deployment

**Production build:**
```bash
npm run build
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 main:app
```

**Security:** Enable HTTPS, set `FLASK_DEBUG=False`, implement rate limiting and authentication.

---

## 🤝 Contributing

Contributions welcome! Fork the repo, create a feature branch, and submit a PR.  
Follow PEP 8 for Python and ESLint rules for TypeScript.

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built with ❤️ for quantitative researchers**

*QuantSight - See the market through a quantitative lens*