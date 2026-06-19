import json
import logging
import time
from typing import Callable

from fastapi import Request, Response

_logger = logging.getLogger("app.access")


class _JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        obj = {
            "ts": self.formatTime(record),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info:
            obj["exc"] = self.formatException(record.exc_info)
        return json.dumps(obj, ensure_ascii=False, default=str)


def setup_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(_JSONFormatter())
    root = logging.getLogger()
    root.setLevel(getattr(logging, level.upper(), logging.INFO))
    root.handlers = [handler]
    # Suppress uvicorn's default access log — our middleware covers it
    logging.getLogger("uvicorn.access").propagate = False


async def request_logging_middleware(request: Request, call_next: Callable) -> Response:
    t0 = time.perf_counter()
    response = await call_next(request)
    ms = round((time.perf_counter() - t0) * 1000)
    if request.url.path != "/health":
        _logger.info("%s %s → %d (%dms)", request.method, request.url.path, response.status_code, ms)
    return response
