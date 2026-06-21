from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from math import floor
from uuid import uuid4

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.database import get_database
from app.matches import solver_bridge
from app.matches.models import MatchStatus, SquadStatus

logger = logging.getLogger(__name__)

PROPOSAL_TTL = timedelta(minutes=10)
DENSITY_THRESHOLD = 6
REGION_CELL_DEG = 0.1
PATIENCE_LIMIT = timedelta(minutes=10)
LOCK_TTL = timedelta(seconds=30)
FAILSAFE_INTERVAL_SECONDS = 60


def region_id(lat: float, lon: float) -> str:
    return f"{floor(lat / REGION_CELL_DEG)}:{floor(lon / REGION_CELL_DEG)}"


async def _acquire_lock(db: AsyncIOMotorDatabase, region: str) -> str | None:
    token = uuid4().hex
    now = datetime.now(timezone.utc)
    try:
        await db.matchmaking_locks.update_one(
            {"_id": region, "expires_at": {"$lt": now}},
            {"$set": {"owner": token, "expires_at": now + LOCK_TTL}},
            upsert=True,
        )
    except DuplicateKeyError:
        return None
    return token


async def _release_lock(db: AsyncIOMotorDatabase, region: str, token: str) -> None:
    await db.matchmaking_locks.delete_one({"_id": region, "owner": token})


async def _release_to_searching(db: AsyncIOMotorDatabase, ids: list[ObjectId]) -> None:
    if not ids:
        return
    await db.squads.update_many(
        {"_id": {"$in": ids}, "status": SquadStatus.BATCHING.value},
        {"$set": {"status": SquadStatus.SEARCHING.value}},
    )


async def evaluate_region(db: AsyncIOMotorDatabase, region: str | None) -> None:
    if not region:
        return
    base = {"status": SquadStatus.SEARCHING.value, "region_id": region}
    count = await db.squads.count_documents(base)
    if count == 0:
        return
    if count >= DENSITY_THRESHOLD:
        await run_region_wave(db, region)
        return
    cutoff = datetime.now(timezone.utc) - PATIENCE_LIMIT
    if await db.squads.count_documents({**base, "queued_at": {"$lt": cutoff}}):
        await run_region_wave(db, region)


async def run_region_wave(db: AsyncIOMotorDatabase, region: str) -> None:
    token = await _acquire_lock(db, region)
    if token is None:
        return
    try:
        candidates = await db.squads.find(
            {"status": SquadStatus.SEARCHING.value, "region_id": region}, {"_id": 1}
        ).to_list(length=None)

        claimed_docs = []
        for c in candidates:
            doc = await db.squads.find_one_and_update(
                {"_id": c["_id"], "status": SquadStatus.SEARCHING.value},
                {"$set": {"status": SquadStatus.BATCHING.value}},
            )
            if doc is not None:
                claimed_docs.append(doc)

        claimed_ids = [d["_id"] for d in claimed_docs]
        if len(claimed_docs) < 2:
            await _release_to_searching(db, claimed_ids)
            return

        room_docs = await db.rooms.find({}).to_list(length=None)
        if not room_docs:
            await _release_to_searching(db, claimed_ids)
            return

        try:
            results = solver_bridge.find_match(claimed_docs, room_docs)
        except Exception:
            logger.exception("region %s solve failed", region)
            await _release_to_searching(db, claimed_ids)
            return

        grouped: dict[str, list[str]] = {}
        rooms_by_id = {}
        for res in results:
            if res.room is None:
                continue
            grouped.setdefault(res.room.id, []).append(res.squad_id)
            rooms_by_id[res.room.id] = res.room

        matched_ids: set[str] = set()
        now = datetime.now(timezone.utc)
        for room_id, squad_ids in grouped.items():
            if len(squad_ids) < 2:
                continue
            result = await db.matches.insert_one(
                {
                    "room": rooms_by_id[room_id].model_dump(),
                    "squad_ids": squad_ids,
                    "confirmed_squads": [],
                    "status": MatchStatus.PROPOSED.value,
                    "created_at": now,
                }
            )
            await db.squads.update_many(
                {"_id": {"$in": [ObjectId(s) for s in squad_ids]}},
                {
                    "$set": {
                        "status": SquadStatus.PROPOSED.value,
                        "match_id": str(result.inserted_id),
                    }
                },
            )
            matched_ids.update(squad_ids)

        await _release_to_searching(
            db, [oid for oid in claimed_ids if str(oid) not in matched_ids]
        )
    finally:
        await _release_lock(db, region, token)


async def cleanup_stale_matches(db: AsyncIOMotorDatabase) -> None:
    cutoff = datetime.now(timezone.utc) - PROPOSAL_TTL
    stale = await db.matches.find(
        {"status": MatchStatus.PROPOSED.value, "created_at": {"$lt": cutoff}}
    ).to_list(length=None)

    for match in stale:
        confirmed = match.get("confirmed_squads", [])
        ghosts = [sid for sid in match.get("squad_ids", []) if sid not in confirmed]

        if ghosts:
            await db.squads.update_many(
                {"_id": {"$in": [ObjectId(s) for s in ghosts]}},
                {"$set": {"status": SquadStatus.IDLE.value}},
            )
        if confirmed:
            await db.squads.update_many(
                {"_id": {"$in": [ObjectId(s) for s in confirmed]}},
                {
                    "$set": {
                        "status": SquadStatus.SEARCHING.value,
                        "queued_at": datetime.now(timezone.utc),
                    }
                },
            )
        await db.matches.update_one(
            {"_id": match["_id"]},
            {"$set": {"status": MatchStatus.CANCELLED.value}},
        )


async def run_worker_loop(interval_seconds: int = FAILSAFE_INTERVAL_SECONDS) -> None:
    while True:
        try:
            db = get_database()
            regions = await db.squads.distinct(
                "region_id", {"status": SquadStatus.SEARCHING.value}
            )
            for region in regions:
                await evaluate_region(db, region)
            await cleanup_stale_matches(db)
        except Exception:
            logger.exception("matchmaking worker iteration failed")
        await asyncio.sleep(interval_seconds)
