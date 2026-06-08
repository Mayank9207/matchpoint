"""
Performance benchmark: Python solve_heuristic vs C++ solver_cpp.solve_heuristic_cpp.

Runs both implementations over the SAME instances used by the equivalence suite
(test_cpp_equivalence.py).  The config list is imported dynamically so the two
files never drift — add a config there and it shows up here automatically.

Run with:
    cd engine && ../.venv/bin/python -m pytest test_cpp_benchmark.py --benchmark-only

Produces 10 configs x 2 implementations = 20 benchmarks, grouped per-config so
the Python and C++ timings sit side-by-side.  A session-scoped autouse fixture
prints a markdown summary table at the end, sorted by p50 speedup descending.
"""
from __future__ import annotations

import os
import sys

import numpy as np
import pytest

# Add cpp/build so solver_cpp can be found.  Fails at collection time if the
# extension hasn't been built yet — that is intentional.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "cpp", "build"))
# Match the path convention used by the rest of the engine test suite.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bench.datagen import generate_instance   # noqa: E402
from solver import solve_heuristic            # noqa: E402
import solver_cpp                             # noqa: E402 — fails until C++ port built

# Pull the parametrized configs straight from the equivalence test so the two
# suites stay in lockstep.  Prefer EQUIVALENCE_CONFIGS, fall back to CONFIGS.
import test_cpp_equivalence as _equiv         # noqa: E402

# Weights / iteration cap — keep identical to the equivalence suite so the two
# implementations do the same amount of work.
_W_DIST = 0.7
_W_TIER = 0.3
_MAX_ITER = 100

# pytest-benchmark pedantic knobs.
_ROUNDS = 20
_WARMUP_ROUNDS = 3
_ITERATIONS = 1

# Implementations under test: label -> callable(squads, rooms, **weights).
_IMPLEMENTATIONS = {
    "python": solve_heuristic,
    "cpp": solver_cpp.solve_heuristic_cpp,
}

# config_id -> {impl_label: (p50_ms, p99_ms)} — filled in by each test, drained
# by the session-scoped summary fixture below.
_RESULTS: dict[str, dict[str, tuple[float, float]]] = {}


def _load_configs():
    """Import the equivalence configs dynamically (EQUIVALENCE_CONFIGS or CONFIGS)."""
    return getattr(_equiv, "EQUIVALENCE_CONFIGS", None) or _equiv.CONFIGS


def _build_cases():
    """Expand each config into one case per implementation.

    Configs carrying an xfail mark (generic name check) are skipped in the
    benchmark — timing a known-divergent config is meaningless.
    """
    cases = []
    for cfg in _load_configs():
        xfail = any(getattr(mark, "name", None) == "xfail" for mark in cfg.marks)
        marks = [pytest.mark.skip(reason="xfail config — skipped in benchmark")] if xfail else []
        for impl in _IMPLEMENTATIONS:
            cases.append(
                pytest.param(cfg.id, cfg.values, impl, marks=marks, id=f"{cfg.id}-{impl}")
            )
    return cases


@pytest.mark.parametrize("config_id,values,impl", _build_cases())
def test_benchmark(benchmark, config_id, values, impl):
    """Benchmark one implementation on one config; record p50/p99 in ms."""
    n_squads, n_rooms, contention_ratio, seed = values
    squads, rooms = generate_instance(
        n_squads=n_squads,
        n_rooms=n_rooms,
        seed=seed,
        contention_ratio=contention_ratio,
    )

    func = _IMPLEMENTATIONS[impl]

    # Group by config so Python and C++ for the same instance render side-by-side
    # in pytest-benchmark's own table.
    benchmark.group = config_id

    benchmark.pedantic(
        func,
        args=(squads, rooms),
        kwargs={"w_dist": _W_DIST, "w_tier": _W_TIER, "max_iter": _MAX_ITER},
        rounds=_ROUNDS,
        warmup_rounds=_WARMUP_ROUNDS,
        iterations=_ITERATIONS,
    )

    # sorted_data is the per-round sample times in seconds; convert to ms.
    samples = np.asarray(benchmark.stats.stats.sorted_data, dtype=float) * 1000.0
    p50 = float(np.percentile(samples, 50))
    p99 = float(np.percentile(samples, 99))
    _RESULTS.setdefault(config_id, {})[impl] = (p50, p99)


@pytest.fixture(scope="session", autouse=True)
def _benchmark_summary(request):
    """Print a markdown speedup table after the whole session finishes."""
    yield

    rows = []
    for config_id, impls in _RESULTS.items():
        if "python" not in impls or "cpp" not in impls:
            continue
        py_p50, py_p99 = impls["python"]
        cpp_p50, cpp_p99 = impls["cpp"]
        speedup = py_p50 / cpp_p50 if cpp_p50 > 0 else float("inf")
        rows.append((config_id, py_p50, py_p99, cpp_p50, cpp_p99, speedup))

    if not rows:
        return

    # Sort by p50 speedup descending.
    rows.sort(key=lambda r: r[5], reverse=True)

    lines = [
        "",
        "## Benchmark summary — Python vs C++ (sorted by p50 speedup)",
        "",
        "| Config | Python p50 (ms) | Python p99 (ms) | C++ p50 (ms) | C++ p99 (ms) | Speedup (p50) |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
    ]
    for config_id, py_p50, py_p99, cpp_p50, cpp_p99, speedup in rows:
        lines.append(
            f"| {config_id} | {py_p50:.4f} | {py_p99:.4f} | "
            f"{cpp_p50:.4f} | {cpp_p99:.4f} | {speedup:.2f}x |"
        )

    # Use the terminal reporter so the table survives output capturing; fall
    # back to a plain print if it isn't available.
    reporter = request.config.pluginmanager.get_plugin("terminalreporter")
    if reporter is not None:
        for line in lines:
            reporter.write_line(line)
    else:
        print("\n".join(lines))
