# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MatchPoint is a geospatial matchmaking app that groups sports players into squads and matches those squads against venues ("rooms") in real time. The repo has two deployed parts plus a shared engine:

- `frontend/` — React + Vite single-page app (deploys to Vercel).
- `engine/backend/` — FastAPI service, the live API (deploys to Railway).
- `engine/` — the Python matching/scoring/solver library (plus a compiled C++ solver) that the backend imports at runtime.

> The original MERN/Express `backend/` has been removed. The live backend is the FastAPI app under `engine/backend/`.

## Development Commands

### Backend (FastAPI, `engine/backend/`)
```bash
cd engine/backend
uvicorn app.main:app --reload --port 8000
```

Requires a `.env` in `engine/backend/` (see `app/config.py` for the full list):
```
MONGODB_URI=<MongoDB Atlas connection string>
MONGODB_DB_NAME=matchpoint          # optional
JWT_SECRET=<long random string>
CORS_ORIGINS=http://localhost:5173  # comma-separated
GOOGLE_CLIENT_ID=<oauth client id>  # for Google login
SMTP_HOST=...  SMTP_PORT=587  SMTP_USER=...  SMTP_PASSWORD=...  SMTP_FROM=...   # for email OTP
ENABLE_WORKER=true                  # run matchmaking worker in-process
```

Seed venues once (matchmaking solves squads against `db.rooms`, so an empty
collection never produces a match):
```bash
python seed_rooms.py --lat <city-lat> --lon <city-lon>
```

### Frontend (React + Vite)
```bash
cd frontend
npm run dev      # Vite dev server on :5173
npm run build    # Production build
npm run lint     # ESLint
npm run preview  # Preview built output
```

Requires a `.env` in `frontend/` with:
```
VITE_API_URL=http://localhost:8000   # the FastAPI backend origin
VITE_GOOGLE_MAPS_API_KEY=<key>
VITE_GOOGLE_CLIENT_ID=<oauth client id>
```

The frontend calls the backend directly at `VITE_API_URL` (no path prefix, no
dev proxy). CORS on the backend must list the frontend origin.

### Engine (Python matching algorithm + C++ solver)
```bash
cd engine
python -m pytest                    # run all tests
python -m pytest test_solver.py -k "test_name"
```

The C++ solver (`engine/cpp/`) is built with CMake + pybind11 and imported as
`solver_cpp`; the backend Dockerfile compiles it in a first build stage.

## Architecture

### Backend (`engine/backend/app/`)

`main.py` builds the app via `create_app()`, mounts routers, configures CORS from
`settings.cors_origins`, and on startup (lifespan) connects to Mongo and — when
`ENABLE_WORKER=true` — launches `run_worker_loop()` in-process. `GET /health` is
the health check.

Routers (no `/api` prefix):
- **auth** (`/auth`): `POST /signup` (starts email-OTP challenge), `POST /verify-otp`, `POST /resend-otp`, `POST /login`, `POST /google` (Google ID-token login), `GET /me`.
- **squads** (`/squads`): `GET /pool/count`, `POST /create`, `POST /join`, `POST /{squad_id}/enter`, `GET /current`, `GET /{squad_id}`, `POST /{squad_id}/leave`.
- **matches** (`/matches`): `POST /find` (enqueue a matchmaking request, 202), `GET /pool-status`, `GET /{match_id}`, `POST /{match_id}/confirm`.

Auth uses JWT (`app/auth/jwt_utils.py`) via HTTPBearer (`app/auth/dependencies.py`).
Helpers: `otp_utils.py`, `email_utils.py` (SMTP), `google_utils.py` (ID-token verify).

`app/matches/solver_bridge.py` bridges the API to the engine: it adds `engine/`
to `sys.path` (`ENGINE_ROOT`), imports `models`/`scoring`/`utils` and the compiled
`solver_cpp`, and converts DB documents to engine `Squad`/`Room` objects.

`app/worker.py` (`run_worker_loop`) is the matchmaking worker: a patience
failsafe + stale-proposal cleanup. Density-triggered waves also fire on squad
enter. For multiple web replicas, set `ENABLE_WORKER=false` and run one
dedicated worker process (see `engine/backend/DEPLOY.md`).

### Frontend (`frontend/src/`)

SPA using React Router (routes in `App.jsx`):
- `/`, `/login`, `/register` — `AccessTerminal` (auth + OTP)
- `/hub` — `Gateway` (protected)
- `/join` — `JoinPool` (protected)
- `/create` — `CreateMatch` (protected)
- `/proposal/:matchId` — `MatchProposal` (proposed → locked handoff, protected)
- `/ready/:matchId` — `ReadyCheck` (protected)
- `/match/:matchId` — `MatchLocked` (protected)
- `/matches`, `/matches/:id`, `/profile` — protected

**API client** (`api/client.js`): Axios instance with `baseURL = VITE_API_URL || http://localhost:8000` (no `/api` suffix). Request interceptor attaches `Authorization: Bearer` from `localStorage("access_token")`; 401 responses clear the token and redirect to `/login`.

**`useGoogleMaps` hook** (`hooks/useGoogleMaps.js`): loads the Google Maps JS SDK once per session (module-scoped promise). Exposes `geocodeText`, `reverseGeocode`, `parseAddressComponents`, `toGeoJsonPoint`. Requires `VITE_GOOGLE_MAPS_API_KEY`.

**UI components** (`components/ui/`): small primitives (card, input, label, …).

### Engine (`engine/`)

- `models.py` — `Squad`/`Room` dataclasses; `Sport`/`Tier` enums.
- `utils.py` — `haversine_m()` great-circle distance in metres.
- `scoring.py` — `isFeasible(squad, room)` and `score(squad, room)`.
- `solver.py` — Python solver; `cpp/` is the compiled C++ equivalent (`solver_cpp`).
- `test_*.py` — pytest suites (scoring, solver, C++ equivalence/benchmark).

## Key Conventions

- FastAPI endpoints return Pydantic response models directly (not a `{success, data, error}` envelope).
- MongoDB `location`/geo fields store GeoJSON: `{ type: "Point", coordinates: [lng, lat] }` (longitude first).
- JWT tokens are stored in `localStorage("access_token")` (not a cookie); expiry is `access_token_expire_minutes` in `app/config.py`.
- The backend imports the engine at runtime, so it must be built/deployed with `engine/` as the Docker build context (Railway service Root Directory = `engine`). See `engine/backend/DEPLOY.md`.

# Frontend Architecture Rules
- **Component Patterns:** Always use composition over boolean flags (e.g., use `<Alert.Destructive>` instead of `<Alert isDestructive={true}>`).
- **UI Stack:** Tailwind CSS and Framer Motion on React + Vite.
- **Anti-Slop Constraints:** - NEVER use default Tailwind colors out of the box (e.g., `bg-blue-500`). Use cohesive CSS variables defined in your global theme.
  - BANNED FONTS: Inter, Roboto, Arial, system-sans. Always pull a distinctive typeface pairing (e.g., an editorial serif for headings, clean geometric mono for accents) from Google Fonts.
  - Spacing must lean into extremes (3x+ scale jumps between headings and body, generous negative space).
