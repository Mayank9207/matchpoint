from __future__ import annotations
from bson import ObjectId
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.auth.dependencies import get_current_user
from app.auth.models import UserResponse
from app.database import get_database
from app.matches.models import SquadStatus
from app.squads.models import SquadCreate, SquadJoin, SquadMember, SquadResponse
from app.squads.utils import generate_unique_code
from app.worker import evaluate_region, region_id

router = APIRouter()


@router.get("/pool/count")
async def pool_count(
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> dict[str, int]:
    count = await db.squads.count_documents(
        {"status": {"$in": [SquadStatus.SEARCHING.value, SquadStatus.BATCHING.value]}}
    )
    return {"count": count}


@router.post("/create", response_model=SquadResponse, status_code=status.HTTP_201_CREATED)
async def create_squad(
    payload: SquadCreate,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> SquadResponse:
    existing=await db.squads.find_one({"members.user_id":current_user.id})

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="already in squad, leave first to join new one",
        )
    
    code = await generate_unique_code(db)

    now=datetime.now(timezone.utc)

    leader_member={
        "user_id":current_user.id,
        "display_name":current_user.display_name,
        "is_leader":True,
        "joined_at":now,
    }

    squad_doc = {
        "code": code,
        "sport": payload.sport,
        "tier": payload.tier,
        "lat": payload.lat,
        "lon": payload.lon,
        "max_distance": payload.max_distance,
        "start_time": payload.start_time,
        "end_time": payload.end_time,
        "capacity": payload.capacity,
        "format": payload.format,
        "overs": payload.overs,
        "paid": payload.paid,
        "price": payload.price,
        "members": [leader_member],
        "status": "forming",
        "created_at": now,
    }

    result = await db.squads.insert_one(squad_doc)

    squad_doc["_id"] = result.inserted_id

    return squad_doc

@router.post("/join", response_model=SquadResponse)
async def join_squad(
    payload: SquadJoin,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> SquadResponse:
    existing=await db.squads.find_one({"members.user_id":current_user.id})

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="already in squad, leave first to join new one",
        )
    
    code=payload.code.upper()

    squad = await db.squads.find_one({"code": code})
    if not squad:
        raise HTTPException(404, "Squad not found")
    
    

    now = datetime.now(timezone.utc)
    new_member = {
        "user_id": current_user.id,
        "display_name": current_user.display_name,
        "is_leader": False,
        "joined_at": now,
    }

    await db.squads.update_one(
      {"_id": squad["_id"]},
      {"$push": {"members": new_member}},
   )
    
    updated = await db.squads.find_one({"_id": squad["_id"]})
    return updated


@router.post("/{squad_id}/enter", response_model=SquadResponse)
async def enter_pool(
    squad_id: str,
    background_tasks: BackgroundTasks,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> SquadResponse:
    try:
        oid = ObjectId(squad_id)
    except Exception:
        raise HTTPException(404, "Squad not found")

    squad = await db.squads.find_one({"_id": oid})
    if not squad:
        raise HTTPException(404, "Squad not found")

    leader = next(
        (m for m in squad["members"] if m["user_id"] == current_user.id and m.get("is_leader")),
        None,
    )
    if not leader:
        raise HTTPException(403, "Only the unit leader can enter the pool")

    if squad.get("status") != "forming":
        raise HTTPException(409, "Squad is already in the pool")

    rid = region_id(squad["lat"], squad["lon"])
    now = datetime.now(timezone.utc)
    await db.squads.update_one(
        {"_id": oid},
        {"$set": {"status": "searching", "region_id": rid, "queued_at": now}},
    )

    background_tasks.add_task(evaluate_region, db, rid)

    return await db.squads.find_one({"_id": oid})


@router.get("/current", response_model=SquadResponse)
async def current_squad(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> SquadResponse:
    squad = await db.squads.find_one({"members.user_id": current_user.id})
    if not squad:
        raise HTTPException(404, "No active squad")
    return squad


@router.get("/{squad_id}", response_model=SquadResponse)
async def get_squad(
    squad_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> SquadResponse:
    try:
        oid=ObjectId(squad_id)
    except Exception :
        raise HTTPException(404,"Squad not found")
    

    squad=await db.squads.find_one({"_id":oid})
    if not squad:
        raise HTTPException(404,"Squad not found")
    
    
    member_ids = [m["user_id"] for m in squad["members"]]
    if current_user.id not in member_ids:
      raise HTTPException(404, "Squad not found")
    
    return squad

@router.post("/{squad_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_squad(
    squad_id: str,
    background_tasks: BackgroundTasks,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> None:
    try:
        oid=ObjectId(squad_id)
    except Exception:
        raise HTTPException(404,"Squad not found")

    squad=await db.squads.find_one({"_id":oid})
    if not squad:
        raise  HTTPException(404,"Squad not found")

    member_ids = [m["user_id"] for m in squad["members"]]

    if current_user.id not in member_ids:
        raise HTTPException(status_code=400, detail="You are not a member of this squad")

    background_tasks.add_task(evaluate_region, db, squad.get("region_id"))

    if len(squad["members"])==1:
        await db.squads.delete_one({"_id":oid})
        return
    
    await db.squads.update_one(
        {"_id":oid},
        {"$pull":{"members":{"user_id":current_user.id}}}
    )

    leaving_member = next(m for m in squad["members"] if m["user_id"] == current_user.id)
    if leaving_member.get("is_leader"):
        remaining_members = [m for m in squad["members"] if m["user_id"] != current_user.id]
        next_leader = min(remaining_members, key=lambda x: x["joined_at"])

        await db.squads.update_one(
            {
                "_id":oid,
                "members.user_id":next_leader["user_id"]
            },
            {
                "$set":{"members.$.is_leader":True}
            })
