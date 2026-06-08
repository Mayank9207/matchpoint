"""
Cross-language equivalence test: Python solve_heuristic vs C++ solve_heuristic_cpp.

The C++ module (solver_cpp) is expected to be absent until the port is written;
this file will fail at import time until cpp/build/solver_cpp.so is present.

# !! IMPORTANT — ASSIGNMENT KEY TYPE !!
# solve_heuristic returns dict[int, int]: keys are INTEGER INDICES (0-based
# positions in the squads list), values are INTEGER INDICES into rooms list.
# The string .id fields ("S0", "R2", etc.) are NOT used as keys.
# The C++ boundary therefore only needs to exchange index arrays — no string
# mapping required.  If the C++ port ever changes this to string keys, update
# the assertion and the comment above.
"""
from __future__ import annotations

import os
import sys

import pytest

# Add cpp/build so solver_cpp can be found.  Fails at collection time if the
# extension hasn't been built yet — that is intentional.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "cpp", "build"))
# Match the path convention used by the rest of the engine test suite.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bench.datagen import generate_instance   # noqa: E402
from solver import solve_heuristic            # noqa: E402
import solver_cpp                             # noqa: E402 — fails until C++ port built


# ---------------------------------------------------------------------------
# Parametrized configs: (n_squads, n_rooms, contention_ratio, seed)
# Seeds start at 200 to avoid collisions with test_solver_vs_oracle.py (1-61).
# ---------------------------------------------------------------------------
CONFIGS = [
    # Slack regime — plenty of room capacity, should be easy to match
    pytest.param(5,  3,  2.0, 201, id="slack_small"),
    pytest.param(10, 5,  1.8, 202, id="slack_medium"),
    pytest.param(20, 8,  1.6, 203, id="slack_large"),

    # Tight regime — total slots ≈ total players, every player matters
    pytest.param(8,  4,  1.0, 204, id="tight_small"),
    pytest.param(20, 7,  1.0, 205, id="tight_large"),

    # Undersupplied — cannot fit all squads; solver must maximise players placed
    pytest.param(10, 4,  0.7, 206, id="undersupplied_small"),
    pytest.param(20, 5,  0.6, 207, id="undersupplied_large"),

    # Mid-contention — typical production regime
    pytest.param(12, 5,  1.3, 208, id="mid_contention_small"),
    pytest.param(25, 8,  1.2, 209, id="mid_contention_large"),

    # Edge case — empty instance, both solvers must return ({}, 0.0)
    pytest.param(0,  0,  1.0, 210, id="empty"),
]

# Weights used for both solvers; must be identical so outputs are comparable.
_W_DIST = 0.7
_W_TIER = 0.3   # NOTE: solve_heuristic uses w_tier, NOT w_skill (oracle differs)
_MAX_ITER = 100


@pytest.mark.parametrize("n_squads,n_rooms,contention_ratio,seed", CONFIGS)
def test_cpp_matches_python(n_squads, n_rooms, contention_ratio, seed):
    """C++ solver must produce a byte-identical assignment and equal cost."""
    squads, rooms = generate_instance(
        n_squads=n_squads,
        n_rooms=n_rooms,
        seed=seed,
        contention_ratio=contention_ratio,
    )

    py_assignment, py_cost = solve_heuristic(
        squads, rooms,
        w_dist=_W_DIST,
        w_tier=_W_TIER,
        max_iter=_MAX_ITER,
    )

    cpp_assignment, cpp_cost = solver_cpp.solve_heuristic_cpp(
        squads, rooms,
        w_dist=_W_DIST,
        w_tier=_W_TIER,
        max_iter=_MAX_ITER,
    )

    config_tag = (
        f"n_squads={n_squads}, n_rooms={n_rooms}, "
        f"contention_ratio={contention_ratio}, seed={seed}"
    )

    if py_assignment != cpp_assignment:
        print(f"\n[ASSIGNMENT DIVERGENCE] config=({config_tag})")
        print(f"  Python : {py_assignment}")
        print(f"  C++    : {cpp_assignment}")
        all_keys = sorted(set(py_assignment) | set(cpp_assignment))
        for k in all_keys:
            pv = py_assignment.get(k, "<unassigned>")
            cv = cpp_assignment.get(k, "<unassigned>")
            if pv != cv:
                print(f"    squad[{k}]: Python→room[{pv}]  C++→room[{cv}]")

    assert py_assignment == cpp_assignment, (
        f"Assignment mismatch ({config_tag})\n"
        f"Python: {py_assignment}\n"
        f"C++:    {cpp_assignment}"
    )

    assert py_cost == pytest.approx(cpp_cost, rel=1e-12), (
        f"Cost mismatch ({config_tag}): Python={py_cost!r}, C++={cpp_cost!r}"
    )
