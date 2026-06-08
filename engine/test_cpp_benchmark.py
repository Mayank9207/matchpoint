"""
Performance benchmark: Python solve_heuristic vs C++ solve_heuristic_cpp.

Runs both implementations across the exact same configurations used by the
cross-language equivalence suite (test_cpp_equivalence.py), using
pytest-benchmark.  Configs are imported from that module rather than
re-declared here, so the two suites can never drift apart; any config marked
``xfail`` there is skipped.

For every (config, implementation) pair we run 20 timed rounds after a
3-round warmup.  Each config is assigned to its own pytest-benchmark *group*
so the default results table shows the Python and C++ rows side by side.

After the session a markdown summary table is printed:

    Config | Python p50 (ms) | Python p99 (ms) | C++ p50 (ms) | C++ p99 (ms) | Speedup (p50)

sorted by p50 speedup (Python / C++) descending.

Run with, e.g.:

    cd engine
    ../.venv/bin/python -m pytest test_cpp_benchmark.py --benchmark-only
"""
from __future__ import annotations

import math
import os
import sys

import pytest

# --------------------------------------------------------------------------- #
# Path setup — mirror test_cpp_equivalence.py so the same imports resolve.
# --------------------------------------------------------------------------- #
_HERE = os.path.dirname(os.path.abspath(__file__))
# cpp/build holds the compiled solver_cpp extension.
sys.path.insert(0, os.path.join(_HERE, "cpp", "build"))
# engine/ itself (for `solver`, `models`, and `test_cpp_equivalence`).
sys.path.insert(0, _HERE)
# repo root (for `bench.datagen`).
sys.path.insert(0, os.path.dirname(_HERE))

from bench.datagen import generate_instance  # noqa: E402
from solver import solve_heuristic            # noqa: E402
import solver_cpp                             # noqa: E402 — built extension

# Import the equivalence suite to reuse its config list and weights verbatim.
import test_cpp_equivalence as _eq            # noqa: E402


# --------------------------------------------------------------------------- #
# Pull configs + shared parameters from the equivalence module (no hardcoding).
# The list is called CONFIGS there; fall back through a couple of plausible
# names so a future rename in that file doesn't silently break this benchmark.
# --------------------------------------------------------------------------- #
_RAW_CONFIGS = (
    getattr(_eq, "EQUIVALENCE_CONFIGS", None)
    or getattr(_eq, "CONFIGS", None)
)
if _RAW_CONFIGS is None:  # pragma: no cover - defensive
    raise RuntimeError(
        "Could not find a config list (EQUIVALENCE_CONFIGS / CONFIGS) "
        "in test_cpp_equivalence."
    )

_W_DIST = getattr(_eq, "_W_DIST", 0.7)
_W_TIER = getattr(_eq, "_W_TIER", 0.3)
_MAX_ITER = getattr(_eq, "_MAX_ITER", 100)


def _is_xfail(param: pytest.param) -> bool:
    """True if a pytest.param carries an xfail mark."""
    return any(getattr(m, "name", None) == "xfail" for m in param.marks)


# Drop xfail configs.  Each pytest.param in the source list carries 4 values
# (n_squads, n_rooms, contention_ratio, seed) which would otherwise be spread
# across multiple argnames; bundle (id, values) into a single object so the
# whole config maps to one `config` parameter, keeping the id for grouping.
CONFIGS = [
    pytest.param((p.id, p.values), id=p.id)
    for p in _RAW_CONFIGS
    if not _is_xfail(p)
]


# --------------------------------------------------------------------------- #
# Benchmark settings.
# --------------------------------------------------------------------------- #
ROUNDS = 20          # >= 20 timed iterations
WARMUP_ROUNDS = 3    # 3-iteration warmup before timing


def _run_python(squads, rooms):
    return solve_heuristic(
        squads, rooms, w_dist=_W_DIST, w_tier=_W_TIER, max_iter=_MAX_ITER
    )


def _run_cpp(squads, rooms):
    return solver_cpp.solve_heuristic_cpp(
        squads, rooms, w_dist=_W_DIST, w_tier=_W_TIER, max_iter=_MAX_ITER
    )


_IMPLS = {
    "python": _run_python,
    "cpp": _run_cpp,
}

# config_id -> {"python": [seconds, ...], "cpp": [seconds, ...]}
_RESULTS: dict[str, dict[str, list[float]]] = {}


# --------------------------------------------------------------------------- #
# The benchmark itself: one test per (config, implementation).
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize("impl", ["python", "cpp"])
@pytest.mark.parametrize("config", CONFIGS)
def test_benchmark(benchmark, config, impl):
    config_id, values = config
    n_squads, n_rooms, contention_ratio, seed = values

    squads, rooms = generate_instance(
        n_squads=n_squads,
        n_rooms=n_rooms,
        seed=seed,
        contention_ratio=contention_ratio,
    )

    fn = _IMPLS[impl]

    # Group results per config so Python and C++ rows sit side by side in the
    # pytest-benchmark table.  Must be set before pedantic() runs (the group is
    # captured when the stats object is created).
    benchmark.group = config_id

    benchmark.pedantic(
        fn,
        args=(squads, rooms),
        rounds=ROUNDS,
        warmup_rounds=WARMUP_ROUNDS,
        iterations=1,
    )

    # Stash the raw per-round timings (seconds) for the markdown summary.
    data = list(benchmark.stats.stats.data)
    _RESULTS.setdefault(config_id, {})[impl] = data


# --------------------------------------------------------------------------- #
# Percentile helper (linear interpolation between closest ranks).
# --------------------------------------------------------------------------- #
def _percentile(data: list[float], pct: float) -> float:
    if not data:
        return float("nan")
    s = sorted(data)
    if len(s) == 1:
        return s[0]
    k = (len(s) - 1) * (pct / 100.0)
    lo = math.floor(k)
    hi = math.ceil(k)
    if lo == hi:
        return s[int(k)]
    return s[lo] + (s[hi] - s[lo]) * (k - lo)


# --------------------------------------------------------------------------- #
# Print the markdown summary table at the very end of the session.
#
# Hooks defined in a test module aren't auto-registered, so we use a
# session-scoped autouse fixture and write through the terminal reporter on
# teardown (which bypasses pytest's output capture).
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session", autouse=True)
def _print_markdown_summary(request):
    yield  # let the whole session run first

    if not _RESULTS:
        return

    rows = []
    for config_id, impls in _RESULTS.items():
        py = impls.get("python")
        cpp = impls.get("cpp")
        if not py or not cpp:
            continue
        py_p50 = _percentile(py, 50) * 1000.0
        py_p99 = _percentile(py, 99) * 1000.0
        cpp_p50 = _percentile(cpp, 50) * 1000.0
        cpp_p99 = _percentile(cpp, 99) * 1000.0
        speedup = (py_p50 / cpp_p50) if cpp_p50 > 0 else float("inf")
        rows.append((config_id, py_p50, py_p99, cpp_p50, cpp_p99, speedup))

    if not rows:
        return

    # Sort by p50 speedup, descending.
    rows.sort(key=lambda r: r[5], reverse=True)

    header = (
        "| Config | Python p50 (ms) | Python p99 (ms) "
        "| C++ p50 (ms) | C++ p99 (ms) | Speedup (p50) |"
    )
    sep = "| --- | ---: | ---: | ---: | ---: | ---: |"

    lines = ["", "## Python vs C++ solve_heuristic benchmark", "", header, sep]
    for config_id, py_p50, py_p99, cpp_p50, cpp_p99, speedup in rows:
        lines.append(
            f"| {config_id} | {py_p50:.3f} | {py_p99:.3f} "
            f"| {cpp_p50:.3f} | {cpp_p99:.3f} | {speedup:.2f}x |"
        )
    lines.append("")

    tr = request.config.pluginmanager.getplugin("terminalreporter")
    text = "\n".join(lines)
    if tr is not None:
        tr.write_line(text)
    else:  # pragma: no cover - fallback if no terminal reporter present
        print(text)
