"""Property tests for bench/datagen.py instance generator.

Three properties are verified:
(a) Reproducibility   — same seed always produces an identical instance.
(b) Contention knob   — higher contention_ratio gives more slots per player.
(c) Squad validity    — every generated squad has max_distance > 0 and
                        coordinates inside valid geographic ranges.
"""
from __future__ import annotations

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bench.datagen import generate_instance


# ---------------------------------------------------------------------------
# (a) Reproducibility
# ---------------------------------------------------------------------------

class TestReproducibility:
    def test_same_seed_identical_instance(self):
        inst1 = generate_instance(n_squads=12, n_rooms=4, seed=42)
        inst2 = generate_instance(n_squads=12, n_rooms=4, seed=42)
        assert inst1 == inst2

    def test_different_seeds_differ(self):
        squads_a, _ = generate_instance(n_squads=12, n_rooms=4, seed=1)
        squads_b, _ = generate_instance(n_squads=12, n_rooms=4, seed=2)
        lats_a = [s.lat for s in squads_a]
        lats_b = [s.lat for s in squads_b]
        # Two independent float sequences colliding is astronomically unlikely.
        assert lats_a != lats_b

    def test_global_random_state_unaffected(self):
        import random
        random.seed(99)
        before = random.random()
        random.seed(99)
        generate_instance(n_squads=20, n_rooms=5, seed=7)
        after = random.random()
        assert after == before, (
            "generate_instance must not touch global random state; "
            "it uses a local random.Random(seed) instance"
        )


# ---------------------------------------------------------------------------
# (b) Contention knob
# ---------------------------------------------------------------------------

class TestContentionRatioDirection:
    @staticmethod
    def _actual_ratio(squads, rooms) -> float:
        total_players = sum(s.size for s in squads)
        total_slots = sum(r.capacity for r in rooms)
        return total_slots / total_players

    def test_monotone_in_contention_ratio(self):
        # Same geometry and squad draws (same seed); only capacities change.
        base = dict(n_squads=15, n_rooms=4, seed=13)
        squads_lo, rooms_lo = generate_instance(**base, contention_ratio=0.8)
        squads_md, rooms_md = generate_instance(**base, contention_ratio=1.2)
        squads_hi, rooms_hi = generate_instance(**base, contention_ratio=2.0)

        r_lo = self._actual_ratio(squads_lo, rooms_lo)
        r_md = self._actual_ratio(squads_md, rooms_md)
        r_hi = self._actual_ratio(squads_hi, rooms_hi)

        assert r_lo < r_md < r_hi

    def test_actual_ratio_close_to_requested(self):
        # The only deviation is integer rounding of capacities; for n_squads=20
        # (total_players ≈ 35–40) the relative error is well under 5%.
        for requested in (0.7, 1.0, 1.5, 2.0):
            squads, rooms = generate_instance(
                n_squads=20, n_rooms=5, seed=7, contention_ratio=requested
            )
            actual = self._actual_ratio(squads, rooms)
            assert abs(actual - requested) / requested < 0.10, (
                f"contention_ratio={requested}: actual ratio {actual:.3f} "
                f"deviates more than 10% from requested"
            )

    def test_undersupplied_has_fewer_slots_than_players(self):
        squads, rooms = generate_instance(
            n_squads=15, n_rooms=4, seed=5, contention_ratio=0.7
        )
        total_players = sum(s.size for s in squads)
        total_slots = sum(r.capacity for r in rooms)
        assert total_slots < total_players

    def test_oversupplied_has_more_slots_than_players(self):
        squads, rooms = generate_instance(
            n_squads=15, n_rooms=4, seed=5, contention_ratio=2.0
        )
        total_players = sum(s.size for s in squads)
        total_slots = sum(r.capacity for r in rooms)
        assert total_slots > total_players


# ---------------------------------------------------------------------------
# (c) Squad validity
# ---------------------------------------------------------------------------

class TestSquadValidity:
    def test_max_distance_positive(self):
        squads, _ = generate_instance(n_squads=20, n_rooms=5, seed=99)
        for sq in squads:
            assert sq.max_distance > 0, (
                f"Squad {sq.id} has non-positive max_distance {sq.max_distance}"
            )

    def test_coordinate_ranges(self):
        squads, rooms = generate_instance(n_squads=20, n_rooms=5, seed=99)
        for sq in squads:
            assert -90.0 <= sq.lat <= 90.0, (
                f"Squad {sq.id} lat={sq.lat} out of [-90, 90]"
            )
            assert -180.0 <= sq.lon <= 180.0, (
                f"Squad {sq.id} lon={sq.lon} out of [-180, 180]"
            )
        for rm in rooms:
            assert -90.0 <= rm.lat <= 90.0, (
                f"Room {rm.id} lat={rm.lat} out of [-90, 90]"
            )
            assert -180.0 <= rm.lon <= 180.0, (
                f"Room {rm.id} lon={rm.lon} out of [-180, 180]"
            )

    def test_coordinates_near_requested_center(self):
        center_lat, center_lon, radius_km = 51.5, -0.1, 5.0
        squads, rooms = generate_instance(
            n_squads=15, n_rooms=3, seed=7,
            center_lat=center_lat, center_lon=center_lon,
            area_radius_km=radius_km,
        )
        deg_half = radius_km / 111.0
        for sq in squads:
            assert center_lat - deg_half <= sq.lat <= center_lat + deg_half
            assert center_lon - deg_half <= sq.lon <= center_lon + deg_half
        for rm in rooms:
            assert center_lat - deg_half <= rm.lat <= center_lat + deg_half
            assert center_lon - deg_half <= rm.lon <= center_lon + deg_half

    def test_time_window_valid(self):
        squads, _ = generate_instance(n_squads=20, n_rooms=5, seed=99)
        for sq in squads:
            assert sq.start_time <= sq.end_time, (
                f"Squad {sq.id} inverted window: "
                f"start={sq.start_time} > end={sq.end_time}"
            )
