"""
Synthetic instance generator for benchmarking and property testing.

All randomness is seeded — the same (seed, n_squads, n_rooms, …) arguments
always produce exactly the same instance, so benchmark runs are reproducible
and CI failures can be replayed exactly.

Usage
-----
    from bench.datagen import generate_instance
    squads, rooms = generate_instance(n_squads=50, n_rooms=10, seed=42)
"""
from __future__ import annotations

import random
import sys
import os

# Allow running this file directly from bench/ without installing the package.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models import Squad, Room, Sport, Tier

# 1° of latitude is ≈ 111 km everywhere; 1° of longitude ≈ 111 km at equator.
_DEG_PER_KM = 1.0 / 111.0


def generate_instance(
    n_squads: int,
    n_rooms: int,
    seed: int = 42,
    sport: Sport = Sport.FOOTBALL,
    contention_ratio: float = 1.2,
    center_lat: float = 28.6,
    center_lon: float = 77.2,
    area_radius_km: float = 10.0,
    squad_size_range: tuple[int, int] = (1, 6),
) -> tuple[list[Squad], list[Room]]:
    """
    Generate a reproducible (squads, rooms) instance.

    Parameters
    ----------
    n_squads, n_rooms
        Number of squads and rooms.
    seed
        Random seed. Same seed ⇒ identical instance.
    sport
        All squads and rooms share this sport (keeps feasibility tractable).
    contention_ratio
        total_room_slots / total_squad_players.  1.0 → perfectly tight
        (every player must fit); >1.0 → slack; <1.0 → impossible to match all.
    center_lat, center_lon
        Geographic centre of the generated area (decimal degrees).
    area_radius_km
        Half-width of the bounding square. Squads and rooms are scattered
        uniformly within this radius.
    squad_size_range
        (min, max) inclusive for squad sizes.
    """
    if n_squads < 0 or n_rooms < 0:
        raise ValueError("n_squads and n_rooms must be non-negative")
    if contention_ratio <= 0:
        raise ValueError("contention_ratio must be positive")

    rng = random.Random(seed)
    half = area_radius_km * _DEG_PER_KM

    def rand_lat() -> float:
        return center_lat + rng.uniform(-half, half)

    def rand_lon() -> float:
        return center_lon + rng.uniform(-half, half)

    def rand_tier() -> Tier:
        return Tier(rng.randint(0, len(Tier) - 1))

    # ── Squads ──────────────────────────────────────────────────────────
    squads: list[Squad] = []
    total_players = 0
    lo, hi = squad_size_range
    for i in range(n_squads):
        size = rng.randint(lo, hi)
        total_players += size
        squads.append(Squad(
            id=f"S{i}",
            size=size,
            sport=sport,
            tier=rand_tier(),
            lat=rand_lat(),
            lon=rand_lon(),
            # squads can reach any room within 1.5× the area radius
            max_distance=area_radius_km * 1_500.0,  # metres
            start_time=0.0,
            end_time=86_400.0,  # available all day
        ))

    # ── Rooms ────────────────────────────────────────────────────────────
    if n_rooms == 0 or total_players == 0:
        return squads, []

    target_total_slots = max(1, int(total_players * contention_ratio))
    base_capacity = max(1, target_total_slots // n_rooms)
    remainder = target_total_slots - base_capacity * n_rooms

    rooms: list[Room] = []
    for j in range(n_rooms):
        capacity = base_capacity + (1 if j < remainder else 0)
        rooms.append(Room(
            id=f"R{j}",
            sport=sport,
            desired_tier=rand_tier(),
            lat=rand_lat(),
            lon=rand_lon(),
            capacity=capacity,
            match_time=rng.uniform(0.0, 86_400.0),
        ))

    return squads, rooms


def instance_summary(squads: list[Squad], rooms: list[Room]) -> str:
    """One-line human-readable summary of an instance."""
    total_players = sum(s.size for s in squads)
    total_slots = sum(r.capacity for r in rooms)
    ratio = (total_slots / total_players) if total_players else float("nan")
    return (
        f"{len(squads)} squads ({total_players} players) | "
        f"{len(rooms)} rooms ({total_slots} slots) | "
        f"ratio={ratio:.2f}"
    )
