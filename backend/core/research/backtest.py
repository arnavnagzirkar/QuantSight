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

def position_turnover(positions: pd.Series) -> pd.Series:
    turnover = positions.diff().abs()
    if not turnover.empty:
        turnover.iloc[0] = abs(float(positions.iloc[0]))
    return turnover.fillna(0.0)


def apply_transaction_costs(positions: pd.Series, cost_bps: float = 5.0) -> pd.Series:
    return position_turnover(positions) * (cost_bps / 1e4)

def prob_to_position(
    prob_up: pd.Series,
    threshold: float = 0.5,
    max_leverage: float = 1.0,
    position_rule: str = "long_short",
):
    raw = (prob_up - threshold) / max(1e-6, (1 - threshold))
    if position_rule == "long_only":
        pos = raw.clip(0, 1) * max_leverage
    elif position_rule == "long_short":
        pos = raw.clip(-1, 1) * max_leverage
    else:
        raise ValueError("position_rule must be 'long_only' or 'long_short'")
    return pos

def backtest_prob_strategy(
    df: pd.DataFrame,
    prob_col: str,
    ret_col: str = "target_ret_1d",
    threshold: float = 0.5,
    max_leverage: float = 1.0,
    cost_bps: float = 5.0,
    position_rule: str = "long_short",
) -> dict:
    bt = df.dropna(subset=[prob_col, ret_col]).copy()
    positions = prob_to_position(bt[prob_col], threshold, max_leverage, position_rule)
    asset_returns = np.expm1(bt[ret_col])
    strat_ret_gross = positions * asset_returns
    turnover = position_turnover(positions)
    costs = turnover * (cost_bps / 1e4)
    strat_ret_net = strat_ret_gross - costs
    cum = (1 + strat_ret_net).cumprod()

    return dict(
        n=len(bt),
        sharpe=sharpe(strat_ret_net),
        sortino=sortino(strat_ret_net),
        mdd=max_drawdown(cum),
        cum_return=float(cum.iloc[-1] - 1.0),
        turnover=float(turnover.mean()),
        equity_curve=cum,
        series=strat_ret_net,
        gross_returns=strat_ret_gross,
        positions=positions,
        turnover_series=turnover,
        transaction_costs=costs,
    )
