# core/adapter_api.py
"""
Adapter API Blueprint - Maps React frontend API expectations to existing Flask backend endpoints.
This allows the Figma-designed React UI to work with your existing research backend.
"""
from flask import Blueprint, request, jsonify
import pandas as pd
from datetime import datetime
from .research.experiment import run_walkforward_xgb
from .research.portfolio import backtest_portfolio
from .research.factors import compute_alpha_factors, compute_pca_diagnostics
from .research.models import feature_columns
from .research.stats import sharpe_ratio, sortino_ratio, max_drawdown, cagr_from_equity
from .research.decay import compute_signal_decay
from .research.ff import fama_french_exposure
import yfinance as yf
import numpy as np

adapter_bp = Blueprint('adapter', __name__, url_prefix='/api')

# ========== Dashboard Endpoints ==========
@adapter_bp.route('/dashboard/overview', methods=['GET'])
def dashboard_overview():
    """Aggregate dashboard metrics from existing portfolio/backtest data"""
    # For MVP, return placeholder - can be enhanced to aggregate from saved runs
    return jsonify({
        "total_equity": 100000.0,
        "daily_pnl": 523.45,
        "total_return": 0.0523,
        "sharpe": 1.85,
        "max_drawdown": -0.12,
        "active_positions": 4,
        "updated_at": datetime.now().isoformat()
    })

@adapter_bp.route('/dashboard/signals', methods=['GET'])
def dashboard_signals():
    """Recent model signals"""
    limit = int(request.args.get('limit', 10))
    # Placeholder - can integrate with saved predictions
    return jsonify([
        {"ticker": "AAPL", "signal": "prob_up_1d", "value": 0.68, "timestamp": datetime.now().isoformat()},
        {"ticker": "MSFT", "signal": "prob_up_1d", "value": 0.72, "timestamp": datetime.now().isoformat()},
    ][:limit])

# ========== Ticker Intelligence (maps to existing predict) ==========
@adapter_bp.route('/tickers/<ticker>', methods=['GET'])
def get_ticker_data(ticker):
    """Get ticker overview - wraps existing predict endpoint"""
    from main import get_price_history, fetch_stock_price
    try:
        price = fetch_stock_price(ticker)
        hist = get_price_history(ticker, period='5d')
        
        return jsonify({
            "ticker": ticker,
            "current_price": price,
            "volume": float(hist['Close'].iloc[-1]) if not hist.empty else 0,
            "change_pct": float(hist['Close'].pct_change().iloc[-1]) if len(hist) > 1 else 0,
            "updated_at": datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# ========== Factor Explorer (maps to /api/factors) ==========
@adapter_bp.route('/factors/compute', methods=['POST'])
def compute_factors_adapter():
    """Compute factors for given tickers - wraps existing factor compute"""
    data = request.get_json() or {}
    tickers = data.get('tickers', [])
    start = data.get('startDate', '2015-01-01')
    
    if not tickers:
        return jsonify({"error": "No tickers provided"}), 400
    
    try:
        # Use first ticker for demo
        ticker = tickers[0]
        px_raw = yf.download(ticker, start=start, auto_adjust=True, progress=False)
        
        if px_raw.empty:
            return jsonify({"error": f"No data for {ticker}"}), 400
        
        # Flatten if needed
        if isinstance(px_raw.columns, pd.MultiIndex):
            px_raw.columns = px_raw.columns.get_level_values(0)
        
        # Get SPY/VIX for cross-asset factors
        spy = yf.download("SPY", start=start, auto_adjust=True, progress=False)['Close']
        vix = yf.download("^VIX", start=start, auto_adjust=True, progress=False)['Close']
        
        df = compute_alpha_factors(px_raw, spy=spy, vix=vix, sector=None)
        cols = feature_columns(df)
        
        # Return last 100 rows
        preview = df[cols].tail(100)
        
        return jsonify({
            "ticker": ticker,
            "columns": cols,
            "row_count": len(preview),
            "data": preview.reset_index().to_dict(orient='records')
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@adapter_bp.route('/factors/pca', methods=['POST'])
def pca_adapter():
    """PCA diagnostics - wraps existing PCA compute"""
    data = request.get_json() or {}
    ticker = data.get('ticker', 'AAPL')
    start = data.get('start', '2015-01-01')
    
    try:
        px_raw = yf.download(ticker, start=start, auto_adjust=True, progress=False)
        if px_raw.empty:
            return jsonify({"error": f"No data for {ticker}"}), 400
        
        if isinstance(px_raw.columns, pd.MultiIndex):
            px_raw.columns = px_raw.columns.get_level_values(0)
        
        spy = yf.download("SPY", start=start, auto_adjust=True, progress=False)['Close']
        vix = yf.download("^VIX", start=start, auto_adjust=True, progress=False)['Close']
        
        df = compute_alpha_factors(px_raw, spy=spy, vix=vix, sector=None)
        cols = feature_columns(df)
        
        pca_result = compute_pca_diagnostics(df, cols, n_components=8, topk_loadings=8)
        
        return jsonify(pca_result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ========== Model Lab (maps to existing experiment endpoints) ==========
@adapter_bp.route('/models/train', methods=['POST'])
def train_model_adapter():
    """Train model - wraps existing walk-forward XGB"""
    data = request.get_json() or {}
    tickers = data.get('tickers', ['AAPL'])
    ticker = tickers[0] if tickers else 'AAPL'
    start = data.get('startDate', '2015-01-01')
    horizon = data.get('horizon', '1d')
    params = data.get('params', {})
    
    try:
        px_raw = yf.download(ticker, start=start, auto_adjust=True, progress=False)
        if px_raw.empty:
            return jsonify({"error": f"No data for {ticker}"}), 400
        
        if isinstance(px_raw.columns, pd.MultiIndex):
            px_raw.columns = px_raw.columns.get_level_values(0)
        
        spy = yf.download("SPY", start=start, auto_adjust=True, progress=False)['Close']
        vix = yf.download("^VIX", start=start, auto_adjust=True, progress=False)['Close']
        
        result = run_walkforward_xgb(px_raw, spy=spy, vix=vix, sector=None, horizon=horizon, params=params)
        
        # Format for React frontend
        eq = result.get('equity_curve', pd.Series(dtype='float'))
        metrics = result.get('metrics', {})
        
        return jsonify({
            "model_id": f"{ticker}_{horizon}_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "ticker": ticker,
            "horizon": horizon,
            "metrics": metrics,
            "equity_curve": eq.to_dict() if isinstance(eq, pd.Series) else {},
            "feature_importance": result.get('feature_importance', [])[:15],
            "created_at": datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ========== Experiment Manager (maps to /api/experiment/run) ==========
@adapter_bp.route('/experiments/run', methods=['POST'])
def run_experiment_adapter():
    """Run experiment - direct passthrough to existing endpoint"""
    # This can directly use the existing /api/experiment/run implementation
    from .research.api import experiment_run
    return experiment_run()

# ========== Signal Diagnostics (maps to /api/decay & /api/quantiles) ==========
@adapter_bp.route('/signals/decay', methods=['POST'])
def signal_decay_adapter():
    """Signal decay analysis"""
    data = request.get_json() or {}
    ticker = data.get('ticker', 'AAPL')
    start = data.get('start', '2015-01-01')
    horizons = data.get('horizons', [1, 3, 5, 10, 20])
    
    try:
        from .research.api import decay_endpoint
        # Reuse existing implementation by constructing proper request
        return decay_endpoint()
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ========== Portfolio Lab (maps to /api/portfolio/backtest) ==========
@adapter_bp.route('/portfolio/backtest', methods=['POST'])
def portfolio_backtest_adapter():
    """Portfolio backtest - wraps existing portfolio engine"""
    data = request.get_json() or {}
    
    try:
        result = backtest_portfolio(
            tickers=data.get('tickers', ['AAPL', 'MSFT']),
            start=data.get('start', '2015-01-01'),
            signal=data.get('signal', 'prob_up_1d'),
            allocator=data.get('allocator', 'equal_weight'),
            rebalance=data.get('rebalance', 'weekly'),
            cost_bps=float(data.get('cost_bps', 5.0))
        )
        
        # Format for React frontend
        equity = result.get('equity_curve')
        daily_ret = result.get('daily_returns') if 'daily_returns' in result else result.get('daily')
        
        return jsonify({
            "portfolio_id": f"pf_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "universe": result.get('universe', []),
            "equity_curve": equity.to_dict() if isinstance(equity, pd.Series) else {},
            "weights": result.get('weights', pd.DataFrame()).to_dict() if isinstance(result.get('weights'), pd.DataFrame) else {},
            "created_at": datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ========== Risk & Performance (maps to /api/risk) ==========
@adapter_bp.route('/risk/metrics', methods=['GET'])
def risk_metrics_adapter():
    """Risk metrics for a portfolio or ticker"""
    ticker = request.args.get('ticker', 'AAPL')
    start = request.args.get('start', '2015-01-01')
    
    try:
        # Quick demo using single ticker
        px_raw = yf.download(ticker, start=start, auto_adjust=True, progress=False)
        if px_raw.empty:
            return jsonify({"error": f"No data for {ticker}"}), 400
        
        if isinstance(px_raw.columns, pd.MultiIndex):
            px = px_raw['Close']
        else:
            px = px_raw['Close'] if 'Close' in px_raw else px_raw['Adj Close']
        
        returns = np.log(px).diff().dropna()
        equity = returns.cumsum().apply(np.exp)
        
        return jsonify({
            "sharpe": sharpe_ratio(returns),
            "sortino": sortino_ratio(returns),
            "max_drawdown": max_drawdown(equity),
            "cagr": cagr_from_equity(equity),
            "volatility": float(returns.std() * np.sqrt(252)),
            "ticker": ticker
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ========== Sentiment Analyzer (maps to /analyze) ==========
@adapter_bp.route('/sentiment/analyze', methods=['POST'])
def sentiment_analyze_adapter():
    """Analyze sentiment - wraps existing /analyze endpoint"""
    data = request.get_json() or {}
    tickers = data.get('tickers', [])
    
    if not tickers:
        return jsonify({"error": "No tickers provided"}), 400
    
    results = []
    for ticker in tickers:
        try:
            from main import fetch_news, analyze_sentiment
            headlines = fetch_news(ticker)
            sentiments = analyze_sentiment(headlines)
            results.append({
                "ticker": ticker,
                "headlines": sentiments
            })
        except Exception as e:
            results.append({"ticker": ticker, "error": str(e)})
    
    return jsonify({"results": results})

# ========== Settings ==========
@adapter_bp.route('/settings', methods=['GET', 'PUT'])
def settings_adapter():
    """Get or update settings"""
    if request.method == 'GET':
        return jsonify({
            "theme": "dark",
            "default_universe": ["AAPL", "MSFT", "GOOGL", "AMZN"],
            "default_allocator": "equal_weight",
            "default_rebalance": "weekly"
        })
    else:
        data = request.get_json() or {}
        # Store settings (could use flask session or db)
        return jsonify({"success": True, "settings": data})
