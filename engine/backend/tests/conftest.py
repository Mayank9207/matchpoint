"""Shared test fixtures.

Uses a REAL MongoDB, never a mock: the atomic operators this codebase relies on
($addToSet, find_one_and_update) have semantics no mock reproduces faithfully.

Connection source, in priority order:
  1. $TEST_MONGODB_URI  -- set by CI (service container).
  2. pymongo_inmemory   -- downloads and runs a real mongod locally for dev.
"""
from __future__ import annotations

import os

import pytest
import pytest_asyncio

_MONGOD = None


def pytest_configure(config: pytest.Config) -> None:
    """Point the app at a test database BEFORE app.config is imported.

    Real environment variables take precedence over the committed .env, so this
    guarantees tests never touch the production Atlas cluster or real SMTP.
    """
    global _MONGOD

    uri = os.environ.get("TEST_MONGODB_URI")
    if not uri:
        os.environ.setdefault("PYMONGOIM__MONGO_VERSION", "7.0")
        os.environ.setdefault("PYMONGOIM__OPERATING_SYSTEM", "ubuntu")
        from pymongo_inmemory.context import Context
        from pymongo_inmemory.mongod import Mongod

        _MONGOD = Mongod(Context())
        _MONGOD.start()
        uri = _MONGOD.connection_string

    os.environ["MONGODB_URI"] = uri
    os.environ["MONGODB_DB_NAME"] = "matchpoint_test"
    os.environ["JWT_SECRET"] = "test-only-secret-do-not-use-in-production"
    os.environ["ENABLE_WORKER"] = "false"
    # Blank SMTP host makes send_otp_email raise 503 instead of mailing anyone.
    os.environ["SMTP_HOST"] = ""
    os.environ["SMTP_USER"] = ""
    os.environ["SMTP_FROM"] = ""


def pytest_unconfigure(config: pytest.Config) -> None:
    global _MONGOD
    if _MONGOD is not None:
        _MONGOD.stop()
        _MONGOD = None


@pytest_asyncio.fixture
async def db():
    """Fresh, empty database bound to this test's event loop."""
    from app.database import close_mongo_connection, connect_to_mongo, get_database

    await connect_to_mongo()
    database = get_database()
    for name in await database.list_collection_names():
        await database.drop_collection(name)
    try:
        yield database
    finally:
        await close_mongo_connection()


@pytest_asyncio.fixture
async def client(db):
    """httpx client hitting the ASGI app in-process."""
    from httpx import ASGITransport, AsyncClient

    from app.main import create_app

    app = create_app()
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as http_client:
        yield http_client
