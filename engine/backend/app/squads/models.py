"""Pydantic schemas for the squads domain."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class SquadMember(BaseModel):
    """A single member of a squad."""

    user_id: str
    display_name: str
    is_leader: bool = False
    joined_at: datetime


class SquadCreate(BaseModel):
    """Request body for POST /squads/create."""

    sport: int = Field(description="Sport enum value (see engine.models.Sport)")
    tier: int = Field(description="Tier enum value (see engine.models.Tier)")
    lat: float
    lon: float
    max_distance: float = Field(gt=0, description="Max travel distance in metres")
    start_time: float = Field(description="Earliest acceptable start (epoch seconds)")
    end_time: float = Field(description="Latest acceptable end (epoch seconds)")


class SquadJoin(BaseModel):
    """Request body for POST /squads/join."""

    code: str = Field(min_length=4, max_length=12, description="Shareable squad code")


class SquadResponse(BaseModel):
    """Public representation of a squad."""

    id: str
    code: str
    sport: int
    tier: int
    lat: float
    lon: float
    max_distance: float
    start_time: float
    end_time: float
    members: list[SquadMember]
    created_at: datetime
