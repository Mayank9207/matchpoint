"""Squad lifecycle routes: create, join, fetch, leave."""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.auth.dependencies import get_current_user
from app.auth.models import UserResponse
from app.database import get_database
from app.squads.models import SquadCreate, SquadJoin, SquadResponse

router = APIRouter()


@router.post("/create", response_model=SquadResponse, status_code=status.HTTP_201_CREATED)
async def create_squad(
    payload: SquadCreate,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> SquadResponse:
    """Create a new squad with the current user as leader."""
    # TODO: implement
    raise NotImplementedError


@router.post("/join", response_model=SquadResponse)
async def join_squad(
    payload: SquadJoin,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> SquadResponse:
    """Join an existing squad by its shareable code."""
    # TODO: implement
    raise NotImplementedError


@router.get("/{squad_id}", response_model=SquadResponse)
async def get_squad(
    squad_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> SquadResponse:
    """Fetch a single squad by id."""
    # TODO: implement
    raise NotImplementedError


@router.post("/{squad_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_squad(
    squad_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> None:
    """Remove the current user from a squad."""
    # TODO: implement
    raise NotImplementedError
