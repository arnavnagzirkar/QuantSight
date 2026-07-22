import os

from dotenv import load_dotenv
from redis import Redis
from rq import Queue, SimpleWorker, Worker


def worker_class():
    return SimpleWorker if os.name == "nt" else Worker


def main() -> None:
    load_dotenv()
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        raise RuntimeError("REDIS_URL is not configured")

    connection = Redis.from_url(redis_url)
    queue = Queue("research", connection=connection)
    worker = worker_class()([queue], connection=connection)
    worker.work(with_scheduler=False)


if __name__ == "__main__":
    main()