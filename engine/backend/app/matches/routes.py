from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.auth.dependencies import get_current_user
from app.auth.models import UserResponse
from app.database import get_database
from app.matches.models import (
    Match,
    MatchDetail,
    MatchRequest,
    MatchStatus,
    PoolStatus,
    SquadStatus,
)
from app.worker import (
    DENSITY_THRESHOLD,
    PATIENCE_LIMIT,
    evaluate_region,
    region_id,
)

router = APIRouter()


@router.post("/find", status_code=status.HTTP_202_ACCEPTED)
async def find(
    payload: MatchRequest,
    background_tasks: BackgroundTasks,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> dict[str, str]:
    try:
        oid = ObjectId(payload.squad_id)
    except Exception:
        raise HTTPException(404, "Squad not found")

    squad = await db.squads.find_one({"_id": oid, "members.user_id": current_user.id})
    if not squad:
        raise HTTPException(404, "Squad not found")

    rid = region_id(squad["lat"], squad["lon"])
    await db.squads.update_one(
        {"_id": oid},
        {
            "$set": {
                "status": SquadStatus.SEARCHING.value,
                "queued_at": datetime.now(timezone.utc),
                "region_id": rid,
            }
        },
    )

    background_tasks.add_task(evaluate_region, db, rid)
    return {"status": SquadStatus.SEARCHING.value, "squad_id": payload.squad_id}


@router.get("/pool-status", response_model=PoolStatus)
async def pool_status(
    region_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> PoolStatus:
    query = {"status": SquadStatus.SEARCHING.value, "region_id": region_id}
    units_searching = await db.squads.count_documents(query)

    oldest = await db.squads.find_one(query, sort=[("queued_at", 1)])
    oldest_wait_seconds = 0.0
    if oldest and oldest.get("queued_at"):
        queued_at = oldest["queued_at"]
        if queued_at.tzinfo is None:
            queued_at = queued_at.replace(tzinfo=timezone.utc)
        oldest_wait_seconds = (datetime.now(timezone.utc) - queued_at).total_seconds()

    return PoolStatus(
        region_id=region_id,
        units_searching=units_searching,
        density_threshold=DENSITY_THRESHOLD,
        oldest_wait_seconds=oldest_wait_seconds,
        patience_limit_seconds=PATIENCE_LIMIT.total_seconds(),
    )


@router.get("/{match_id}", response_model=MatchDetail)
async def get_match(
    match_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> MatchDetail:
    try:
        oid = ObjectId(match_id)
    except Exception:
        raise HTTPException(404, "Match not found")

    match = await db.matches.find_one({"_id": oid})
    if not match:
        raise HTTPException(404, "Match not found")

    squad = await db.squads.find_one(
        {"_id": {"$in": [ObjectId(s) for s in match["squad_ids"]]},
         "members.user_id": current_user.id}
    )
    if not squad:
        raise HTTPException(403, "Squad is not part of this match")

    return MatchDetail(
        match_id=str(match["_id"]),
        room=match["room"],
        squad_ids=match["squad_ids"],
        confirmed_squads=match.get("confirmed_squads", []),
        status=match["status"],
        created_at=match["created_at"],
    )


@router.post("/{match_id}/confirm", response_model=Match)
async def confirm_match(
    match_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> Match:
    squad = await db.squads.find_one({"members.user_id": current_user.id})
    if not squad:
        raise HTTPException(404, "You are not in a squad")
    squad_id = str(squad["_id"])

    try:
        oid = ObjectId(match_id)
    except Exception:
        raise HTTPException(404, "Match not found")

    match = await db.matches.find_one({"_id": oid})
    if not match:
        raise HTTPException(404, "Match not found")
    if squad_id not in match.get("squad_ids", []):
        raise HTTPException(403, "Squad is not part of this match")

    await db.matches.update_one(
        {"_id": oid},
        {"$addToSet": {"confirmed_squads": squad_id}},
    )

    match = await db.matches.find_one({"_id": oid})
    all_confirmed = len(match.get("confirmed_squads", [])) == len(match["squad_ids"])
    if all_confirmed and match["status"] != MatchStatus.LOCKED.value:
        await db.matches.update_one({"_id": oid}, {"$set": {"status": MatchStatus.LOCKED.value}})
        await db.squads.update_many(
            {"_id": {"$in": [ObjectId(s) for s in match["confirmed_squads"]]}},
            {"$set": {"status": SquadStatus.LOCKED.value}},
        )
        match = await db.matches.find_one({"_id": oid})

    return match
