from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = "sqlite:///./attendance.db"
    secret_key: str = "dev-secret-change-me"
    access_token_expire_minutes: int = 129600
    cors_origins: str = "http://localhost:5173,http://localhost:8080"
    sms_provider: str = "console"
    sms_api_key: str = ""
    sms_sender: str = ""
    sms_ir_parent_template_id: str = ""
    sms_ir_teacher_template_id: str = ""
    platform_admin_phone: str = "09120000000"
    platform_admin_password: str = "ChangeMe-Admin-123!"
    trial_days: int = 7
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_list(self) -> list[str]:
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]

@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
