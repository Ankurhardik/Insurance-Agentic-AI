from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime, timedelta
import uuid

from Backend.src.db.session import get_db
import httpx
from Backend.src.models.user import User, UserSession, AccessRequest
from Backend.src.schemas.user import UserCreate, UserLogin, UserOut, SessionResponse, GoogleLoginRequest, AccessRequestOut
from Backend.src.core.security import hash_password, verify_password
from Backend.src.core.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db)
) -> User:
    """Validate session token and return current user."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid session token",
        )
    
    token = authorization.split(" ")[1]
    
    # Query database for active, unexpired session
    stmt = select(UserSession).where(
        UserSession.token == token,
        UserSession.is_active == True,
        UserSession.expires_at > datetime.utcnow()
    )
    result = db.execute(stmt)
    session_record = result.scalar_one_or_none()
    
    if not session_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired or is invalid",
        )
        
    return session_record.user


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    """Create a new user account."""
    # Check if username already exists
    stmt_username = select(User).where(User.username == user_in.username)
    if db.execute(stmt_username).scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is already taken"
        )
        
    # Check if email already exists
    stmt_email = select(User).where(User.email == user_in.email)
    if db.execute(stmt_email).scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered"
        )
        
    # Create new user
    new_user = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        role=user_in.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.post("/login", response_model=SessionResponse)
def login(login_in: UserLogin, db: Session = Depends(get_db)):
    """Authenticate credentials and establish user session."""
    # Find user by username
    stmt = select(User).where(User.username == login_in.username)
    user = db.execute(stmt).scalar_one_or_none()
    
    if not user or not verify_password(login_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
        
    # Create a database user session
    expires_at = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    session_record = UserSession(
        user_id=user.id,
        token=str(uuid.uuid4()),
        expires_at=expires_at,
        is_active=True
    )
    db.add(session_record)
    db.commit()
    db.refresh(session_record)
    
    return {
        "session_token": session_record.token,
        "expires_at": session_record.expires_at,
        "user": user
    }


@router.post("/logout")
def logout(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db)
):
    """Invalidate current user session."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid authorization format"
        )
        
    token = authorization.split(" ")[1]
    
    # Invalidate session in DB
    stmt = select(UserSession).where(UserSession.token == token)
    session_record = db.execute(stmt).scalar_one_or_none()
    
    if session_record:
        session_record.is_active = False
        db.commit()
        
    return {"detail": "Successfully logged out"}


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    """Fetch current authenticated user profile."""
    return current_user


@router.post("/google", response_model=SessionResponse)
async def google_login(login_in: GoogleLoginRequest, db: Session = Depends(get_db)):
    """Authenticate via Google OAuth authorization code."""
    # Ensure client ID and client secret are configured
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth is not configured on the server."
        )

    # Exchange authorization code for token
    token_url = "https://oauth2.googleapis.com/token"
    token_data = {
        "code": login_in.code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": login_in.redirect_uri,
        "grant_type": "authorization_code"
    }

    async with httpx.AsyncClient() as client:
        try:
            token_response = await client.post(token_url, data=token_data)
            token_json = token_response.json()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to connect to Google OAuth server: {str(e)}"
            )

    if token_response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=token_json.get("error_description") or token_json.get("error") or "Failed to exchange code for Google token."
        )

    access_token = token_json.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No access token received from Google."
        )

    # Fetch user info from Google
    userinfo_url = "https://www.googleapis.com/oauth2/v3/userinfo"
    async with httpx.AsyncClient() as client:
        try:
            userinfo_response = await client.get(
                userinfo_url,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            userinfo_json = userinfo_response.json()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to fetch userinfo from Google: {str(e)}"
            )

    if userinfo_response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to retrieve profile information from Google."
        )

    google_id = userinfo_json.get("sub")
    email = userinfo_json.get("email")
    name = userinfo_json.get("name") or ""

    if not google_id or not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user information returned by Google."
        )

    # 1. Look for user by google_id
    stmt = select(User).where(User.google_id == google_id)
    user = db.execute(stmt).scalar_one_or_none()

    if not user:
        # 2. Look for user by email
        stmt_email = select(User).where(User.email == email)
        user = db.execute(stmt_email).scalar_one_or_none()

        if user:
            # User exists, link Google account
            user.google_id = google_id
            db.commit()
            db.refresh(user)
        else:
            # 3. Create a new user
            # Generate a unique username
            base_username = name.lower().replace(" ", "") if name else email.split("@")[0]
            base_username = "".join(c for c in base_username if c.isalnum())
            if not base_username:
                base_username = "user"
            
            username = base_username
            collision_counter = 1
            while True:
                stmt_check = select(User).where(User.username == username)
                if not db.execute(stmt_check).scalar_one_or_none():
                    break
                username = f"{base_username}{collision_counter}"
                collision_counter += 1

            user = User(
                username=username,
                email=email,
                google_id=google_id,
                hashed_password=None
            )
            db.add(user)
            db.commit()
            db.refresh(user)

    # Create a database user session
    expires_at = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    session_record = UserSession(
        user_id=user.id,
        token=str(uuid.uuid4()),
        expires_at=expires_at,
        is_active=True
    )
    db.add(session_record)
    db.commit()
    db.refresh(session_record)

    return {
        "session_token": session_record.token,
        "expires_at": session_record.expires_at,
        "user": user
    }


class RoleChecker:
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operation not permitted for this user role."
            )
        return current_user


# Test endpoints to verify RBAC
@router.get("/admin-only", response_model=UserOut)
def admin_only(current_user: User = Depends(RoleChecker(["admin"]))):
    """Admin-only test endpoint."""
    return current_user


@router.get("/user-only", response_model=UserOut)
def user_only(current_user: User = Depends(RoleChecker(["user", "admin"]))):
    """User-only (or admin) test endpoint."""
    return current_user


@router.post("/access-request", response_model=AccessRequestOut, status_code=status.HTTP_201_CREATED)
def request_admin_access(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Submit an elevation request to become an admin."""
    if current_user.role == "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already an administrator."
        )
        
    stmt = select(AccessRequest).where(
        AccessRequest.user_id == current_user.id,
        AccessRequest.status == "pending"
    )
    existing_request = db.execute(stmt).scalar_one_or_none()
    if existing_request:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A pending request already exists for this user."
        )
        
    new_request = AccessRequest(
        user_id=current_user.id,
        status="pending"
    )
    db.add(new_request)
    db.commit()
    db.refresh(new_request)
    
    new_request.username = current_user.username
    new_request.email = current_user.email
    return new_request


@router.get("/access-request/status")
def get_access_request_status(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get the status of the current user's elevation requests."""
    stmt = select(AccessRequest).where(
        AccessRequest.user_id == current_user.id
    ).order_by(AccessRequest.created_at.desc())
    request_record = db.execute(stmt).scalars().first()
    
    if not request_record:
        return {"status": "none"}
    return {"status": request_record.status}


@router.get("/admin/access-requests", response_model=list[AccessRequestOut])
def list_pending_requests(
    current_user: User = Depends(RoleChecker(["admin"])),
    db: Session = Depends(get_db)
):
    """List all pending access elevation requests (Admin only)."""
    stmt = select(AccessRequest).where(AccessRequest.status == "pending").order_by(AccessRequest.created_at.asc())
    requests = db.execute(stmt).scalars().all()
    
    for req in requests:
        req.username = req.user.username
        req.email = req.user.email
    return requests


@router.post("/admin/access-requests/{request_id}/approve")
def approve_access_request(
    request_id: str,
    current_user: User = Depends(RoleChecker(["admin"])),
    db: Session = Depends(get_db)
):
    """Approve access request and elevate the user to admin role."""
    stmt = select(AccessRequest).where(AccessRequest.id == request_id)
    req = db.execute(stmt).scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found.")
        
    req.status = "approved"
    req.user.role = "admin"
    db.commit()
    return {"detail": f"Request approved. User {req.user.username} elevated to admin."}


@router.post("/admin/access-requests/{request_id}/decline")
def decline_access_request(
    request_id: str,
    current_user: User = Depends(RoleChecker(["admin"])),
    db: Session = Depends(get_db)
):
    """Decline access request."""
    stmt = select(AccessRequest).where(AccessRequest.id == request_id)
    req = db.execute(stmt).scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found.")
        
    req.status = "declined"
    db.commit()
    return {"detail": f"Request declined for user {req.user.username}."}

