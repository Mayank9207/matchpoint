from __future__ import annotations

import jwt
from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.auth.jwt_utils import decode_token
from app.auth.models import UserResponse
from app.database import get_database

bearer_scheme = HTTPBearer(auto_error=True)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> UserResponse:
    
    token=credentials.credentials
    try:
        payload = decode_token(token)

    except jwt.PyJWTError:
        raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        )
    
    #attackers can forge tokens somehow so imp to validate the structure
    
    user_id_str=payload.get("sub")
    if not user_id_str:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,detail="token missing subject claim")
    
    try:
        user_id=ObjectId(user_id_str)
    except Exception :
        raise HTTPException(status.HTTP_401_UNAUTHORIZED,detail="Invalid user id format")
    
    # now we will match the id with the one in the db
    user = await db.users.find_one({"_id":user_id})

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,detail="User not found")
    
    return UserResponse(
        id = str(user["_id"]),
        email = user["email"],
        display_name =user["display_name"],
        created_at=user["created_at"],
    )
