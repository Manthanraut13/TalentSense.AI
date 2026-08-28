from functools import cached_property

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    allowed_origins: str = "http://localhost:5173"
    groq_api_key: str | None = None
    groq_model: str = "openai/gpt-oss-120b"
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
    # Privacy: store resume snippet (first 500 chars) in MongoDB. Default false for privacy.
    store_resume_snippet: bool = False
    # Rate limiting (10 analyses/day — window is one day)
    rate_limit_requests: int = 10
    rate_limit_window_seconds: int = 86400
    # Slow query logging: log MongoDB queries slower than this (ms)
    slow_query_threshold_ms: int = 100
    # Clerk auth
    clerk_secret_key: str | None = None
    clerk_publishable_key: str | None = None
    # Resend email service
    resend_api_key: str = ""
    from_email: str = "noreply@resumeanalyzer.app"
    app_url: str = "https://your-app.vercel.app"
    # Test mode (bypasses auth for local testing)
    test_mode: bool = False
    # Sentry
    sentry_dsn: str = ""
    # Tavily web search (learning roadmap resource discovery)
    tavily_api_key: str = ""
    # HuggingFace token for private fine-tuned embedding model (Phase 24)
    hf_token: str = ""


    @cached_property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    @cached_property
    def environment(self) -> str:
        return self.app_env


settings = Settings()
