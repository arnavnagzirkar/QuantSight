# QuantSight Project Structure

## 📁 New Organization

```
StocksNow/
├── frontend/                    # React app (deploy to Vercel)
│   ├── components/              # React components
│   ├── contexts/                # Auth context
│   ├── hooks/                   # Custom hooks
│   ├── services/                # API services, Supabase client
│   ├── styles/                  # CSS/Tailwind
│   ├── utils/                   # Utility functions
│   ├── App.tsx                  # Main app component
│   ├── main.tsx                 # Entry point
│   ├── index.html               # HTML template
│   ├── package.json             # Frontend dependencies
│   ├── vite.config.ts           # Vite configuration
│   ├── tailwind.config.js       # Tailwind CSS config
│   ├── vercel.json              # Vercel deployment config
│   ├── .env                     # Local env variables
│   └── .env.production          # Production env variables
│
├── backend/                     # Flask API (deploy to Render)
│   ├── core/                    # Python backend logic
│   │   ├── adapter_api.py       # API adapters
│   │   ├── model.py             # ML models
│   │   ├── backtest.py          # Backtesting engine
│   │   ├── features.py          # Feature engineering
│   │   └── research/            # Research modules
│   ├── templates/               # Flask templates
│   ├── static/                  # Static assets
│   ├── data/                    # Cached data
│   ├── models/                  # Trained ML models
│   ├── main.py                  # Flask app entry point
│   ├── requirements.txt         # Python dependencies
│   └── .env                     # Backend env variables
│
├── .gitignore                   # Git ignore rules
├── .env.example                 # Example environment variables
├── README.md                    # Main documentation
├── DEPLOYMENT.md                # Deployment guide
├── SUPABASE_SETUP.md            # Supabase setup instructions
├── QUICKSTART.md                # Quick start guide
└── LICENSE                      # License file
```

## 🚀 How to Work With This Structure

### Development

**Frontend:**
```powershell
cd frontend
npm install
npm run dev
```

**Backend:**
```powershell
cd backend
pip install -r requirements.txt
python main.py
```

### Deployment

**Frontend → Vercel:**
- Auto-deploys from GitHub
- Root directory: `frontend`

**Backend → Render:**
- Auto-deploys from GitHub
- Root directory: `backend`

See [DEPLOYMENT.md](DEPLOYMENT.md) for full instructions.

## 🔗 Communication Flow

```
User Browser
    ↓
Vercel (React Frontend)
    ↓
Render (Flask Backend)
    ↓
External APIs (yfinance, NewsAPI)
    +
Supabase (Auth + Database)
```

## 📝 Key Files

### Frontend
- `App.tsx` - Main routing and auth wrapper
- `contexts/AuthContext.tsx` - Authentication logic
- `services/supabase.ts` - Supabase client
- `vite.config.ts` - Vite settings (proxy for local dev)

### Backend
- `main.py` - Flask app with CORS
- `core/adapter_api.py` - API endpoints
- `core/model.py` - ML model training
- `requirements.txt` - Python packages

## 🔧 Environment Variables

### Frontend (.env)
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_API_BASE_URL=http://localhost:5000  # Local
# VITE_API_BASE_URL=https://your-app.onrender.com  # Production
```

### Backend (.env)
```env
NEWS_API_KEY=your_news_api_key
PORT=5000
```

## 🎯 Why This Structure?

✅ **Separation of Concerns:** Frontend and backend are independent
✅ **Easy Deployment:** Each can be deployed separately
✅ **Scalability:** Scale frontend and backend independently
✅ **Clear Organization:** Know where everything lives
✅ **Flexible:** Can switch platforms easily if needed
