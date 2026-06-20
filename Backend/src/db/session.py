from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from Backend.src.core.config import settings
from typing import Generator

engine = create_engine(
    settings.DATABASE_URL,
    # pool_pre_ping helps handle database restarts / dropped connections
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
