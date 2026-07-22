from rq import SimpleWorker, Worker

import worker


def test_windows_uses_simple_worker(monkeypatch):
    monkeypatch.setattr(worker.os, "name", "nt")

    assert worker.worker_class() is SimpleWorker


def test_non_windows_uses_standard_worker(monkeypatch):
    monkeypatch.setattr(worker.os, "name", "posix")

    assert worker.worker_class() is Worker