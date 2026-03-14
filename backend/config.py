import os
from dataclasses import dataclass, field
from dotenv import load_dotenv

load_dotenv()


def _split_origins(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass
class Settings:
    env: str = os.getenv("ENV", "development")
    app_name: str = os.getenv("APP_NAME", "RiskNova Backend")
    app_version: str = os.getenv("APP_VERSION", "v1")
    supabase_url: str = os.getenv("SUPABASE_URL", "")
    supabase_service_role_key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    frontend_origins: list[str] = field(default_factory=list)

    def __post_init__(self):
        raw_origins = os.getenv(
            "FRONTEND_ORIGINS",
            "http://localhost:3000,https://guvenligimcepte.vercel.app"
        )
        self.frontend_origins = _split_origins(raw_origins)


settings = Settings()