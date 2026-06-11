# MatchPoint FastAPI backend
#
# NOTE: this backend lives at engine/backend and imports the compiled C++
# solver from engine/cpp/build at runtime (see app/matches/solver_bridge.py).
# To run the matching endpoints inside a container you must build the image
# from the engine/ directory so the extension + models.py are included, e.g.:
#
#   docker build -f backend/Dockerfile -t matchpoint-api ./engine
#
# The default Railway/standalone build below is sufficient for the API layer;
# rebuild solver_cpp for this image's Python (3.10) if you exercise the solver.
FROM python:3.10-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install dependencies first for better layer caching.
COPY backend/requirements.txt ./requirements.txt
RUN pip install --upgrade pip && pip install -r requirements.txt

# Application code.
COPY backend/ ./

# Railway provides $PORT; default to 8000 locally.
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
