from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.routes import router as auth_router
from app.config import get_settings
from app.database import close_mongo_connection, connect_to_mongo
from app.matches.routes import router as matches_router
from app.squads.routes import router as squads_router
from app.worker import run_worker_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    worker_task = None
    if get_settings().enable_worker:
        worker_task = asyncio.create_task(run_worker_loop())
    try:
        yield
    finally:
        if worker_task is not None:
            worker_task.cancel()
            try:
                await worker_task
            except asyncio.CancelledError:
                pass
        await close_mongo_connection()


def create_app() -> FastAPI:
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
    return {"status": "ok"}
