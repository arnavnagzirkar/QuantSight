import numpy as np
import pandas as pd


def historical_var_cvar(returns: pd.Series, confidence: float = 0.95) -> dict:
    values = pd.to_numeric(returns, errors="coerce").replace([np.inf, -np.inf], np.nan).dropna()
    if values.empty:
        return {"confidence": confidence, "var": None, "cvar": None}
    if not 0.5 < confidence < 1.0:
        raise ValueError("confidence must be between 0.5 and 1")
    value_at_risk = float(values.quantile(1.0 - confidence))
    tail = values[values <= value_at_risk]
    conditional_var = float(tail.mean()) if not tail.empty else value_at_risk
    return {
        "confidence": confidence,
        "var": value_at_risk,
        "cvar": conditional_var,
    }


def drawdown_analysis(equity: pd.Series) -> dict:
    values = pd.to_numeric(equity, errors="coerce").replace([np.inf, -np.inf], np.nan).dropna()
    if values.empty:
        return {"max_drawdown": None, "underwater": [], "periods": []}
    values.index = pd.to_datetime(values.index)
    underwater = values / values.cummax() - 1.0
    periods = []
    active = None

    for position, (timestamp, depth) in enumerate(underwater.items()):
        if depth < 0 and active is None:
            peak_position = max(0, position - 1)
            active = {
                "start_date": underwater.index[peak_position],
                "trough_date": timestamp,
                "depth": float(depth),
                "start_position": peak_position,
                "trough_position": position,
            }
        elif depth < 0 and active is not None and depth < active["depth"]:
            active["depth"] = float(depth)
            active["trough_date"] = timestamp
            active["trough_position"] = position
        elif depth >= 0 and active is not None:
            periods.append({
                "start_date": active["start_date"].strftime("%Y-%m-%d"),
                "trough_date": active["trough_date"].strftime("%Y-%m-%d"),
                "recovery_date": timestamp.strftime("%Y-%m-%d"),
                "depth": active["depth"],
                "length_days": position - active["start_position"],
                "recovery_days": position - active["trough_position"],
            })
            active = None

    if active is not None:
        final_position = len(underwater) - 1
        periods.append({
            "start_date": active["start_date"].strftime("%Y-%m-%d"),
            "trough_date": active["trough_date"].strftime("%Y-%m-%d"),
            "recovery_date": None,
            "depth": active["depth"],
            "length_days": final_position - active["start_position"],
            "recovery_days": None,
        })

    return {
        "max_drawdown": float(underwater.min()),
        "underwater": [
            {"date": timestamp.strftime("%Y-%m-%d"), "value": float(value)}
            for timestamp, value in underwater.items()
        ],
        "periods": sorted(periods, key=lambda period: period["depth"]),
    }


def component_risk(
    asset_returns: pd.DataFrame,
    weights: pd.Series,
    benchmark_returns: pd.Series,
    lookback: int = 252,
) -> list[dict]:
    names = [name for name in weights.index if name in asset_returns.columns]
    if not names:
        return []
    returns = asset_returns[names].tail(lookback).astype(float)
    weight_vector = weights.reindex(names).fillna(0.0).astype(float)
    covariance = returns.cov().to_numpy() * 252.0
    vector = weight_vector.to_numpy()
    portfolio_variance = float(vector @ covariance @ vector)
    covariance_times_weights = covariance @ vector
    contribution = (
        vector * covariance_times_weights / portfolio_variance
        if portfolio_variance > 1e-18
        else np.zeros_like(vector)
    )

    benchmark = pd.to_numeric(benchmark_returns, errors="coerce").reindex(returns.index)
    benchmark_variance = float(benchmark.var(ddof=0))
    output = []
    for index, ticker in enumerate(names):
        asset = returns[ticker]
        aligned = pd.concat([asset, benchmark], axis=1).dropna()
        beta = 0.0
        if benchmark_variance > 1e-18 and len(aligned) > 1:
            beta = float(aligned.iloc[:, 0].cov(aligned.iloc[:, 1], ddof=0) / benchmark_variance)
        output.append({
            "ticker": ticker,
            "weight": float(weight_vector.iloc[index]),
            "volatility": float(asset.std(ddof=0) * np.sqrt(252.0)),
            "beta": beta,
            "risk_contribution": float(contribution[index]),
            "marginal_risk": float(covariance_times_weights[index]),
        })
    return output


def correlation_matrix(asset_returns: pd.DataFrame, lookback: int = 252) -> dict:
    correlation = asset_returns.tail(lookback).corr()
    labels = [str(column) for column in correlation.columns]
    return {
        "labels": labels,
        "matrix": [
            [None if pd.isna(value) else float(value) for value in correlation.loc[label]]
            for label in labels
        ],
    }


def historical_stress_performance(returns: pd.Series) -> list[dict]:
    scenarios = [
        ("COVID-19 selloff", "2020-02-19", "2020-03-23"),
        ("2022 rate shock", "2022-01-03", "2022-10-12"),
        ("Regional banking stress", "2023-03-08", "2023-03-24"),
    ]
    values = pd.to_numeric(returns, errors="coerce").dropna()
    values.index = pd.to_datetime(values.index)
    output = []
    for name, start, end in scenarios:
        period = values.loc[start:end]
        if len(period) < 3:
            continue
        output.append({
            "name": name,
            "start_date": start,
            "end_date": end,
            "realized_return": float(np.exp(period.sum()) - 1.0),
            "observations": int(len(period)),
        })
    return output