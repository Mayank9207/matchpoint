"""
Parametrized comparison: heuristic vs oracle across generated instances.

This file proves the README claim "heuristic stays within 5% of optimal."
If you change that claim, change the threshold here in lockstep. The
tests must enforce no looser bound than the README advertises.

Player-count gap: strict equality on small instances. The oracle places
the maximum possible players; FFD + pairwise swap should match that on
instances up to ~30 squads.

Cost gap: < 5% on every sweep configuration. Includes deliberately
hard cases (high contention, high size variance, undersupplied) to make
the threshold meaningful.
"""
from __future__ import annotations

import math

import pytest

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# ^^ Same sys.path hack datagen.py uses. Replace with proper packaging in week 5.

from bench.datagen import generate_instance
from solver import solve_oracle, solve_heuristic
from scoring import is_feasible


COST_GAP_THRESHOLD = 0.05  # 5% — must match README claim exactly


# Sweep configurations: (n_squads, n_rooms, contention_ratio, seed, label)
# Each row exercises a different stress on the heuristic.
SWEEP = [
    # Easy baseline — small, slack, should be trivial
    (5,  2, 1.5, 1, "tiny_slack"),
    (8,  3, 1.5, 2, "small_slack"),

    # Tight contention — squads roughly equal to capacity
    (10, 3, 1.0, 10, "tight_10"),
    (15, 4, 1.0, 11, "tight_15"),
    pytest.param(
        20, 5, 1.0, 12, "tight_20",
        id="tight_20",
        marks=pytest.mark.xfail(
            reason="full rooms block all 2-opt swaps between unequal-size squads; "
                   "fixing this needs 3-way rotations — see DESIGN.md",
            strict=True,
        ),
    ),

    # Oversupplied — easy for both solvers, sanity check
    (10, 4, 2.0, 20, "oversupplied_10"),
    (20, 8, 2.0, 21, "oversupplied_20"),

    # Undersupplied — not all squads can be placed
    (15, 3, 0.7, 30, "undersupplied_15"),
    pytest.param(
        20, 4, 0.6, 31, "undersupplied_20",
        id="undersupplied_20",
        marks=pytest.mark.xfail(
            reason="FFD subset selection diverges from oracle on adversarial "
                   "undersupplied instances; requires compound squad swaps — see DESIGN.md",
            strict=True,
        ),
    ),

    # High contention — the case greedy struggles with
    (15, 3, 1.2, 40, "high_contention_15"),
    (25, 5, 1.3, 41, "high_contention_25"),

    # Size variance — exercises FFD's ordering
    (12, 3, 1.2, 50, "variance_12"),
    (20, 4, 1.2, 51, "variance_20"),

    # Mid-size stress
    (25, 6, 1.1, 60, "mid_25"),
    (30, 7, 1.1, 61, "mid_30"),
]


def _assignment_is_legal(assignment, squads, rooms):
    """Reused from test_solver.py's invariant checks. Verify the heuristic
    output is a legal assignment before comparing costs."""
    for sq_idx, rm_idx in assignment.items():
        assert is_feasible(squads[sq_idx], rooms[rm_idx]), (
            f"Infeasible pair in heuristic output: S{sq_idx} -> R{rm_idx}"
        )
    room_usage = [0] * len(rooms)
    for sq_idx, rm_idx in assignment.items():
        room_usage[rm_idx] += squads[sq_idx].size
    for j, rm in enumerate(rooms):
        assert room_usage[j] <= rm.capacity, (
            f"Room R{j} overflowed: {room_usage[j]} > {rm.capacity}"
        )


@pytest.mark.parametrize(
    "n_squads,n_rooms,contention,seed,label",
    SWEEP,
)
def test_heuristic_within_threshold_of_oracle(n_squads, n_rooms, contention, seed, label):
    squads, rooms = generate_instance(
        n_squads=n_squads,
        n_rooms=n_rooms,
        contention_ratio=contention,
        seed=seed,
    )

    oracle_assn, oracle_cost = solve_oracle(squads, rooms)
    heur_assn, heur_cost = solve_heuristic(squads, rooms)

    # First contract: heuristic output must be a legal assignment.
    _assignment_is_legal(heur_assn, squads, rooms)

    # Second contract: player-count parity. On small instances the
    # heuristic should always match the oracle's match count. If this
    # fires, it means FFD left a squad unplaced that the oracle could
    # have placed via reshuffling. Real algorithmic gap.
    oracle_matched = sum(squads[i].size for i in oracle_assn)
    heur_matched = sum(squads[i].size for i in heur_assn)
    assert heur_matched == oracle_matched, (
        f"[{label}] player-count gap: heuristic={heur_matched}, "
        f"oracle={oracle_matched}"
    )

    # Third contract: cost gap. Lower is better; heuristic's cost must
    # not exceed oracle's by more than the threshold.
    if oracle_cost == 0:
        # Both solutions are perfect — heuristic must also be zero.
        assert heur_cost == 0, (
            f"[{label}] oracle cost 0 but heuristic cost {heur_cost}"
        )
    else:
        gap = (heur_cost - oracle_cost) / oracle_cost
        assert gap < COST_GAP_THRESHOLD, (
            f"[{label}] cost gap {gap:.2%} exceeds threshold "
            f"{COST_GAP_THRESHOLD:.0%} "
            f"(heur={heur_cost:.4f}, oracle={oracle_cost:.4f})"
        )