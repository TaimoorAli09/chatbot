from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration loaded only from environment variables / .env."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    gemini_api_key: str = Field(default="", validation_alias="GEMINI_API_KEY")
    model_name: str = Field(default="gemini-3.8-flash", validation_alias="MODEL_NAME")
    website_url: str = Field(
        default="http://localhost:5173", validation_alias="WEBSITE_URL"
    )
    # Keep this a string so comma-separated values in .env do not require JSON syntax.
    allowed_origins: str = Field(
        default="http://localhost:3000,http://localhost:5173", validation_alias="ALLOWED_ORIGINS"
    )
    app_api_key: str = Field(default="", validation_alias="APP_API_KEY")
    rate_limit_requests: int = Field(default=30, validation_alias="RATE_LIMIT_REQUESTS", ge=1, le=300)
    rate_limit_window_seconds: int = Field(default=60, validation_alias="RATE_LIMIT_WINDOW_SECONDS", ge=1, le=3600)
    max_message_length: int = Field(default=2000, validation_alias="MAX_MESSAGE_LENGTH", ge=100, le=10000)

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip().rstrip("/") for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
