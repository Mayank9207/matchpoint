from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field
from pydantic.functional_validators import BeforeValidator

PyObjectId = Annotated[str, BeforeValidator(str)]


class SquadStatus(str, Enum):
    IDLE = "idle"
    SEARCHING = "searching"
    BATCHING = "batching"
    PROPOSED = "proposed"
    LOCKED = "locked"


class MatchStatus(str, Enum):
    PROPOSED = "proposed"
    LOCKED = "locked"
    CANCELLED = "cancelled"


class RoomInfo(BaseModel):
    id: str
    sport: int
    desired_tier: int
    lat: float
    lon: float
    capacity: int = Field(ge=1)
    match_time: float
    image_url: str | None = None
    paid: bool = False
    price: int = Field(default=0, ge=0)


class MatchRequest(BaseModel):
    squad_id: str
    w_dist: float = 0.7
    w_tier: float = 0.3
    max_iter: int = 100


class MatchResponse(BaseModel):
    match_id: str
    squad_id: str
    room: RoomInfo | None = None
    distance_m: float | None = None
    cost: float | None = None
    confirmed: bool = False


class MatchDetail(BaseModel):
    match_id: str
    room: RoomInfo
    squad_ids: list[str]
    confirmed_squads: list[str] = Field(default_factory=list)
    status: MatchStatus
    created_at: datetime


class PoolStatus(BaseModel):
    region_id: str
    units_searching: int
    density_threshold: int
    oldest_wait_seconds: float
    patience_limit_seconds: float


class Match(BaseModel):
    id: PyObjectId = Field(validation_alias="_id")
    room: RoomInfo
    squad_ids: list[str]
    confirmed_squads: list[str] = Field(default_factory=list)
    status: MatchStatus = MatchStatus.PROPOSED
    cost: float | None = None
    created_at: datetime

    model_config = ConfigDict(populate_by_name=True)
