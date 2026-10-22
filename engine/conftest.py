from __future__ import annotations

import glob
import os

import pytest

_CPP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cpp")
_SOURCE_PATTERNS = ("*.cpp", "*.h")


@pytest.fixture(scope="module", autouse=True)
def require_fresh_cpp_extension(request):
    extension = getattr(request.module, "solver_cpp", None)
    if extension is None:
        return

    binary = getattr(extension, "__file__", None)
    if binary is None:
        pytest.fail(
            "solver_cpp has no __file__ — cannot verify it was built from the "
            "current C++ source.",
            pytrace=False,
        )

    built_at = os.path.getmtime(binary)
    stale = sorted(
        source
        for pattern in _SOURCE_PATTERNS
        for source in glob.glob(os.path.join(_CPP_DIR, pattern))
        if os.path.getmtime(source) > built_at
    )

    if stale:
        listing = "\n".join(f"  {os.path.relpath(s, _CPP_DIR)}" for s in stale)
        pytest.fail(
            "C++ source is newer than the built extension — rebuild before "
            "testing.\n"
            f"extension: {binary}\n"
            f"newer sources:\n{listing}\n"
            "rebuild with:\n"
            "  cmake -S engine/cpp -B engine/cpp/build\n"
            "  cmake --build engine/cpp/build",
            pytrace=False,
        )
