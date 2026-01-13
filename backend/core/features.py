import numpy as np, pandas as pd

def ta_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["ret1"] = np.log(df["Close"]).diff()
    df["vol20"] = df["ret1"].rolling(20).std()
    df["mom20"] = df["Close"].pct_change(20)
    # RSI(14)
    delta = df["Close"].diff()
    up, down = delta.clip(lower=0), -delta.clip(upper=0)
    rs = up.rolling(14).mean() / (down.rolling(14).mean() + 1e-9)
    df["rsi14"] = 100 - (100 / (1 + rs))
    # Bollinger width
    ma20 = df["Close"].rolling(20).mean()
    sd20 = df["Close"].rolling(20).std()
    df["bb_width"] = (2*sd20) / ma20
    return df

def daily_sentiment_feats(news_df: pd.DataFrame) -> pd.DataFrame:
    # news_df: columns ["date","sentiment"] with +/-1 or prob in [-1,1]
    g = news_df.groupby("date")["sentiment"]
    out = pd.DataFrame({
        "news_mean": g.mean(),
        "news_n": g.size(),
        "news_pos_share": (g.apply(lambda x: (x>0).mean()))
    })
    out["news_surprise20"] = out["news_mean"] - out["news_mean"].rolling(20).mean()
    return out

def make_dataset(price_df: pd.DataFrame, sent_df: pd.DataFrame) -> pd.DataFrame:
    X = ta_features(price_df)
    S = daily_sentiment_feats(sent_df) if sent_df is not None else None
    if S is not None:
        X = X.join(S, how="left")
    X["target_up"] = (X["Close"].shift(-1) > X["Close"]).astype(int)
    X = X.dropna()
    return X
