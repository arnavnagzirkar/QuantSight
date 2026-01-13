import pandas as pd, numpy as np

def run_backtest(price: pd.Series, prob_up: pd.Series, long_th=0.55, short_th=0.45):
    # Ensure both series are aligned on the same DateTimeIndex
    price = price.copy()
    prob_up = prob_up.copy()
    idx = price.index
    prob_up = prob_up.reindex(idx).astype(float).fillna(0.5)

    ret = price.pct_change().fillna(0.0)

    # Positions (long/short/flat)
    pos = pd.Series(0.0, index=idx)
    mask_long = prob_up >= float(long_th)
    mask_short = prob_up <= float(short_th)
    pos.loc[mask_long] = 1.0
    pos.loc[mask_short] = -1.0

    strat = (pos.shift(1).fillna(0.0) * ret)
    equity = (1.0 + strat).cumprod()
    bh = (1.0 + ret).cumprod()

    dd = equity / equity.cummax() - 1.0
    daily = strat

    # small eps for stability
    sharpe = (daily.mean() / (daily.std() + 1e-12)) * np.sqrt(252.0)
    cagr = float(equity.iloc[-1]) ** (252.0 / max(len(equity), 1)) - 1.0

    return {
        "metrics": {
            "CAGR": float(cagr),
            "Sharpe": float(sharpe),
            "MaxDD": float(dd.min()),
        },
        "equity": equity,
        "buy_hold": bh,
        "positions": pos,
    }
