from __future__ import annotations

import secrets

from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

Possible_Chars= "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def generate_code(length: int = 6) -> str:
    return "".join(secrets.choice(Possible_Chars) for _ in range(length))


async def generate_unique_code(
    db: AsyncIOMotorDatabase,
    length: int = 6,
    max_attempts: int = 5,
) -> str:
    for _ in range(max_attempts):
        code = generate_code(length)
        existing = await db.squads.find_one({"code": code})
        if not existing:
            return code
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Could not generate a unique squad code",
    )