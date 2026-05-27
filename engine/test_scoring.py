"""Tests for scoring.py.

The centerpiece is TestGreedyFailure, which encodes WHY this project
needs a real solver instead of greedy room-by-room assignment. Every
other test is a guardrail on the primitives that proof depends on.
"""
from __future__ import annotations

import math
from itertools import product

import pytest

from models import Squad, Room, Sport, Tier
from scoring import is_feasible, score, distance_cost, tier_cost


# ---------------------------------------------------------------------------
# Factories — keep test bodies focused on the property under test.
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
    end_time: float = 24.0,
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
    match_time: float = 12.0,
) -> Room:
    return Room(
        id=id, sport=sport, desired_tier=desired_tier,
        lat=lat, lon=lon, capacity=capacity, match_time=match_time,
    )


# ---------------------------------------------------------------------------
# Model validation
# ---------------------------------------------------------------------------

class TestSquadValidation:
    def test_size_below_minimum_rejected(self):
        with pytest.raises(ValueError, match="[Ss]ize"):
            make_squad(size=0)

    def test_size_above_maximum_rejected(self):
        with pytest.raises(ValueError, match="[Ss]ize"):
            make_squad(size=11)

    def test_size_boundaries_accepted(self):
        make_squad(size=1)
        make_squad(size=10)

    def test_negative_max_distance_rejected(self):
        with pytest.raises(ValueError, match="max distance"):
            make_squad(max_distance=-1.0)

    def test_inverted_time_window_rejected(self):
        with pytest.raises(ValueError, match="[Ss]tart time"):
            make_squad(start_time=15.0, end_time=10.0)


class TestRoomValidation:
    def test_zero_capacity_rejected(self):
        with pytest.raises(ValueError, match="capacity"):
            make_room(capacity=0)


# ---------------------------------------------------------------------------
# is_feasible — exercise each rejection branch + boundaries
# ---------------------------------------------------------------------------

class TestIsFeasible:
    def test_sport_mismatch_rejects(self):
        sq = make_squad(sport=Sport.FOOTBALL)
        rm = make_room(sport=Sport.BASKETBALL)
        assert is_feasible(sq, rm) is False

    def test_squad_larger_than_capacity_rejects(self):
        assert is_feasible(make_squad(size=5), make_room(capacity=4)) is False

    def test_match_before_window_rejects(self):
        sq = make_squad(start_time=10.0, end_time=20.0)
        assert is_feasible(sq, make_room(match_time=8.0)) is False

    def test_match_after_window_rejects(self):
        sq = make_squad(start_time=10.0, end_time=20.0)
        assert is_feasible(sq, make_room(match_time=22.0)) is False

    def test_match_at_window_boundaries_accepted(self):
        sq = make_squad(start_time=10.0, end_time=20.0)
        assert is_feasible(sq, make_room(match_time=10.0)) is True
        assert is_feasible(sq, make_room(match_time=20.0)) is True

    def test_distance_exceeds_max_rejects(self):
        # Room is ~2 km away, max_distance is 1 km
        sq = make_squad(lat=0.0, lon=0.0, max_distance=1_000.0)
        rm = make_room(lat=0.0, lon=0.018)
        assert is_feasible(sq, rm) is False

    def test_all_conditions_met_accepted(self):
        assert is_feasible(make_squad(), make_room()) is True


# ---------------------------------------------------------------------------
# distance_cost / tier_cost in isolation
# ---------------------------------------------------------------------------

class TestDistanceCost:
    def test_same_location_returns_zero(self):
        sq = make_squad(lat=12.97, lon=77.59, max_distance=10_000)
        rm = make_room(lat=12.97, lon=77.59)
        assert distance_cost(sq, rm) == pytest.approx(0.0)

    def test_at_max_distance_returns_one(self):
        # 0.0090° lon at equator ≈ 1001 m
        sq = make_squad(lat=0.0, lon=0.0, max_distance=1001.6)
        rm = make_room(lat=0.0, lon=0.0090)
        assert distance_cost(sq, rm) == pytest.approx(1.0, rel=1e-3)


class TestTierCost:
    def test_same_tier_returns_zero(self):
        sq = make_squad(tier=Tier.INTERMEDIATE)
        rm = make_room(desired_tier=Tier.INTERMEDIATE)
        assert tier_cost(sq, rm) == 0.0

    def test_adjacent_tier_returns_half(self):
        sq = make_squad(tier=Tier.BEGINNER)
        rm = make_room(desired_tier=Tier.INTERMEDIATE)
        assert tier_cost(sq, rm) == pytest.approx(0.5)

    def test_maximum_tier_gap_returns_one(self):
        sq = make_squad(tier=Tier.BEGINNER)
        rm = make_room(desired_tier=Tier.COMPETITIVE)
        assert tier_cost(sq, rm) == pytest.approx(1.0)


# ---------------------------------------------------------------------------
# score — composition of the two costs + infeasibility sentinel
# ---------------------------------------------------------------------------

class TestScore:
    def test_infeasible_returns_inf(self):
        sq = make_squad(sport=Sport.FOOTBALL)
        rm = make_room(sport=Sport.TENNIS)
        assert score(sq, rm) == math.inf

    def test_perfect_match_is_zero(self):
        sq = make_squad(lat=0.0, lon=0.0, tier=Tier.INTERMEDIATE)
        rm = make_room(lat=0.0, lon=0.0, desired_tier=Tier.INTERMEDIATE)
        assert score(sq, rm) == pytest.approx(0.0)

    def test_worst_feasible_equals_w_dist_plus_w_tier(self):
        # distance ratio = 1, tier gap = 1 → default score = 0.7 + 0.3 = 1.0
        sq = make_squad(lat=0.0, lon=0.0, max_distance=1001.6, tier=Tier.BEGINNER)
        rm = make_room(lat=0.0, lon=0.0090, desired_tier=Tier.COMPETITIVE)
        assert score(sq, rm) == pytest.approx(1.0, rel=1e-3)

    def test_custom_weights_respected(self):
        # distance ratio = 1, tier gap = 0; w_dist=0.5 → score = 0.5
        sq = make_squad(lat=0.0, lon=0.0, max_distance=1001.6, tier=Tier.INTERMEDIATE)
        rm = make_room(lat=0.0, lon=0.0090, desired_tier=Tier.INTERMEDIATE)
        assert score(sq, rm, w_dist=0.5, w_tier=0.5) == pytest.approx(0.5, rel=1e-3)


# ---------------------------------------------------------------------------
# Greedy-failure proof — justification for the whole solver
# ---------------------------------------------------------------------------

def _greedy_assign(squads, rooms):
    """Process squads in order; each picks lowest-score feasible room
    with remaining capacity. Ties broken by lower room index.
    Returns (assignment, total_cost) or (None, inf) if any squad cannot fit.
    """
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


def _optimal_assign(squads, rooms):
    """Brute-force enumeration over every squad→room mapping. Only valid
    for tiny fixtures — here, 2^3 = 8 candidates.
    """
    best_candidate, best_cost = None, math.inf
    for candidate in product(range(len(rooms)), repeat=len(squads)):
        room_usage = [0] * len(rooms)
        cost = 0.0
        ok = True
        for sq_idx, room_idx in enumerate(candidate):
            sq, rm = squads[sq_idx], rooms[room_idx]
            if not is_feasible(sq, rm) or room_usage[room_idx] + sq.size > rm.capacity:
                ok = False
                break
            room_usage[room_idx] += sq.size
            cost += score(sq, rm)
        if ok and cost < best_cost:
            best_cost = cost
            best_candidate = candidate
    return best_candidate, best_cost


class TestGreedyFailure:
    """The construction:

    Two rooms ~9 km apart on the equator, equal capacity 2:
      - R1 at (0, 0)
      - R2 at (0, 0.0810)  → ~9 km east

    Three squads (all same sport, same tier so tier cost is zero — distance
    is the sole discriminator):
      - S1, S2: size 1, at (0, 0.0400)   → ~4.45 km to R1, ~4.56 km to R2
      - S3:     size 2, at (0, -0.0090)  → ~1.00 km to R1, ~10.00 km to R2

    Greedy processes S1 first: R1 is marginally closer, so S1 → R1.
    Same for S2 → R1, which fills R1. S3 is then forced to R2 (~10 km).

    Optimal sees that S3's penalty for taking R2 (10 km) dwarfs S1 and S2's
    combined penalty for taking R2 over R1 (~0.1 km × 2). It places S3 in
    R1 and pushes S1, S2 to R2.

    Expected ratio: greedy_cost / optimal_cost ≈ 1.87.

    The structural lesson: locally optimal early choices by flexible squads
    consume capacity that a later, more constrained squad needs much more.
    No order-of-processing greedy can see this, because the cost of the
    wrong choice only becomes visible later in the sequence. This is the
    capacity-coupled assignment problem CP-SAT is built for.
    """

    @pytest.fixture
    def fixture(self):
        r1 = make_room(id="R1", lat=0.0, lon=0.0,    capacity=2)
        r2 = make_room(id="R2", lat=0.0, lon=0.0810, capacity=2)
        s1 = make_squad(id="S1", size=1, lat=0.0, lon=0.0400)
        s2 = make_squad(id="S2", size=1, lat=0.0, lon=0.0400)
        s3 = make_squad(id="S3", size=2, lat=0.0, lon=-0.0090)
        return [s1, s2, s3], [r1, r2]

    def test_greedy_traps_flexible_squads_in_R1(self, fixture):
        squads, rooms = fixture
        assignment, _ = _greedy_assign(squads, rooms)
        # S1→R1 (idx 0), S2→R1 (idx 0), S3→R2 (idx 1)
        assert assignment == [0, 0, 1]

    def test_optimal_gives_R1_to_the_constrained_squad(self, fixture):
        squads, rooms = fixture
        candidate, _ = _optimal_assign(squads, rooms)
        # S1→R2, S2→R2, S3→R1
        assert candidate == (1, 1, 0)

    def test_greedy_is_strictly_worse_than_optimal(self, fixture):
        squads, rooms = fixture
        _, greedy_cost = _greedy_assign(squads, rooms)
        _, opt_cost = _optimal_assign(squads, rooms)

        assert opt_cost < greedy_cost
        # Documented ratio is ~1.87x; assert a conservative lower bound
        # so floating-point drift in haversine never flakes this.
        assert greedy_cost / opt_cost > 1.5
