# core/research/models.py
import numpy as np
import pandas as pd
from typing import List, Dict, Any
from sklearn.metrics import roc_auc_score
from xgboost import XGBClassifier
from pandas.api.types import is_numeric_dtype

# Only include true numeric, 1-D features that exist in df
def feature_columns(df: pd.DataFrame) -> List[str]:
    drop_cols = {
        "Open","High","Low","Close","Adj Close","Volume",
        "target_ret_1d","target_ret_3d","target_ret_5d","target_ret_10d","target_ret_20d",
        "y_up_1d","y_up_5d","y_up_20d","log_ret_1d","rng","vwap_proxy"
    }
    feats: List[str] = []
    for c in df.columns:
        if c in drop_cols:
            continue
        # ensure string-ish label
        if not isinstance(c, str):
            try:
                c = str(c)
            except Exception:
                continue
        # ensure column is 1-D, numeric
        s = df[c]
        if getattr(s, "ndim", 1) != 1:
            continue
        if not is_numeric_dtype(s):
            continue
        feats.append(c)
    return feats

def train_xgb_prob(
    X_train: pd.DataFrame, y_train: pd.Series,
    X_valid: pd.DataFrame, y_valid: pd.Series,
    params: Dict[str, Any] | None = None
) -> tuple[XGBClassifier, float]:
    if params is None:
        params = dict(
            n_estimators=400,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.9,
            colsample_bytree=0.9,
            reg_lambda=1.0,
            objective="binary:logistic",
            eval_metric="auc",
            n_jobs=-1,
        )
    clf = XGBClassifier(**params)
    clf.fit(X_train, y_train, eval_set=[(X_valid, y_valid)], verbose=False)
    prob = clf.predict_proba(X_valid)[:, 1]
    auc = roc_auc_score(y_valid, prob)
    return clf, auc
