from pydantic import BaseModel, EmailStr, Field
from datetime import datetime

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)
    role: str = "user"

class UserLogin(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=100)

class UserOut(BaseModel):
    id: str
    username: str
    email: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True

class SessionResponse(BaseModel):
    session_token: str
    expires_at: datetime
    user: UserOut

    class Config:
        from_attributes = True

class GoogleLoginRequest(BaseModel):
    code: str
    redirect_uri: str


class AccessRequestOut(BaseModel):
    id: str
    user_id: str
    status: str
    created_at: datetime
    username: str | None = None
    email: str | None = None

    class Config:
        from_attributes = True


