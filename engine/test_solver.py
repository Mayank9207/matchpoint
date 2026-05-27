"""Tests for solver.py (oracle).

Four behavioural contracts are verified:

1. Edge inputs  — empty squads or rooms return a safe no-op.
2. No feasible pairs  — all sport-mismatched, oracle returns empty.
3. Player-count priority — oracle assigns the larger squad even when the
   smaller one has lower cost.  (A pure cost-minimiser would get this wrong.)
4. Cost tie-breaking — when two assignments match the same number of players,
   oracle chooses the lower-cost one.
5. Greedy-failure — on the canonical 3-squad / 2-room fixture from
   test_scoring.py the oracle's cost is strictly below greedy's cost and
   every player is matched.
"""
from __future__ import annotations

import math

import pytest

from models import Squad, Room, Sport, Tier
from scoring import is_feasible, score
from solver import solve_oracle


# ---------------------------------------------------------------------------
# Shared factories (same defaults as test_scoring.py so fixtures compose)
# ---------------------------------------------------------------------------

def make_squad(
    id: str = "S",
    size: int = 2,
    sport: Sport = Sport.FOOTBALL,
    tier: Tier = Tier.INTERMEDIATE,
    lat: float = 0.0,
    lon: float = 0.0,
    max_distance: float = 50_000.0,
    start_time: float = 0.0,
    end_time: float = 86_400.0,
) -> Squad:
    return Squad(
        id=id, size=size, sport=sport, tier=tier,
        lat=lat, lon=lon, max_distance=max_distance,
        start_time=start_time, end_time=end_time,
    )


def make_room(
    id: str = "R",
    sport: Sport = Sport.FOOTBALL,
    desired_tier: Tier = Tier.INTERMEDIATE,
    lat: float = 0.0,
    lon: float = 0.0,
    capacity: int = 4,
    match_time: float = 43_200.0,   # noon in seconds-from-midnight
) -> Room:
    return Room(
        id=id, sport=sport, desired_tier=desired_tier,
        lat=lat, lon=lon, capacity=capacity, match_time=match_time,
    )


# ---------------------------------------------------------------------------
# 1. Edge inputs
# ---------------------------------------------------------------------------

class TestOracleEdgeInputs:
    def test_no_squads_returns_empty(self):
        assignment, cost = solve_oracle([], [make_room()])
        assert assignment == {}
        assert cost == 0.0

    def test_no_rooms_returns_empty(self):
        assignment, cost = solve_oracle([make_squad()], [])
        assert assignment == {}
        assert cost == 0.0

    def test_both_empty_returns_empty(self):
        assignment, cost = solve_oracle([], [])
        assert assignment == {}
        assert cost == 0.0


# ---------------------------------------------------------------------------
# 2. No feasible pairs
# ---------------------------------------------------------------------------

class TestOracleNoFeasible:
    def test_sport_mismatch_returns_empty(self):
        sq = make_squad(sport=Sport.FOOTBALL)
        rm = make_room(sport=Sport.BASKETBALL)
        assignment, cost = solve_oracle([sq], [rm])
        assert assignment == {}
        assert cost == 0.0

    def test_capacity_too_small_returns_empty(self):
        sq = make_squad(size=5)
        rm = make_room(capacity=4)
        assignment, cost = solve_oracle([sq], [rm])
        assert assignment == {}
        assert cost == 0.0

    def test_time_outside_window_returns_empty(self):
        sq = make_squad(start_time=0.0, end_time=3_600.0)
        rm = make_room(match_time=7_200.0)  # 2 h after window closes
        assignment, cost = solve_oracle([sq], [rm])
        assert assignment == {}
        assert cost == 0.0


# ---------------------------------------------------------------------------
# 3. Player-count priority
#
# Construction:
#   R1: capacity 2
#   S_big:   size 2, far from R1  → dist cost ≈ 0.70 (barely feasible)
#   S_small: size 1, very close   → dist cost ≈ 0.00
#
# S_big + S_small together would need 3 slots (> 2), so exactly one fits.
# A pure cost-minimiser picks S_small (cost 0.00 vs 0.70).
# The oracle picks S_big (2 matched players > 1).
# ---------------------------------------------------------------------------

class TestOracleMaximisesPlayers:
    @pytest.fixture
    def fixture(self):
        # 0.0090° lon at equator ≈ 1001 m — used as the "max distance" value
        rm   = make_room(id="R1", lat=0.0, lon=0.0, capacity=2)
        s_big   = make_squad(id="S_big",   size=2, lat=0.0, lon=0.0090, max_distance=1_001.6)
        s_small = make_squad(id="S_small", size=1, lat=0.0, lon=0.0001, max_distance=50_000.0)
        return s_big, s_small, rm

    def test_oracle_picks_larger_squad(self, fixture):
        s_big, s_small, rm = fixture
        assignment, _ = solve_oracle([s_big, s_small], [rm])
        # squad index 0 is s_big; it must be the one assigned
        assert assignment == {0: 0}, (
            "Oracle should assign s_big (2 players) not s_small (1 player)"
        )

    def test_oracle_matched_count_is_two(self, fixture):
        s_big, s_small, rm = fixture
        assignment, _ = solve_oracle([s_big, s_small], [rm])
        matched_players = sum([s_big, s_small][i].size for i in assignment)
        assert matched_players == 2

    def test_cost_of_small_is_lower_than_big(self, fixture):
        # Confirm the fixture is actually discriminating: small really is cheaper.
        s_big, s_small, rm = fixture
        assert score(s_small, rm) < score(s_big, rm)


# ---------------------------------------------------------------------------
# 4. Cost tie-breaking (same matched players, lower cost wins)
#
# Construction:
#   R1: capacity 3
#   S_far:  size 3, far  → fills R1 alone, high cost
#   S_a/b/c: size 1 each, very close → together fill R1, low cost
#
# Both options match 3 players. Oracle picks S_a + S_b + S_c (lower cost).
# ---------------------------------------------------------------------------

class TestOracleCostTieBreaking:
    @pytest.fixture
    def fixture(self):
        rm   = make_room(id="R1", lat=0.0, lon=0.0, capacity=3)
        s_far = make_squad(id="S_far", size=3, lat=0.0, lon=0.0090, max_distance=1_001.6)
        s_a   = make_squad(id="S_a",   size=1, lat=0.0, lon=0.0001, max_distance=50_000.0)
        s_b   = make_squad(id="S_b",   size=1, lat=0.0, lon=0.0001, max_distance=50_000.0)
        s_c   = make_squad(id="S_c",   size=1, lat=0.0, lon=0.0001, max_distance=50_000.0)
        return s_far, s_a, s_b, s_c, rm

    def test_oracle_picks_low_cost_trio(self, fixture):
        s_far, s_a, s_b, s_c, rm = fixture
        assignment, _ = solve_oracle([s_far, s_a, s_b, s_c], [rm])
        # Indices 1, 2, 3 are s_a, s_b, s_c; index 0 is s_far.
        assert 0 not in assignment, "S_far (high cost) should not be assigned"
        assert assignment == {1: 0, 2: 0, 3: 0}

    def test_oracle_total_cost_below_far_squad_cost(self, fixture):
        s_far, s_a, s_b, s_c, rm = fixture
        _, trio_cost = solve_oracle([s_far, s_a, s_b, s_c], [rm])
        far_cost = score(s_far, rm)
        assert trio_cost < far_cost


# ---------------------------------------------------------------------------
# 5. Greedy-failure fixture
#
# Exact numbers from TestGreedyFailure in test_scoring.py:
#   R1 (0, 0.0000), capacity 2
#   R2 (0, 0.0810), capacity 2   — ~9 km east
#   S1 (0, 0.0400), size 1       — equidistant-ish, flexible
#   S2 (0, 0.0400), size 1       — same
#   S3 (0,-0.0090), size 2       — ~1 km from R1, ~10 km from R2
#
# Greedy: S1→R1, S2→R1, S3→R2  (S3 forced far, higher cost)
# Oracle: S1→R2, S2→R2, S3→R1  (all 4 players matched, lower total cost)
# ---------------------------------------------------------------------------

def _greedy_assign(squads, rooms):
    """Same reference greedy used in test_scoring.py."""
    room_usage = [0] * len(rooms)
    assignment = []
    total = 0.0
    for sq in squads:
        best_j, best_s = None, math.inf
        for j, rm in enumerate(rooms):
            if not is_feasible(sq, rm):
                continue
            if room_usage[j] + sq.size > rm.capacity:
                continue
            s = score(sq, rm)
            if s < best_s:
                best_s = s
                best_j = j
        if best_j is None:
            return None, math.inf
        assignment.append(best_j)
        room_usage[best_j] += sq.size
        total += best_s
    return assignment, total


class TestOracleGreedyFailure:
    @pytest.fixture
    def fixture(self):
        r1 = make_room(id="R1", lat=0.0, lon=0.0000, capacity=2)
        r2 = make_room(id="R2", lat=0.0, lon=0.0810, capacity=2)
        s1 = make_squad(id="S1", size=1, lat=0.0, lon=0.0400)
        s2 = make_squad(id="S2", size=1, lat=0.0, lon=0.0400)
        s3 = make_squad(id="S3", size=2, lat=0.0, lon=-0.0090)
        return [s1, s2, s3], [r1, r2]

    def test_oracle_matches_all_four_players(self, fixture):
        squads, rooms = fixture
        assignment, _ = solve_oracle(squads, rooms)
        matched = sum(squads[i].size for i in assignment)
        assert matched == 4

    def test_oracle_places_s3_in_r1(self, fixture):
        squads, rooms = fixture
        assignment, _ = solve_oracle(squads, rooms)
        # Squad index 2 is S3; room index 0 is R1.
        assert assignment.get(2) == 0, "S3 (constrained squad) must go to R1"

    def test_oracle_places_s1_and_s2_in_r2(self, fixture):
        squads, rooms = fixture
        assignment, _ = solve_oracle(squads, rooms)
        assert assignment.get(0) == 1, "S1 should be in R2"
        assert assignment.get(1) == 1, "S2 should be in R2"

    def test_oracle_cost_strictly_below_greedy(self, fixture):
        squads, rooms = fixture
        _, oracle_cost = solve_oracle(squads, rooms)
        _, greedy_cost = _greedy_assign(squads, rooms)
        assert oracle_cost < greedy_cost

    def test_greedy_is_at_least_1_point_5x_worse(self, fixture):
        squads, rooms = fixture
        _, oracle_cost = solve_oracle(squads, rooms)
        _, greedy_cost = _greedy_assign(squads, rooms)
        assert greedy_cost / oracle_cost > 1.5


# Append to test_solver.py

import random  # for the determinism test
from solver import solve_heuristic
# is_feasible and score are already imported

# Reuse the existing make_squad and make_room factories from this file.
# If they're in a different module, import them; otherwise they're available.


class TestHeuristicInvariants:
    """Properties solve_heuristic must satisfy on every input."""

    def _assignment_is_legal(self, assignment, squads, rooms):
        """Helper: verify the four contracts of a valid assignment."""
        # Every assigned pair must be feasible per scoring.py's rules.
        for sq_idx, rm_idx in assignment.items():
            assert is_feasible(squads[sq_idx], rooms[rm_idx]), (
                f"Infeasible pair: S{sq_idx} -> R{rm_idx}"
            )

        # No room may exceed its capacity.
        room_usage = [0] * len(rooms)
        for sq_idx, rm_idx in assignment.items():
            room_usage[rm_idx] += squads[sq_idx].size
        for j, rm in enumerate(rooms):
            assert room_usage[j] <= rm.capacity, (
                f"Room R{j} overflowed: {room_usage[j]} > {rm.capacity}"
            )

        # Every squad appears at most once (dict structure enforces this,
        # but assert explicitly so future refactors can't silently break it).
        assert len(assignment) == len(set(assignment.keys()))

    def test_empty_inputs_return_empty(self):
        assignment, cost = solve_heuristic([], [])
        assert assignment == {}
        assert cost == 0.0

        assignment, cost = solve_heuristic([], [make_room()])
        assert assignment == {}

        assignment, cost = solve_heuristic([make_squad()], [])
        assert assignment == {}

    def test_no_feasible_pairs_returns_empty(self):
        # Sport mismatch: nothing should be assigned.
        sq = make_squad(sport=Sport.FOOTBALL)
        rm = make_room(sport=Sport.BASKETBALL)
        assignment, cost = solve_heuristic([sq], [rm])
        assert assignment == {}
        assert cost == 0.0

    def test_output_is_always_legal(self):
        """Generate a varied instance, verify every contract holds."""
        # Hand-built fixture with mixed feasibility so the heuristic has
        # real work to do. Two rooms, four squads of varied sizes.
        r1 = make_room(id="R1", lat=0.0, lon=0.0,    capacity=4)
        r2 = make_room(id="R2", lat=0.0, lon=0.0090, capacity=3)
        squads = [
            make_squad(id="S1", size=3, lat=0.0, lon=0.0001, max_distance=50_000),
            make_squad(id="S2", size=2, lat=0.0, lon=0.0050, max_distance=50_000),
            make_squad(id="S3", size=1, lat=0.0, lon=0.0080, max_distance=50_000),
            make_squad(id="S4", size=4, lat=0.0, lon=0.0003, max_distance=50_000),
        ]
        rooms = [r1, r2]

        assignment, cost = solve_heuristic(squads, rooms)
        self._assignment_is_legal(assignment, squads, rooms)

    def test_deterministic_across_calls(self):
        """Same input must produce the same output on every call.

        This guards against accidental introduction of unordered iteration
        (dict.items() in older Pythons, set iteration, hash-dependent
        ordering). The heuristic touches collections in inner loops;
        any non-determinism here will silently break benchmarks.
        """
        r1 = make_room(id="R1", lat=0.0, lon=0.0,    capacity=3)
        r2 = make_room(id="R2", lat=0.0, lon=0.0090, capacity=3)
        squads = [
            make_squad(id="S1", size=2, lat=0.0, lon=0.0001, max_distance=50_000),
            make_squad(id="S2", size=2, lat=0.0, lon=0.0050, max_distance=50_000),
            make_squad(id="S3", size=1, lat=0.0, lon=0.0080, max_distance=50_000),
        ]
        rooms = [r1, r2]

        results = [solve_heuristic(squads, rooms) for _ in range(5)]
        first_assn, first_cost = results[0]
        for assn, cost in results[1:]:
            assert assn == first_assn
            assert cost == first_cost

    def test_greedy_failure_fixture_matches_oracle(self):
        """On the canonical fixture, heuristic must hit the oracle's
        player count. Cost should equal oracle's (this is a small enough
        case that FFD + swap finds the optimum).
        """
        r1 = make_room(id="R1", lat=0.0, lon=0.0,    capacity=2)
        r2 = make_room(id="R2", lat=0.0, lon=0.0810, capacity=2)
        squads = [
            make_squad(id="S1", size=1, lat=0.0, lon=0.0400),
            make_squad(id="S2", size=1, lat=0.0, lon=0.0400),
            make_squad(id="S3", size=2, lat=0.0, lon=-0.0090),
        ]
        rooms = [r1, r2]

        oracle_assn, oracle_cost = solve_oracle(squads, rooms)
        heur_assn, heur_cost = solve_heuristic(squads, rooms)

        oracle_matched = sum(squads[i].size for i in oracle_assn)
        heur_matched = sum(squads[i].size for i in heur_assn)
        assert heur_matched == oracle_matched

        # On a 3-squad/2-room instance, FFD + swap should find the optimum.
        # If this ever flakes, it means Phase C isn't converging — which is
        # the loud signal we want, not a soft assertion to mask.
        assert heur_cost == pytest.approx(oracle_cost, rel=1e-6)