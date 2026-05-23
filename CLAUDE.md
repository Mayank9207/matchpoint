# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MatchPoint is a MERN-stack geospatial matchmaking app that connects sports players based on real-world location. Users register, browse/join/create matches, and the Google Maps API provides geocoding and location-based search. The repo has three independent parts: `frontend/`, `backend/`, and `engine/`.

## Development Commands

### Backend (Express + MongoDB)
```bash
cd backend
npm run dev      # nodemon (hot reload)
npm start        # node index.js (production)
```

Requires a `.env` file in `backend/` with:
```
MONGO_URI=<MongoDB Atlas connection string>
JWT_SECRET=<secret>
PORT=5000        # optional, defaults to 5000
```

### Frontend (React + Vite)
```bash
cd frontend
npm run dev      # Vite dev server on :5173
npm run build    # Production build
npm run lint     # ESLint
npm run preview  # Preview built output
```

Requires a `.env` file in `frontend/` with:
```
VITE_API_URL=http://localhost:5000   # omit in dev — Vite proxy handles /api
VITE_GOOGLE_MAPS_API_KEY=<key>
```

The Vite dev server proxies `/api/*` to `http://localhost:5000`, so `VITE_API_URL` is only needed in production builds deployed to Vercel.

### Engine (Python matching algorithm)
```bash
cd engine
python -m pytest test_scoring.py        # run all tests
python -m pytest test_scoring.py -k "test_name"  # run a single test
```

No external dependencies beyond the standard library.

## Architecture

### Backend (`backend/`)

Entry point is `index.js`. Routes are:
- `POST /api/auth/register` — create user, returns JWT
- `POST /api/auth/login` — returns JWT
- `GET /api/auth/me` — current user (auth required)
- `PUT /api/auth/me` — update name/age (auth required)
- `GET /api/matches` — list matches; supports geo query via `?lat=&lng=&radius=` (km), `?sport=`, `?sort=datetime|distance|capacity`, `?page=&limit=`
- `GET /api/matches/:id` — single match with populated host and participants
- `POST /api/matches` — create match (auth required)
- `POST /api/matches/:id/join` — join match (auth required, enforces age/capacity/status rules atomically)
- `POST /api/matches/:id/leave` — leave match (auth required)
- `PATCH /api/matches/:id` — host-only actions: `cancel`, `reschedule`, `update_capacity`, `close`

**Auth middleware** (`middleware/auth.js`): reads `Authorization: Bearer <token>`, verifies with `JWT_SECRET`, attaches `{ id, email }` to `req.user`.

**Models:**
- `User` — name, email, age, password (bcrypt, `select:false`), `sportsplayed[]` (sport + lat/lon). Instance method `matchPassword()`.
- `Match` — sport, datetime, location (GeoJSON Point with `2dsphere` index), `locationDetails` (address/locality/city/state/pincode), host (ref User), participants[], capacity, gender, age range, status (scheduled/cancelled/completed), visibility, images. Multiple compound indexes for geo and filtered queries.

**CORS**: Explicit allowlist (`allowedOrigins` array in `index.js`) plus any `*.vercel.app` preview URL. Add new origins there.

### Frontend (`frontend/src/`)

Single-page app using React Router v7. Routes defined in `App.jsx`:
- `/` — Home (public)
- `/login`, `/register` — auth pages
- `/matches` — browse matches (protected)
- `/matches/:id` — match detail (protected)
- `/create` — create match form (protected)
- `/profile` — user profile (protected)

**API client** (`api/client.js`): Axios instance. Reads `VITE_API_URL` for `baseURL`, appends `/api`. Interceptor attaches `Authorization: Bearer` from `localStorage("access_token")`. 401 responses clear token and redirect to `/login`.

**`useGoogleMaps` hook** (`hooks/useGoogleMaps.js`): loads Google Maps JS SDK once per session (module-scoped promise). Exposes `geocodeText`, `reverseGeocode`, `parseAddressComponents`, and `toGeoJsonPoint`. Requires `VITE_GOOGLE_MAPS_API_KEY`.

**UI components** (`components/ui/`): small primitives (button, card, input, label, select) used across pages.

### Engine (`engine/`)

Pure-Python matching/scoring library — not yet connected to the Express backend.

- `model.py` — `Squad` and `Room` dataclasses; `Sport` and `Tier` enums.
- `utils.py` — `haversine_m()` for great-circle distance in metres.
- `scoring.py` — `isFeasible(squad, room)` and `score(squad, room)` (weighted distance + tier cost, returns `math.inf` if infeasible).
- `test_scoring.py` — pytest test suite for the scoring logic.

## Key Conventions

- All API responses use `{ success: bool, data: ..., error: ... }` shape.
- MongoDB `location` field stores GeoJSON: `{ type: "Point", coordinates: [lng, lat] }` (longitude first — standard GeoJSON order).
- JWT tokens expire in 1 hour; token is stored in `localStorage` (not a cookie).
- Match capacity is capped at 2–22; `join` uses an atomic `findOneAndUpdate` to prevent race conditions.
- The `engine/` directory is self-contained Python and has no npm/node dependencies.
