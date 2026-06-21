from __future__ import annotations

from datetime import datetime
from typing import Annotated, List

from pydantic import BaseModel, ConfigDict, Field
from pydantic.functional_validators import BeforeValidator

PyObjectId = Annotated[str, BeforeValidator(str)]


class SquadMember(BaseModel):
    user_id: str
    display_name: str
    is_leader: bool = False
    joined_at: datetime


class SquadCreate(BaseModel):
    sport: int
    tier: int
    lat: float
    lon: float
    max_distance: float = Field(gt=0)
    start_time: float
    end_time: float
    capacity: int = Field(ge=2, le=22)
    format: str = Field(min_length=1, max_length=12)
    overs: str | None = Field(default=None, max_length=8)
    paid: bool = False
    price: int = Field(default=0, ge=0, le=100000)


class SquadJoin(BaseModel):
    code: str = Field(min_length=4, max_length=12)


class SquadResponse(BaseModel):
    id: PyObjectId = Field(validation_alias="_id")
    code: str
    sport: int
    tier: int
    lat: float
    lon: float
    max_distance: int
    start_time: datetime
    end_time: datetime
    members: List[SquadMember]
    status: str
    created_at: datetime
    region_id: str | None = None
    queued_at: datetime | None = None
    match_id: str | None = None
    capacity: int | None = None
    format: str | None = None
    overs: str | None = None
    paid: bool = False
    price: int = 0

    model_config = ConfigDict(populate_by_name=True)
