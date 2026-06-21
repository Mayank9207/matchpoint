from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from app.config import get_settings


def generate_otp() -> str:
    length = get_settings().otp_length
    upper = 10 ** length
    return str(secrets.randbelow(upper)).zfill(length)


def hash_otp(code: str) -> str:
    secret = get_settings().jwt_secret.encode("utf-8")
    return hmac.new(secret, code.encode("utf-8"), hashlib.sha256).hexdigest()


def verify_otp(code: str, hashed: str) -> bool:
    return hmac.compare_digest(hash_otp(code), hashed)


def otp_expiry() -> datetime:
    minutes = get_settings().otp_expire_minutes
    return datetime.now(timezone.utc) + timedelta(minutes=minutes)
