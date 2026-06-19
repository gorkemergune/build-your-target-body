import json

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    GEMINI_API_KEY: str = ""

    # Accept both JSON-array (legacy) and comma-separated formats
    CORS_ORIGINS: str = "http://localhost:3000"

    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    SHOW_DOCS: bool = True

    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10

    SENTRY_DSN: str = ""
    ADMIN_SECRET: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        v = self.CORS_ORIGINS.strip()
        if v.startswith("["):
            return json.loads(v)
        return [o.strip() for o in v.split(",") if o.strip()]


settings = Settings()
