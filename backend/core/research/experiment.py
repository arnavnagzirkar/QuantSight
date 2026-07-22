# core/research/experiment.py
import numpy as np
import pandas as pd
from itertools import product
import os, json
from xgboost import XGBClassifier

from .factors import compute_alpha_factors
from .models import feature_columns, train_xgb_prob
from .lstm import (
    FeatureScaler,
    build_prediction_sequences,
    build_training_sequences,
    predict_probabilities,
    train_lstm_classifier,
)
from .walkforward import walk_forward_splits
from .backtest import backtest_prob_strategy
from .stats import _to_series, information_ratio, sharpe_ratio


def _metric_summary(backtest: dict) -> dict:
    metrics = {}
    for key, value in backtest.items():
        if isinstance(value, np.generic):
            value = value.item()
        if isinstance(value, (str, bool, int, float)) or value is None:
            metrics[key] = value
    return metrics


def run_walkforward_xgb(
    px: pd.DataFrame,
    spy: pd.Series | None = None,
    vix: pd.Series | None = None,
    sector: pd.Series | None = None,
    horizon: str = "1d",
    train_window: int = 750,
    test_window: int = 63,
    *,
    # NEW: pass XGB params straight through (tree_method='hist' + early stopping handled in models.py)
    params: dict | None = None,
    # NEW: reuse precomputed factor table if provided (saves a lot of time when running many candidates)
    df_all: pd.DataFrame | None = None,
    # NEW: optionally cap number of walk-forward folds (use most recent folds first)
    max_folds: int | None = None,
    position_rule: str = "long_short",
    cost_bps: float = 5.0,
) -> dict:
    """
    Walk-forward XGB on tabular factors. Returns metrics, equity_curve, daily_returns, predictions, feature_importance.
    Speed-ups:
      - supports passing `df_all` (precomputed factors) to avoid recomputation
      - passes `params` through to XGB (models.train_xgb_prob uses tree_method='hist' + early stopping)
      - can cap number of folds with `max_folds`
    """
    # 1) Factors/targets
    if df_all is None:
        df_all = compute_alpha_factors(px, spy=spy, vix=vix, sector=sector)

    # pick label/return columns
    y_col_map = {"1d": "y_up_1d", "5d": "y_up_5d", "20d": "y_up_20d"}
    if horizon not in y_col_map:
        raise ValueError(f"Unsupported horizon '{horizon}' (use '1d','5d','20d').")
    y_col = y_col_map[horizon]
    # A horizon controls the prediction label, while the strategy still realizes
    # one tradable daily return at a time. Using overlapping multi-day targets as
    # daily PnL materially overstates performance for 5d and 20d models.
    ret_col = "target_ret_1d"

    # features
    feats_all = feature_columns(df_all)
    feats = [c for c in feats_all if c in df_all.columns]

    if not feats:
        return {
            "metrics": {"error": "No valid numeric features found after sanitization."},
            "equity_curve": pd.Series(dtype="float"),
            "daily_returns": pd.Series(dtype="float"),
            "predictions": pd.DataFrame(columns=[f"prob_up_{horizon}"]),
            "feature_importance": [],
        }

    # 2) restrict to rows with features + label
    needed_cols = feats + [y_col]
    df = df_all[needed_cols].dropna().copy()

    if df.empty or len(df) < (train_window + test_window):
        # shrink windows if data is short
        train_window = max(250, int(len(df) * 0.6)) if len(df) else 250
        test_window = max(21, int(len(df) * 0.1)) if len(df) else 21

    # Prepare splits; optionally cap to most recent folds
    splits = list(walk_forward_splits(df, train_window, test_window, min_train=250))
    if not splits:
        return {
            "metrics": {"error": "Not enough data to run walk-forward split with current windows."},
            "equity_curve": pd.Series(dtype="float"),
            "daily_returns": pd.Series(dtype="float"),
            "predictions": pd.DataFrame(columns=[f"prob_up_{horizon}"]),
            "feature_importance": [],
        }
    if isinstance(max_folds, int) and max_folds > 0 and len(splits) > max_folds:
        splits = splits[-max_folds:]  # keep the most recent folds

    prob_all = pd.Series(index=df.index, dtype="float")

    # collect importances across folds
    imp_accum = pd.Series(0.0, index=pd.Index(feats, dtype="object"))
    imp_folds = 0

    for tr_idx, te_idx in splits:
        X_tr, y_tr = df.iloc[tr_idx][feats], df.iloc[tr_idx][y_col]

        # 80/20 internal split for early stopping
        split = max(1, int(len(X_tr) * 0.8))
        X_tr_, y_tr_ = X_tr.iloc[:split], y_tr.iloc[:split]
        X_val_, y_val_ = X_tr.iloc[split:], y_tr.iloc[split:]
        if X_val_.empty:
            X_val_, y_val_ = X_tr_, y_tr_

        # Train (fast hist tree + early stopping handled inside train_xgb_prob)
        model, _ = train_xgb_prob(X_tr_, y_tr_, X_val_, y_val_, params=params)

        # importances
        try:
            fi = getattr(model, "feature_importances_", None)
            if fi is not None and len(fi) == len(feats):
                imp_accum = imp_accum.add(pd.Series(fi, index=feats), fill_value=0.0)
                imp_folds += 1
        except Exception:
            pass

        # OOS pred on test block
        X_te = df.iloc[te_idx][feats]
        prob_all.loc[X_te.index] = model.predict_proba(X_te)[:, 1]

    # average importances
    feat_imp_out = []
    if imp_folds > 0:
        imp_avg = (imp_accum / float(imp_folds)).replace([np.inf, -np.inf], np.nan).fillna(0.0)
        imp_avg = imp_avg.sort_values(ascending=False)
        feat_imp_out = [{"feature": k, "importance": float(v)} for k, v in imp_avg.items()]

    # attach predictions to full index
    df_all[f"prob_up_{horizon}"] = prob_all.reindex(df_all.index)

    if ret_col not in df_all.columns:
        return {
            "metrics": {"error": f"Missing required column '{ret_col}' after factor computation."},
            "equity_curve": pd.Series(dtype="float"),
            "daily_returns": pd.Series(dtype="float"),
            "predictions": df_all[[f"prob_up_{horizon}"]].dropna().tail(500),
            "feature_importance": feat_imp_out,
        }

    # backtest on rows where we have both pred & return
    df_bt = df_all.dropna(subset=[f"prob_up_{horizon}", ret_col]).copy()
    if df_bt.empty:
        return {
            "metrics": {"error": "No overlapping rows between predictions and return target after NaN filtering."},
            "equity_curve": pd.Series(dtype="float"),
            "daily_returns": pd.Series(dtype="float"),
            "predictions": df_all[[f"prob_up_{horizon}"]].dropna().tail(500),
            "feature_importance": feat_imp_out,
        }

    bt = backtest_prob_strategy(
        df_bt,
        prob_col=f"prob_up_{horizon}",
        ret_col=ret_col,
        threshold=0.5,
        max_leverage=1.0,
        cost_bps=cost_bps,
        position_rule=position_rule,
    )

    return dict(
        metrics=_metric_summary(bt),
        equity_curve=bt["equity_curve"],
        daily_returns=bt["series"],
        predictions=df_all[[f"prob_up_{horizon}"]],
        feature_importance=feat_imp_out,
        positions=bt["positions"],
        gross_returns=bt["gross_returns"],
        turnover_series=bt["turnover_series"],
        transaction_costs=bt["transaction_costs"],
    )


def run_walkforward_lstm(
    px: pd.DataFrame,
    spy: pd.Series | None = None,
    vix: pd.Series | None = None,
    sector: pd.Series | None = None,
    horizon: str = "1d",
    train_window: int = 750,
    test_window: int = 63,
    *,
    params: dict | None = None,
    df_all: pd.DataFrame | None = None,
    max_folds: int | None = None,
    position_rule: str = "long_short",
    cost_bps: float = 5.0,
) -> dict:
    if df_all is None:
        df_all = compute_alpha_factors(px, spy=spy, vix=vix, sector=sector)
    else:
        df_all = df_all.copy()

    y_col_map = {"1d": "y_up_1d", "5d": "y_up_5d", "20d": "y_up_20d"}
    if horizon not in y_col_map:
        raise ValueError(f"Unsupported horizon '{horizon}' (use '1d','5d','20d').")
    y_col = y_col_map[horizon]
    return_col = "target_ret_1d"
    features = [column for column in feature_columns(df_all) if column in df_all.columns]
    prediction_col = f"prob_up_{horizon}"
    if not features:
        return {
            "metrics": {"error": "No valid numeric features found after sanitization."},
            "equity_curve": pd.Series(dtype="float"),
            "daily_returns": pd.Series(dtype="float"),
            "predictions": pd.DataFrame(columns=[prediction_col]),
            "feature_importance": [],
            "fold_metrics": [],
        }

    data = df_all[features + [y_col]].dropna().copy()
    if data.empty or len(data) < train_window + test_window:
        train_window = max(250, int(len(data) * 0.6)) if len(data) else 250
        test_window = max(21, int(len(data) * 0.1)) if len(data) else 21
    splits = list(walk_forward_splits(data, train_window, test_window, min_train=250))
    if isinstance(max_folds, int) and max_folds > 0:
        splits = splits[-max_folds:]
    if not splits:
        return {
            "metrics": {"error": "Not enough data to run walk-forward split with current windows."},
            "equity_curve": pd.Series(dtype="float"),
            "daily_returns": pd.Series(dtype="float"),
            "predictions": pd.DataFrame(columns=[prediction_col]),
            "feature_importance": [],
            "fold_metrics": [],
        }

    configuration = dict(params or {})
    sequence_length = int(configuration.pop("sequence_length", 20))
    if sequence_length < 2 or sequence_length > 252:
        raise ValueError("sequence_length must be between 2 and 252")
    allowed_parameters = {
        "hidden_size",
        "num_layers",
        "dropout",
        "learning_rate",
        "batch_size",
        "max_epochs",
        "patience",
        "seed",
    }
    unknown_parameters = set(configuration) - allowed_parameters
    if unknown_parameters:
        raise ValueError(f"Unsupported LSTM parameters: {sorted(unknown_parameters)}")

    probabilities = pd.Series(index=data.index, dtype="float")
    fold_metrics = []
    for fold_number, (training_indices, test_indices) in enumerate(splits, start=1):
        training = data.iloc[training_indices]
        test = data.iloc[test_indices]
        validation_start = max(sequence_length, int(len(training) * 0.8))
        if validation_start >= len(training):
            validation_start = len(training) - 1
        inner_training = training.iloc[:validation_start]
        validation = training.iloc[validation_start:]
        if len(inner_training) < sequence_length or validation.empty:
            raise ValueError("Training window is too short for the requested LSTM sequence")

        scaler = FeatureScaler.fit(inner_training[features].to_numpy())
        inner_values = scaler.transform(inner_training[features].to_numpy())
        validation_values = scaler.transform(validation[features].to_numpy())
        training_sequences, training_labels = build_training_sequences(
            inner_values,
            inner_training[y_col].to_numpy(),
            sequence_length,
        )
        validation_sequences = build_prediction_sequences(
            inner_values,
            validation_values,
            sequence_length,
        )
        trained = train_lstm_classifier(
            training_sequences=training_sequences,
            training_labels=training_labels,
            validation_sequences=validation_sequences,
            validation_labels=validation[y_col].to_numpy(dtype=np.float32),
            **configuration,
        )

        history_values = scaler.transform(training[features].to_numpy())
        test_values = scaler.transform(test[features].to_numpy())
        test_sequences = build_prediction_sequences(
            history_values,
            test_values,
            sequence_length,
        )
        probabilities.loc[test.index] = predict_probabilities(trained.model, test_sequences)
        fold_metrics.append({
            "fold": fold_number,
            "test_rows": len(test),
            "epochs_trained": trained.epochs_trained,
            "validation_loss": trained.validation_loss,
        })

    df_all[prediction_col] = probabilities.reindex(df_all.index)
    if return_col not in df_all.columns:
        return {
            "metrics": {"error": f"Missing required column '{return_col}' after factor computation."},
            "equity_curve": pd.Series(dtype="float"),
            "daily_returns": pd.Series(dtype="float"),
            "predictions": df_all[[prediction_col]],
            "feature_importance": [],
            "fold_metrics": fold_metrics,
        }

    backtest_data = df_all.dropna(subset=[prediction_col, return_col]).copy()
    backtest = backtest_prob_strategy(
        backtest_data,
        prob_col=prediction_col,
        ret_col=return_col,
        threshold=0.5,
        max_leverage=1.0,
        cost_bps=cost_bps,
        position_rule=position_rule,
    )
    return {
        "metrics": _metric_summary(backtest),
        "equity_curve": backtest["equity_curve"],
        "daily_returns": backtest["series"],
        "predictions": df_all[[prediction_col]],
        "feature_importance": [],
        "fold_metrics": fold_metrics,
        "positions": backtest["positions"],
        "gross_returns": backtest["gross_returns"],
        "turnover_series": backtest["turnover_series"],
        "transaction_costs": backtest["transaction_costs"],
    }


def run_walkforward_ensemble(
    px: pd.DataFrame,
    spy: pd.Series | None = None,
    vix: pd.Series | None = None,
    sector: pd.Series | None = None,
    horizon: str = "1d",
    train_window: int = 750,
    test_window: int = 63,
    *,
    weights: dict[str, float] | None = None,
    xgb_params: dict | None = None,
    lstm_params: dict | None = None,
    df_all: pd.DataFrame | None = None,
    max_folds: int | None = None,
    position_rule: str = "long_short",
    cost_bps: float = 5.0,
) -> dict:
    component_weights = weights or {"xgb": 0.5, "lstm": 0.5}
    if set(component_weights) != {"xgb", "lstm"}:
        raise ValueError("Ensemble weights must define xgb and lstm")
    if any(value < 0 for value in component_weights.values()) or not np.isclose(
        sum(component_weights.values()),
        1.0,
    ):
        raise ValueError("Ensemble weights must be nonnegative and sum to 1")

    if df_all is None:
        df_all = compute_alpha_factors(px, spy=spy, vix=vix, sector=sector)
    prediction_col = f"prob_up_{horizon}"
    common_arguments = {
        "px": px,
        "spy": spy,
        "vix": vix,
        "sector": sector,
        "horizon": horizon,
        "train_window": train_window,
        "test_window": test_window,
        "max_folds": max_folds,
        "position_rule": position_rule,
        "cost_bps": cost_bps,
    }
    xgb_result = run_walkforward_xgb(
        **common_arguments,
        params=xgb_params,
        df_all=df_all.copy(),
    )
    lstm_result = run_walkforward_lstm(
        **common_arguments,
        params=lstm_params,
        df_all=df_all.copy(),
    )

    xgb_probabilities = xgb_result.get("predictions", pd.DataFrame()).get(prediction_col)
    lstm_probabilities = lstm_result.get("predictions", pd.DataFrame()).get(prediction_col)
    if xgb_probabilities is None or lstm_probabilities is None:
        raise ValueError("Both component models must produce probabilities")
    aligned = pd.concat(
        [
            xgb_probabilities.rename(f"xgb_{prediction_col}"),
            lstm_probabilities.rename(f"lstm_{prediction_col}"),
        ],
        axis=1,
        join="inner",
    ).dropna()
    aligned[prediction_col] = (
        component_weights["xgb"] * aligned[f"xgb_{prediction_col}"]
        + component_weights["lstm"] * aligned[f"lstm_{prediction_col}"]
    )

    return_col = "target_ret_1d"
    backtest_data = df_all[[return_col]].join(aligned[[prediction_col]], how="inner").dropna()
    backtest = backtest_prob_strategy(
        backtest_data,
        prob_col=prediction_col,
        ret_col=return_col,
        threshold=0.5,
        max_leverage=1.0,
        cost_bps=cost_bps,
        position_rule=position_rule,
    )
    return {
        "metrics": _metric_summary(backtest),
        "equity_curve": backtest["equity_curve"],
        "daily_returns": backtest["series"],
        "predictions": aligned,
        "feature_importance": xgb_result.get("feature_importance", []),
        "component_metrics": {
            "xgb": xgb_result.get("metrics", {}),
            "lstm": lstm_result.get("metrics", {}),
        },
        "weights": component_weights,
        "positions": backtest["positions"],
        "gross_returns": backtest["gross_returns"],
        "turnover_series": backtest["turnover_series"],
        "transaction_costs": backtest["transaction_costs"],
    }


# ===== Walk-forward XGB sweep =====

def _param_grid_iter(grid: dict[str, list]) -> list[dict]:
    if not grid:
        return [dict()]
    keys = list(grid.keys())
    vals = [grid[k] for k in keys]
    combos = []
    for tup in product(*vals):
        combos.append({k: v for k, v in zip(keys, tup)})
    return combos


def run_walkforward_xgb_sweep(
    px: pd.DataFrame,
    spy: pd.Series | None,
    vix: pd.Series | None,
    sector: pd.Series | None,
    horizon: str = "1d",
    train_window: int = 750,
    test_window: int = 63,
    param_grid: dict | None = None,
    *,
    # limit number of folds per candidate to speed up iteration (e.g., 4 most recent)
    max_folds: int | None = None,
) -> dict:
    """
    Returns:
      {
        'best_params': {...},
        'summary': [ {'params': {...}, 'sharpe': float, 'ir': float}, ... ] (sorted by sharpe desc),
        'equity_curve': pd.Series (best),
        'daily_returns': pd.Series (best),
        'predictions': pd.DataFrame (best)
      }
    """
    if param_grid is None:
        param_grid = {
            "n_estimators": [300, 500],
            "max_depth": [3, 5],
            "learning_rate": [0.03, 0.07],
            "subsample": [0.8, 1.0],
            "colsample_bytree": [0.8, 1.0],
            "reg_lambda": [1.0, 3.0],
        }

    # compute factors ONCE and reuse for all candidates
    df_all = compute_alpha_factors(px, spy=spy, vix=vix, sector=sector)

    cand_params = _param_grid_iter(param_grid)
    results: list[dict] = []

    best = None
    best_metrics = {"sharpe": -np.inf, "ir": -np.inf}

    for params in cand_params:
        out = run_walkforward_xgb(
            px=px, spy=spy, vix=vix, sector=sector,
            horizon=horizon, train_window=train_window, test_window=test_window,
            params=params, df_all=df_all, max_folds=max_folds
        )
        daily = out.get("daily_returns", pd.Series(dtype="float"))
        if not isinstance(daily, pd.Series) or daily.empty:
            results.append({"params": params, "sharpe": float("nan"), "ir": float("nan")})
            continue

        # Align with SPY for IR
        spy_lr = None
        if spy is not None:
            # Make sure spy is a 1D Series and aligned to our dates
            spy_s = _to_series(spy)         # squeezes single-col DataFrames -> Series
            spy_s = spy_s.reindex(daily.index).ffill()
            spy_lr = np.log(spy_s).diff().dropna()

        # Match indices before stats
        strat = daily.reindex(spy_lr.index) if spy_lr is not None else daily

        sh = sharpe_ratio(strat.dropna())
        ir = information_ratio(strat.dropna(), spy_lr) if spy_lr is not None else float("nan")

        results.append({"params": params, "sharpe": float(sh), "ir": float(ir)})

        # Track best by Sharpe
        if np.isfinite(sh) and sh > best_metrics["sharpe"]:
            best_metrics = {"sharpe": float(sh), "ir": float(ir)}
            best = {
                "params": params,
                "equity_curve": out.get("equity_curve", pd.Series(dtype="float")),
                "daily_returns": out.get("daily_returns", pd.Series(dtype="float")),
                "predictions": out.get("predictions", pd.DataFrame()),
            }
            
    results_sorted = sorted(
        results,
        key=lambda r: (-(r["sharpe"] if np.isfinite(r["sharpe"]) else -1e9))
    )

    if best is None:
        return {
            "best_params": {},
            "summary": results_sorted,
            "equity_curve": pd.Series(dtype="float"),
            "daily_returns": pd.Series(dtype="float"),
            "predictions": pd.DataFrame(),
        }

    return {
        "best_params": best["params"],
        "summary": results_sorted,
        "equity_curve": best["equity_curve"],
        "daily_returns": best["daily_returns"],
        "predictions": best["predictions"],
    }

def persist_final_xgb_model(
    df_all: pd.DataFrame,
    horizon: str,
    feats: list[str],
    params: dict,
    model_dir: str = "models",
    train_window: int = 750,
    storage_user_id: str | None = None,
) -> dict:
    """
    Fit a final XGB on the most recent `train_window` rows and save it.
    Returns {"model_path": str, "meta_path": str}.
    """
    os.makedirs(model_dir, exist_ok=True)

    y_col_map = {"1d": "y_up_1d", "5d": "y_up_5d", "20d": "y_up_20d"}
    if horizon not in y_col_map:
        raise ValueError(f"Unsupported horizon '{horizon}'")
    y_col = y_col_map[horizon]

    df = df_all[feats + [y_col]].dropna()
    if df.empty:
        raise ValueError("No data after NaN filtering for final fit.")

    # last train_window rows
    if len(df) > train_window:
        df = df.iloc[-train_window:]

    X = df[feats]
    y = df[y_col]

    # 80/20 holdout to keep early stopping behavior consistent
    split = max(1, int(len(X) * 0.8))
    X_tr, y_tr = X.iloc[:split], y.iloc[:split]
    X_val, y_val = X.iloc[split:], y.iloc[split:]
    if X_val.empty:
        X_val, y_val = X_tr, y_tr

    # ensure default eval metric & objective if caller omitted
    fit_params = dict(
        objective="binary:logistic",
        eval_metric="auc",
        n_jobs=-1,
        **(params or {})
    )
    # Prefer fast histogram tree method when available
    fit_params.setdefault("tree_method", "hist")

    clf = XGBClassifier(**fit_params)
    clf.fit(X_tr, y_tr, eval_set=[(X_val, y_val)], verbose=False)

    # Save model + metadata sidecar
    ts = df.index[-1].strftime("%Y%m%d")
    model_basename = f"xgb_{horizon}_{ts}"
    model_path = os.path.join(model_dir, model_basename + ".json")
    meta_path = os.path.join(model_dir, model_basename + ".meta.json")

    clf.save_model(model_path)
    meta = {
        "horizon": horizon,
        "end_date": str(df.index[-1].date()),
        "rows": int(len(df)),
        "features": feats,
        "params": fit_params,
    }
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)

    paths = {"model_path": model_path, "meta_path": meta_path}
    if storage_user_id:
        from ..database import get_admin_client

        storage = get_admin_client().storage.from_("models")
        storage_prefix = f"{storage_user_id}/legacy-xgb"
        storage_model_path = f"{storage_prefix}/{os.path.basename(model_path)}"
        storage_meta_path = f"{storage_prefix}/{os.path.basename(meta_path)}"
        with open(model_path, "rb") as model_file:
            storage.upload(
                storage_model_path,
                model_file.read(),
                {"content-type": "application/json", "upsert": "true"},
            )
        with open(meta_path, "rb") as meta_file:
            storage.upload(
                storage_meta_path,
                meta_file.read(),
                {"content-type": "application/json", "upsert": "true"},
            )
        paths.update({
            "storage_model_path": storage_model_path,
            "storage_meta_path": storage_meta_path,
        })

    return paths
