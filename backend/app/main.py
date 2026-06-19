import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.limiter import limiter
from app.core.log import request_logging_middleware, setup_logging
from app.db.session import get_db

setup_logging(settings.LOG_LEVEL)

if settings.SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        integrations=[FastApiIntegration(), SqlalchemyIntegration()],
        traces_sample_rate=0.1,
        environment=settings.ENVIRONMENT,
    )

app = FastAPI(
    title="Build Your Target Body API",
    version="1.0.0",
    docs_url="/docs" if settings.SHOW_DOCS else None,
    redoc_url="/redoc" if settings.SHOW_DOCS else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.middleware("http")(request_logging_middleware)

app.include_router(api_router)


@app.get("/health")
def health():
    db_ok = False
    try:
        db: Session = next(get_db())
        db.execute(text("SELECT 1"))
        db.close()
        db_ok = True
    except Exception:
        pass

    uploads_dir = Path("uploads")
    storage_ok = uploads_dir.exists() and os.access(uploads_dir, os.W_OK)

    return {
        "status": "ok" if db_ok else "degraded",
        "db": "ok" if db_ok else "error",
        "gemini": "configured" if settings.GEMINI_API_KEY else "not_configured",
        "storage": "ok" if storage_ok else "error",
        "environment": settings.ENVIRONMENT,
    }
