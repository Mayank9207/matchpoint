"""Authentication routes: signup, login, current-user."""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.auth.dependencies import get_current_user
from app.auth.models import TokenResponse, UserCreate, UserLogin, UserResponse
from app.database import get_database
from datetime import datetime, timezone
from app.auth.jwt_utils import hash_password, verify_password, create_access_token

router = APIRouter()

#get database could have worked without declaring the dependencies but we still do it for clarity
@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup( payload: UserCreate, db: AsyncIOMotorDatabase = Depends(get_database),) -> TokenResponse:
    #check email uniqueness
    user=await db.users.find_one({"email":payload.email.lower()})
    if user:
        raise HTTPException(status_code=409,detail="Email already registered")
    
    password_hash=hash_password(payload.password)

    new_user={
        "email":payload.email.lower(),
        "password_hash":password_hash,
        "display_name":payload.display_name,
        "created_at": datetime.now(timezone.utc),
    }

    result = await db.users.insert_one(new_user)

    token=create_access_token(str(result.inserted_id))

    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=str(result.inserted_id),
            email=payload.email.lower(),
            display_name=payload.display_name,
            created_at=new_user["created_at"]
        )
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: UserLogin,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> TokenResponse:

    user=await db.users.find_one({"email":payload.email.lower()})
    #use same error message for security and non determinism
    if not user:
        raise HTTPException(status_code=401,detail="Invalid credentials")
    
    if not verify_password(payload.password,user["password_hash"]):
        raise HTTPException(status_code=401,detail="Invalid credentials")
    
    token = create_access_token(str(user["_id"]))

    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=str(user["_id"]),
            email=user["email"],
            display_name=user["display_name"],
            created_at=user["created_at"],
        ),
    )
    



@router.get("/me", response_model=UserResponse)
async def me(current_user: UserResponse = Depends(get_current_user)) -> UserResponse:
    return current_user
