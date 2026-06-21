from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=64)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class OTPVerify(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=8)


class ResendOTP(BaseModel):
    email: EmailStr


class GoogleAuthRequest(BaseModel):
    credential: str = Field(min_length=1)


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    display_name: str
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class OTPChallengeResponse(BaseModel):
    message: str
    email: EmailStr
    requires_verification: bool = True
    expires_in_minutes: int
