from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.auth.dependencies import get_current_user
from app.auth.email_utils import send_otp_email
from app.auth.google_utils import verify_google_credential
from app.auth.jwt_utils import create_access_token, hash_password, verify_password
from app.auth.models import (
    GoogleAuthRequest,
    OTPChallengeResponse,
    OTPVerify,
    ResendOTP,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
)
from app.auth.otp_utils import generate_otp, hash_otp, otp_expiry, verify_otp
from app.config import get_settings
from app.database import get_database

router = APIRouter()


def _token_response(user: dict) -> TokenResponse:
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


async def _issue_otp(db: AsyncIOMotorDatabase, user_id, email: str) -> OTPChallengeResponse:
    code = generate_otp()
    await db.users.update_one(
        {"_id": user_id},
        {
            "$set": {
                "otp_hash": hash_otp(code),
                "otp_expires_at": otp_expiry(),
                "otp_attempts": 0,
            }
        },
    )
    await send_otp_email(email, code)
    return OTPChallengeResponse(
        message="Verification code sent.",
        email=email,
        expires_in_minutes=get_settings().otp_expire_minutes,
    )


@router.post("/signup", response_model=OTPChallengeResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    payload: UserCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> OTPChallengeResponse:
    email = payload.email.lower()
    existing = await db.users.find_one({"email": email})

    if existing:
        if existing.get("is_verified", True):
            raise HTTPException(status_code=409, detail="Email already registered")
        await db.users.update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "password_hash": hash_password(payload.password),
                    "display_name": payload.display_name,
                }
            },
        )
        return await _issue_otp(db, existing["_id"], email)

    new_user = {
        "email": email,
        "password_hash": hash_password(payload.password),
        "display_name": payload.display_name,
        "is_verified": False,
        "auth_provider": "password",
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.users.insert_one(new_user)
    return await _issue_otp(db, result.inserted_id, email)


@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp_route(
    payload: OTPVerify,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> TokenResponse:
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="Account not found")

    if user.get("is_verified", True) and not user.get("otp_hash"):
        return _token_response(user)

    otp_hash = user.get("otp_hash")
    expires_at = user.get("otp_expires_at")
    if not otp_hash or not expires_at:
        raise HTTPException(status_code=400, detail="No verification in progress. Request a new code.")

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Verification code expired. Request a new one.")

    if user.get("otp_attempts", 0) >= get_settings().otp_max_attempts:
        raise HTTPException(status_code=429, detail="Too many attempts. Request a new code.")

    if not verify_otp(payload.code, otp_hash):
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {"otp_attempts": 1}})
        raise HTTPException(status_code=400, detail="Invalid verification code")

    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"is_verified": True},
            "$unset": {"otp_hash": "", "otp_expires_at": "", "otp_attempts": ""},
        },
    )
    user["is_verified"] = True
    return _token_response(user)


@router.post("/resend-otp", response_model=OTPChallengeResponse)
async def resend_otp(
    payload: ResendOTP,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> OTPChallengeResponse:
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="Account not found")
    if user.get("is_verified", True) and not user.get("otp_hash"):
        raise HTTPException(status_code=400, detail="Account is already verified")
    return await _issue_otp(db, user["_id"], email)


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: UserLogin,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> TokenResponse:
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.get("is_verified", True):
        await _issue_otp(db, user["_id"], user["email"])
        raise HTTPException(status_code=403, detail="EMAIL_NOT_VERIFIED")

    return _token_response(user)


@router.post("/google", response_model=TokenResponse)
async def google_auth(
    payload: GoogleAuthRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> TokenResponse:
    claims = await verify_google_credential(payload.credential)
    email = claims["email"].lower()
    display_name = claims.get("name") or email.split("@")[0]

    user = await db.users.find_one({"email": email})
    if user:
        await db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {"is_verified": True},
                "$unset": {"otp_hash": "", "otp_expires_at": "", "otp_attempts": ""},
            },
        )
        return _token_response(user)

    new_user = {
        "email": email,
        "password_hash": None,
        "display_name": display_name,
        "is_verified": True,
        "auth_provider": "google",
        "google_sub": claims.get("sub"),
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.users.insert_one(new_user)
    new_user["_id"] = result.inserted_id
    return _token_response(new_user)


@router.get("/me", response_model=UserResponse)
async def me(current_user: UserResponse = Depends(get_current_user)) -> UserResponse:
    return current_user
