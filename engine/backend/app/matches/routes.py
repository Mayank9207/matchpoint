"""Matching routes: find a room for a squad, fetch, confirm."""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.auth.dependencies import get_current_user
from app.auth.models import UserResponse
from app.database import get_database
from app.matches.models import MatchRequest, MatchResponse

router = APIRouter()


@router.post("/find", response_model=MatchResponse)
async def find(
    payload: MatchRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> MatchResponse:
    """Run the solver to assign the requesting squad to a room."""
    # TODO: implement (load squad + candidate rooms, call solver_bridge.find_match)
    raise NotImplementedError


@router.get("/{match_id}", response_model=MatchResponse)
async def get_match(
    match_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> MatchResponse:
    """Fetch a previously computed match by id."""
    # TODO: implement
    raise NotImplementedError


@router.post("/{match_id}/confirm", response_model=MatchResponse)
async def confirm_match(
    match_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> MatchResponse:
    """Confirm an assigned match."""
    # TODO: implement
    raise NotImplementedError
