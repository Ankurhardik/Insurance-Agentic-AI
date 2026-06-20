import os
import json
from dotenv import load_dotenv

# Load env variables from root directory .env
load_dotenv(os.path.join(os.path.dirname(__file__), "../../../.env"))

class Settings:
    PROJECT_NAME: str = "Insurance Agentic AI"
    
    # Databases
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql://postgres:postgres123@localhost:5432/insurance_main"
    )
    # If the URL starts with postgres://, replace it with postgresql+psycopg://
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
    elif DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
        
    VECTOR_DATABASE_URL: str = os.getenv(
        "VECTOR_DATABASE_URL",
        "postgresql://postgres:postgres123@localhost:5433/insurance_vector"
    )
    if VECTOR_DATABASE_URL.startswith("postgres://"):
        VECTOR_DATABASE_URL = VECTOR_DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
    elif VECTOR_DATABASE_URL.startswith("postgresql://"):
        VECTOR_DATABASE_URL = VECTOR_DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

    # JWT Authentication
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "super-secret-jwt-key-change-me-in-production")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")) # 24 hours

    # CORS
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:3000",  # Next.js local development
        "http://127.0.0.1:3000",
    ]

    # Google OAuth
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")

settings = Settings()

# Fallback to load Google OAuth credentials from Auth.json if not present in env
if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
    auth_json_path = os.path.join(os.path.dirname(__file__), "../../../Auth.json")
    if os.path.exists(auth_json_path):
        try:
            with open(auth_json_path, "r") as f:
                auth_data = json.load(f)
                web_config = auth_data.get("web", {})
                if not settings.GOOGLE_CLIENT_ID:
                    settings.GOOGLE_CLIENT_ID = web_config.get("client_id", "")
                if not settings.GOOGLE_CLIENT_SECRET:
                    settings.GOOGLE_CLIENT_SECRET = web_config.get("client_secret", "")
        except Exception as e:
            # Silent fallback / log error in a real system
            pass

