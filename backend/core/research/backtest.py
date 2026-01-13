import numpy as np
import pandas as pd

def sharpe(returns: pd.Series, ann_factor: int = 252) -> float:
    mu = returns.mean() * ann_factor
    sd = returns.std(ddof=0) * np.sqrt(ann_factor)
    return float(mu / (sd + 1e-12))

def sortino(returns: pd.Series, ann_factor: int = 252) -> float:
    downside = returns[returns < 0].std(ddof=0)
    mu = returns.mean() * ann_factor
    return float(mu / (downside * np.sqrt(ann_factor) + 1e-12))

def max_drawdown(cum: pd.Series) -> float:
    peak = cum.cummax()
    dd = (cum / peak) - 1.0
    return float(dd.min())

def apply_transaction_costs(pos: pd.Series, cost_bps: float = 5.0) -> pd.Series:
    turnover = pos.diff().abs().fillna(0.0)
    costs = (turnover * (cost_bps / 1e4))
    return costs

def prob_to_position(prob_up: pd.Series, threshold: float = 0.5, max_leverage: float = 1.0):
    raw = (prob_up - threshold) / max(1e-6, (1 - threshold))
    pos = raw.clip(-1, 1) * max_leverage
    return pos

def backtest_prob_strategy(
    df: pd.DataFrame,
    prob_col: str,
    ret_col: str = "target_ret_1d",
    threshold: float = 0.5,
    max_leverage: float = 1.0,
    cost_bps: float = 5.0,
) -> dict:
    bt = df.dropna(subset=[prob_col, ret_col]).copy()
    bt["pos"] = prob_to_position(bt[prob_col], threshold, max_leverage)
    strat_ret_gross = bt["pos"].shift(1).fillna(0) * bt[ret_col]
    costs = apply_transaction_costs(bt["pos"], cost_bps)
    strat_ret_net = strat_ret_gross - costs
    cum = (1 + strat_ret_net).cumprod()

    return dict(
        n=len(bt),
        sharpe=sharpe(strat_ret_net),
        sortino=sortino(strat_ret_net),
        mdd=max_drawdown(cum),
        cum_return=float(cum.iloc[-1] - 1.0),
        turnover=float(bt["pos"].diff().abs().mean()),
        equity_curve=cum,
        series=strat_ret_net,
    )
