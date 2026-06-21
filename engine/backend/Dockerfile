# MatchPoint FastAPI backend + compiled C++ solver.
#
# IMPORTANT: build with the *engine/* directory as the build context, because the
# solver bridge imports engine/models.py and the compiled extension from
# engine/cpp/build at runtime (see app/matches/solver_bridge.py, ENGINE_ROOT).
#
#   docker build -f backend/Dockerfile -t matchpoint-api .        # run from engine/
#
# On Railway set the service Root Directory to "engine" so this context is used.

# --- Stage 1: build solver_cpp for the runtime's Python ---------------------
FROM python:3.10-slim AS solver-build

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential cmake \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir pybind11

WORKDIR /src
COPY cpp ./cpp

# Configure a fresh build (portable flags — no -march=native, so the binary runs
# on any x86-64 host, not just the build machine).
RUN cmake -S cpp -B cpp/build \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_CXX_FLAGS_RELEASE="-O3 -DNDEBUG" \
        -Dpybind11_DIR="$(python -m pybind11 --cmakedir)" \
    && cmake --build cpp/build --config Release

# --- Stage 2: runtime -------------------------------------------------------
FROM python:3.10-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Python deps first for layer caching.
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --upgrade pip && pip install -r backend/requirements.txt

# Engine modules the solver bridge imports (ENGINE_ROOT == /app).
COPY models.py scoring.py utils.py ./
COPY --from=solver-build /src/cpp/build/solver_cpp*.so ./cpp/build/

# Application code.
COPY backend/ ./backend/

WORKDIR /app/backend

ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
