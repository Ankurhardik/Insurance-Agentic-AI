from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from Backend.src.core.config import settings
from Backend.src.api.endpoints import auth
from Backend.src.db.session import get_db

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

