from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from Backend.src.core.config import settings
from Backend.src.api.endpoints import auth

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
