from __future__ import annotations

import sys
from pathlib import Path

from app.matches.models import MatchRequest, MatchResponse, RoomInfo

ENGINE_ROOT = Path(__file__).resolve().parents[3]
_CPP_BUILD = ENGINE_ROOT / "cpp" / "build"

for _p in (str(ENGINE_ROOT), str(_CPP_BUILD)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from models import Room as EngineRoom  # noqa: E402
from models import Sport, Tier  # noqa: E402
from models import Squad as EngineSquad  # noqa: E402
from scoring import score  # noqa: E402
from utils import haversine_m  # noqa: E402

import solver_cpp  # type: ignore  # noqa: E402


def _to_engine_squad(doc: dict) -> EngineSquad:
    return EngineSquad(
        id=str(doc["_id"]),
        size=len(doc["members"]),
        sport=Sport(int(doc["sport"])),
        tier=Tier(int(doc["tier"])),
        lat=doc["lat"],
        lon=doc["lon"],
        max_distance=float(doc["max_distance"]),
        start_time=float(doc["start_time"]),
        end_time=float(doc["end_time"]),
    )


def _to_engine_room(doc: dict) -> EngineRoom:
    return EngineRoom(
        id=str(doc["_id"]),
        sport=Sport(int(doc["sport"])),
        desired_tier=Tier(int(doc["desired_tier"])),
        lat=doc["lat"],
        lon=doc["lon"],
        capacity=int(doc["capacity"]),
        match_time=float(doc["match_time"]),
    )


def find_match(
    squads: list[dict],
    rooms: list[dict],
    request: MatchRequest | None = None,
) -> list[MatchResponse]:
    if not squads or not rooms:
        return []

    w_dist = request.w_dist if request else 0.7
    w_tier = request.w_tier if request else 0.3
    max_iter = request.max_iter if request else 100

    eng_squads = [_to_engine_squad(s) for s in squads]
    eng_rooms = [_to_engine_room(r) for r in rooms]

    assignment, _total_cost = solver_cpp.solve_heuristic_cpp(
        eng_squads, eng_rooms, w_dist, w_tier, max_iter
    )

    results: list[MatchResponse] = []
    for squad_idx, room_idx in assignment.items():
        room_doc = rooms[room_idx]
        eng_s, eng_r = eng_squads[squad_idx], eng_rooms[room_idx]
        results.append(
            MatchResponse(
                match_id="",
                squad_id=str(squads[squad_idx]["_id"]),
                room=RoomInfo(
                    id=str(room_doc["_id"]),
                    sport=int(room_doc["sport"]),
                    desired_tier=int(room_doc["desired_tier"]),
                    lat=room_doc["lat"],
                    lon=room_doc["lon"],
                    capacity=int(room_doc["capacity"]),
                    match_time=float(room_doc["match_time"]),
                    image_url=room_doc.get("image_url"),
                    paid=bool(room_doc.get("paid", False)),
                    price=int(room_doc.get("price", 0)),
                ),
                distance_m=haversine_m(eng_s.lat, eng_s.lon, eng_r.lat, eng_r.lon),
                cost=score(eng_s, eng_r, w_dist, w_tier),
            )
        )
    return results
