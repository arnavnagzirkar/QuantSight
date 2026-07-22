from pathlib import Path

import pandas as pd

from core import database
from core.research import experiment


def test_final_xgb_model_mirrors_files_to_private_storage(monkeypatch, tmp_path):
    uploads = {}

    class FakeClassifier:
        def __init__(self, **params):
            self.params = params

        def fit(self, *args, **kwargs):
            return self

        def save_model(self, path):
            Path(path).write_text('{"model":"saved"}', encoding="utf-8")

    class FakeBucket:
        def upload(self, path, content, options):
            uploads[path] = {"content": content, "options": options}

    class FakeStorage:
        def from_(self, bucket):
            assert bucket == "models"
            return FakeBucket()

    class FakeClient:
        storage = FakeStorage()

    monkeypatch.setattr(experiment, "XGBClassifier", FakeClassifier)
    monkeypatch.setattr(database, "get_admin_client", lambda: FakeClient())
    frame = pd.DataFrame(
        {
            "feature": [0.1, 0.2, 0.3, 0.4],
            "y_up_1d": [0.0, 1.0, 0.0, 1.0],
        },
        index=pd.date_range("2024-01-01", periods=4, freq="B"),
    )

    paths = experiment.persist_final_xgb_model(
        df_all=frame,
        horizon="1d",
        feats=["feature"],
        params={"n_estimators": 2},
        model_dir=str(tmp_path),
        train_window=4,
        storage_user_id="user-id",
    )

    assert Path(paths["model_path"]).exists()
    assert Path(paths["meta_path"]).exists()
    assert paths["storage_model_path"] in uploads
    assert paths["storage_meta_path"] in uploads
    assert uploads[paths["storage_model_path"]]["content"]
    assert uploads[paths["storage_meta_path"]]["content"]