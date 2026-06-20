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

# ─── Vector Database Configuration ───────────────────────────────────────────
vector_engine = create_engine(
    settings.VECTOR_DATABASE_URL,
    pool_pre_ping=True
)

VectorSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=vector_engine)

def get_vector_db() -> Generator[Session, None, None]:
    db = VectorSessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_vector_db():
    from sqlalchemy import text
    from Backend.src.models.chunk import DocumentChunk
    from Backend.src.db.base import Base
    
    # Ensure pgvector extension is created
    with vector_engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        conn.commit()
    
    # Synchronize the chunks table schema on pgvector database
    Base.metadata.create_all(bind=vector_engine, tables=[DocumentChunk.__table__])

