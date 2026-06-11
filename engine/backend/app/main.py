"""FastAPI application instance: CORS setup and router registration."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.routes import router as auth_router
from app.config import get_settings
from app.database import close_mongo_connection, connect_to_mongo
from app.matches.routes import router as matches_router
from app.squads.routes import router as squads_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Open the MongoDB connection on startup, close it on shutdown."""
    # TODO: implement
    await connect_to_mongo()
    yield
    await close_mongo_connection()


def create_app() -> FastAPI:
    """Build and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="MatchPoint API",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth_router, prefix="/auth", tags=["auth"])
    app.include_router(squads_router, prefix="/squads", tags=["squads"])
    app.include_router(matches_router, prefix="/matches", tags=["matches"])

    return app


app = create_app()


@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    """Liveness probe used by Railway and load balancers."""
    # TODO: implement
    return {"status": "ok"}
