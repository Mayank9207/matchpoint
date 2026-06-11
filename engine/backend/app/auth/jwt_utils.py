"""JWT encoding/decoding and password hashing helpers."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from passlib.context import CryptContext

from app.config import get_settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password,hashed_password)


def create_access_token(
    subject: str,
    expires_delta: timedelta | None = None,
) -> str:
    settings=get_settings()
    expire=datetime.now(timezone.utc)+(expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    payload={
        "sub": subject,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload,settings.jwt_secret,algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    settings=get_settings()
    return jwt.decode(token,settings.jwt_secret,algorithms=[settings.jwt_algorithm])
