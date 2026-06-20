from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
import os
from Backend.src.core.config import settings
from Backend.src.api.endpoints import auth, document
from Backend.src.db.session import get_db

# Ensure uploads directory is created at startup
os.makedirs(os.path.join("Backend", "uploads"), exist_ok=True)

# Initialize pgvector database and chunks schema
from Backend.src.db.session import init_vector_db
try:
    init_vector_db()
except Exception as e:
    import logging
    logging.getLogger("uvicorn.error").error(f"Failed to initialize vector DB: {e}")

app = FastAPI(title=settings.PROJECT_NAME)

# Setup CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(document.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to the Insurance Agentic AI API"}

@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    """Health check endpoint to verify API and database connectivity."""
    db_status = "healthy"
    try:
        # Run a simple query to verify database connection
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"
        
    return {
        "status": "healthy" if db_status == "healthy" else "unhealthy",
        "database": db_status,
        "api": "healthy"
    }

