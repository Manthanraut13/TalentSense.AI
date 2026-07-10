from functools import cached_property

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    allowed_origins: str = "http://localhost:5173"
    groq_api_key: str | None = None
    groq_model: str = "llama-3.3-70b-versatile"
    groq_temperature: float = 0.3
    groq_max_tokens: int = 2048
    qdrant_url: str | None = None
    qdrant_api_key: str | None = None
    qdrant_collection: str = "resume_analyses"
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    embedding_dimensions: int = 384
    mongodb_uri: str | None = None
    mongodb_database: str = "resume_analyzer"
    mongodb_collection: str = "analyses"

    @cached_property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


settings = Settings()
