import numpy as np
import pandas as pd
from typing import Iterator, Tuple

def walk_forward_splits(
    df: pd.DataFrame,
    train_window: int,
    test_window: int,
    min_train: int | None = None,
) -> Iterator[Tuple[np.ndarray, np.ndarray]]:
    n = len(df)
    start = 0
    while True:
        end_train = start + train_window
        end_test  = end_train + test_window
        if end_test > n:
            break
        train_idx = np.arange(start, end_train)
        if min_train is not None and len(train_idx) < min_train:
            start += test_window
            continue
        test_idx  = np.arange(end_train, end_test)
        yield (train_idx, test_idx)
        start += test_window
