import pickle, numpy as np, pandas as pd
from xgboost import XGBClassifier
from sklearn.metrics import roc_auc_score

FEATS = ["ret1","vol20","mom20","rsi14","bb_width",
         "news_mean","news_n","news_pos_share","news_surprise20"]

def walkforward_train(df: pd.DataFrame, start_train=252, step=20):
    # simple rolling AUC report
    scores = []
    for end in range(start_train, len(df)-step, step):
        train = df.iloc[:end]
        test  = df.iloc[end:end+step]
        Xtr, ytr = train[FEATS].fillna(0), train["target_up"]
        Xte, yte = test[FEATS].fillna(0), test["target_up"]
        model = XGBClassifier(
            n_estimators=300, max_depth=4, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8, random_state=42
        )
        model.fit(Xtr, ytr)
        p = model.predict_proba(Xte)[:,1]
        scores.append(roc_auc_score(yte, p))
    return float(np.mean(scores))

# optional alias if you prefer the older name
walkforward_auc = walkforward_train

def fit_final(df: pd.DataFrame, model_path="model_xgb.pkl"):
    model = XGBClassifier(n_estimators=500, max_depth=4, learning_rate=0.05,
                          subsample=0.9, colsample_bytree=0.9, random_state=42)
    model.fit(df[FEATS].fillna(0), df["target_up"])
    with open(model_path,"wb") as f:
        pickle.dump(model,f)
    return model_path

def load_model(model_path="model_xgb.pkl"):
    with open(model_path,"rb") as f:
        return pickle.load(f)  # <-- fixed typo
