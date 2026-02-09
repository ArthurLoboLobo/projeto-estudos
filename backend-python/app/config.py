from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    JWT_SECRET: str
    OPENROUTER_API_KEY: str
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    PORT: int = 8080
    ALLOWED_ORIGINS: str = "http://localhost:5173"

    # AI Models (all via OpenRouter — change any to swap providers)
    MODEL_VISION: str = "google/gemini-2.5-flash"
    MODEL_PLAN: str = "google/gemini-2.5-flash"
    MODEL_CHUNKING: str = "google/gemini-2.5-flash"
    MODEL_CHAT: str = "google/gemini-2.5-flash"
    MODEL_SUMMARY: str = "google/gemini-2.5-flash"
    MODEL_EMBEDDING: str = "google/gemini-embedding-001"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    model_config = {"env_file": ".env"}


settings = Settings()
