"""Bridge between the API layer and the compiled C++ matching engine.

This module lives at ``engine/backend/app/matches/solver_bridge.py``. The
compiled pybind11 extension and the engine's Python dataclasses live higher up
in the ``engine/`` tree, so we resolve those paths relative to this file rather
than relying on the package being importable from the current working dir.

Resolved layout::

    engine/                      <- ENGINE_ROOT (parents[3])
    ├── models.py                <- Squad / Room / Sport / Tier
    ├── cpp/build/solver_cpp*.so <- compiled extension (import solver_cpp)
    └── backend/app/matches/solver_bridge.py  <- this file
"""
from __future__ import annotations

import sys
from pathlib import Path

from app.matches.models import MatchRequest, MatchResponse, RoomInfo
from app.squads.models import SquadResponse

# --- Locate the engine and its compiled extension --------------------------
ENGINE_ROOT = Path(__file__).resolve().parents[3]
_CPP_BUILD = ENGINE_ROOT / "cpp" / "build"

for _p in (str(ENGINE_ROOT), str(_CPP_BUILD)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

# Engine dataclasses — the solver reads attributes off these via duck typing.
from models import Room as EngineRoom  # noqa: E402
from models import Sport, Tier  # noqa: E402
from models import Squad as EngineSquad  # noqa: E402

# Compiled pybind11 module: solve_heuristic_cpp(squads, rooms, w_dist, w_tier, max_iter)
import solver_cpp  # type: ignore  # noqa: E402


def _to_engine_squad(squad: SquadResponse) -> EngineSquad:
    """Convert an API SquadResponse into the engine's Squad dataclass."""
    # TODO: implement
    raise NotImplementedError


def _to_engine_room(room: RoomInfo) -> EngineRoom:
    """Convert an API RoomInfo into the engine's Room dataclass."""
    # TODO: implement
    raise NotImplementedError


def find_match(
    squads: list[SquadResponse],
    rooms: list[RoomInfo],
    request: MatchRequest | None = None,
) -> MatchResponse:
    """Run the C++ heuristic solver and shape the result as a MatchResponse.

    Converts the API models to the engine's ``Squad``/``Room`` dataclasses,
    calls ``solver_cpp.solve_heuristic_cpp``, then maps the returned
    ``(assignment, total_cost)`` back into a ``MatchResponse``.
    """
    # TODO: implement
    raise NotImplementedError
