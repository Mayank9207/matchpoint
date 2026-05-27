from __future__ import annotations

import math

from utils import haversine_m
from models import Squad, Room, Tier


def is_feasible(squad: Squad, room: Room) -> bool:
    if squad.sport != room.sport:
        return False
    if squad.size > room.capacity:
        return False
    if room.match_time < squad.start_time or room.match_time > squad.end_time:
        return False
    if haversine_m(squad.lat, squad.lon, room.lat, room.lon) > squad.max_distance:
        return False
    return True


# Default weights for distance vs tier cost.
_DEFAULT_W_DIST = 0.7
_DEFAULT_W_TIER = 0.3


def distance_cost(squad: Squad, room: Room) -> float:
    """
    Linear distance penalty normalised by the squad's max range.
    If data later shows a strong preference for very-close matches,
    switch to (d/D)^2 and document the change.
    """
    d = haversine_m(squad.lat, squad.lon, room.lat, room.lon)
    return d / squad.max_distance


def tier_cost(squad: Squad, room: Room) -> float:
    max_gap = len(Tier) - 1
    gap = abs(int(squad.tier) - int(room.desired_tier))
    return gap / max_gap


def score(
    squad: Squad,
    room: Room,
    w_dist: float = _DEFAULT_W_DIST,
    w_tier: float = _DEFAULT_W_TIER,
) -> float:
    if not is_feasible(squad, room):
        return math.inf
    return w_dist * distance_cost(squad, room) + w_tier * tier_cost(squad, room)
