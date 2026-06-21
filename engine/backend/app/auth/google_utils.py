from __future__ import annotations

import httpx
from fastapi import HTTPException, status

from app.config import get_settings

_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"


async def verify_google_credential(credential: str) -> dict[str, str]:
    settings = get_settings()
    if not settings.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign-in is not configured (set GOOGLE_CLIENT_ID).",
        )

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(_TOKENINFO_URL, params={"id_token": credential})
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not reach Google to verify sign-in.",
        ) from exc

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google credential")

    claims = resp.json()

    if claims.get("aud") != settings.google_client_id:
        raise HTTPException(status_code=401, detail="Google credential audience mismatch")

    email_verified = str(claims.get("email_verified", "")).lower() == "true"
    email = claims.get("email")
    if not email or not email_verified:
        raise HTTPException(status_code=401, detail="Google account email is not verified")

    return claims
