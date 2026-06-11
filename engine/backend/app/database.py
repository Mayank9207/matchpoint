from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import get_settings


class _MongoState:

    client: AsyncIOMotorClient | None = None
    db: AsyncIOMotorDatabase | None = None


_state = _MongoState()


async def connect_to_mongo() -> None:
    settings=get_settings()
    _state.client=AsyncIOMotorClient(settings.mongodb_uri)
    _state.db=_state.client[settings.mongodb_db_name]


async def close_mongo_connection() -> None:
    if _state.client is not None:
        _state.client.close()
        _state.client=None
        _state.db=None


def get_database() -> AsyncIOMotorDatabase:
    if _state.db is None:
        raise RuntimeError("Database isn't initialized")
    return _state.db
