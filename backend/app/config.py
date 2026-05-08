from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Geo Tagging API"
    app_version: str = "1.0.0"
    debug: bool = False

    database_url: str = "mysql+pymysql://minhlvn:MinhMYSQLlvn0112@127.0.0.1:3306/geotagging?charset=utf8mb4"
    upload_dir: str = "uploads"
    public_base_url: str = "http://localhost:8000"

    # Pipeline flags mapped from notebook concept
    use_retrieval: bool = True
    enable_real_models: bool = False
    inference_backend: str = "modal"
    model_device: str = "auto"

    # Standalone modal inference server (run separately before this API).
    modal_infer_url: str | None = None
    modal_health_url: str | None = None
    modal_api_key: str | None = None
    modal_timeout_seconds: float = 120.0

    openai_api_key: str | None = None
    openai_model: str = "gpt-4o"
    openai_timeout_seconds: float = 90.0

    resend_api_key: str | None = None
    resend_from_email: str = "Geo Tagging <onboarding@resend.dev>"

    # Optional model + vector DB configs
    qdrant_url: str | None = "http://localhost:6333"
    qdrant_api_key: str | None = None
    qdrant_collection: str = "mp16_geo_multistage"

    hf_token: str | None = None
    model_id: str = "Qwen/Qwen2-VL-7B-Instruct"
    adapter_path: str = "leevox/stage2GRE"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


settings = Settings()


def ensure_runtime_dirs() -> None:
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    if settings.database_url.startswith("sqlite:///"):
        db_path = Path(settings.database_url.replace("sqlite:///", "", 1))
        if db_path.parent:
            db_path.parent.mkdir(parents=True, exist_ok=True)
