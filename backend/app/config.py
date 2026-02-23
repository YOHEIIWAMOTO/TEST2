from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///storage/db/app.db"
    storage_root: str = "./storage"
    ocr_provider: str = "dummy"
    extract_provider: str = "dummy"

    model_config = {"env_file": ".env"}


settings = Settings()
