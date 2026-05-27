from __future__ import annotations

from dataclasses import dataclass
from enum import IntEnum, unique


@unique
class Sport(IntEnum):
    FOOTBALL = 0
    BASKETBALL = 1
    TENNIS = 2
    VOLLEYBALL = 3
    CRICKET = 4
    BADMINTON = 5
    KHOKHO = 6
    SWIMMING = 7
    TABLETENNIS = 8
    HOCKEY = 9
    RUGBY = 10
    GOLF = 11


@unique
class Tier(IntEnum):
    BEGINNER = 0
    INTERMEDIATE = 1
    COMPETITIVE = 2


@dataclass(frozen=True)
class Squad:
    id: str
    size: int
    sport: Sport
    tier: Tier
    lat: float
    lon: float
    max_distance: float
    start_time: float
    end_time: float

    def __post_init__(self):
        # cap at 10 — beyond that the solver overhead outweighs the benefit
        if not 1 <= self.size <= 10:
            raise ValueError(f"Size of the team must be 1-10, got {self.size}")
        if self.max_distance <= 0:
            raise ValueError(f"max distance must be positive, got {self.max_distance}")
        if self.start_time > self.end_time:
            raise ValueError("Start time must be less than the end time.")


@dataclass(frozen=True)
class Room:
    id: str
    sport: Sport
    desired_tier: Tier
    lat: float
    lon: float
    capacity: int
    match_time: float

    def __post_init__(self):
        if self.capacity < 1:
            raise ValueError(f"Room capacity must be >= 1, got {self.capacity}")
