"""Pydantic schemas for the matches domain."""
from __future__ import annotations

from pydantic import BaseModel, Field


class RoomInfo(BaseModel):
    """A bookable room/court the solver can assign squads to.

    Field names mirror the attributes the C++ solver reads off each object
    (see engine/cpp/bindings.cpp).
    """

    id: str
    sport: int
    desired_tier: int
    lat: float
    lon: float
    capacity: int = Field(ge=1)
    match_time: float = Field(description="Scheduled match start (epoch seconds)")


class MatchRequest(BaseModel):
    """Request body for POST /matches/find."""

    squad_id: str
    # Optional solver weights; fall back to engine defaults when omitted.
    w_dist: float = 0.7
    w_tier: float = 0.3
    max_iter: int = 100


class MatchResponse(BaseModel):
    """Result of a matching run for a single squad."""

    match_id: str
    squad_id: str
    room: RoomInfo | None = Field(default=None, description="Assigned room, if any")
    distance_m: float | None = Field(default=None, description="Squad-to-room distance")
    cost: float | None = Field(default=None, description="Solver objective cost")
    confirmed: bool = False
