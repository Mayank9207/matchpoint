# MatchPoint

MatchPoint groups players into squads and assigns those squads to nearby venues in
real time. The interesting part isn't the CRUD — it's the assignment: given a pool
of squads and a set of capacity-limited venues, decide who plays where so that the
most people get matched, at the lowest total travel and skill mismatch. That's a
constrained optimisation problem, and it lives in `engine/`.

![MatchPoint](./Screenshot%20%281318%29.png)

## Layout

| Path             | What it is                                                              |
| ---------------- | ---------------------------------------------------------------------- |
| `frontend/`      | React + Vite single-page app (deploys to Vercel)                       |
| `engine/backend/`| FastAPI service — the HTTP API and matchmaking worker (deploys to Railway) |
| `engine/`        | The matching library: Python model/scoring/solver plus a C++ solver    |

The backend imports the engine directly (it adds `engine/` to `sys.path` and loads
the compiled `solver_cpp` extension), so the two are deployed together with `engine/`
as the build context. The frontend talks to the backend over HTTP and never touches
the engine.

## How it fits together

```
React SPA ──HTTP──▶ FastAPI ──▶ matching engine (Python + C++ solver)
                       │
                       └──▶ MongoDB (users, squads, rooms, matches)
```

A user authenticates (email OTP or Google), joins or creates a squad, and enters the
pool. A background worker batches pooled squads and runs the solver against available
rooms; when it finds an assignment it proposes a match, the squads confirm, and the
match locks.

## Running locally

You need Python 3.10, Node 18+, and a MongoDB connection string (Atlas or local).

### Backend

```bash
cd engine/backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Create `engine/backend/.env` (see `app/config.py` for every setting):

```
MONGODB_URI=<mongodb connection string>
JWT_SECRET=<long random string>
CORS_ORIGINS=http://localhost:5173
GOOGLE_CLIENT_ID=<oauth client id>          # Google login
SMTP_HOST=...  SMTP_USER=...  SMTP_PASSWORD=...  SMTP_FROM=...   # email OTP
```

Matchmaking solves squads against `db.rooms`, so seed some venues once or nothing
will ever match:

```bash
python seed_rooms.py --lat <city-lat> --lon <city-lon>
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Create `frontend/.env` (template in `.env.example`):

```
VITE_API_URL=http://localhost:8000
VITE_GOOGLE_MAPS_API_KEY=<key>
VITE_GOOGLE_CLIENT_ID=<oauth client id>
```

The client calls `VITE_API_URL` directly — no path prefix, no dev proxy. The
backend's `CORS_ORIGINS` must include the frontend origin.

### Engine tests

```bash
cd engine
python -m pytest
```

## The matching engine

Each squad needs a room that matches its sport, fits within its travel radius, and
falls inside its time window. Rooms have fixed capacity. The objective is to maximise
matched players first, then minimise total cost (weighted distance + skill-tier gap)
across all maximum-matching assignments.

This is a capacity-coupled assignment problem, and greedy assignment is not good
enough: a flexible squad taking its locally cheapest room can consume capacity that a
more constrained squad needed far more, and the cost of that mistake only surfaces
later. The engine uses OR-Tools CP-SAT as a correctness oracle and a multistart
heuristic on the production path.

### Heuristic

Three deterministic starting orderings (size-descending, least-flexible-first,
cost-ascending) feed an FFD construction, followed by interleaved local search:

- **1-opt relocate** — move a squad to a cheaper room with spare capacity
- **2-opt swap** — swap two squads between rooms when combined cost drops
- **Ejection chains** — evict a placed squad to seat an unplaced one (player-count move)
- **Substitution** — replace an expensive placed squad with a cheaper unplaced one of
  equal or greater size (cost move; `size(U) ≥ size(P)` guards player count)

The hot path is reimplemented in C++ (`engine/cpp/`, built with CMake + pybind11) and
exposed to Python as `solver_cpp`.

### Benchmarks

Against the CP-SAT oracle across 15 configurations (5–30 squads, ratio 0.6–2.0):

- 13/15 within 5% of optimal cost; player count matches the oracle on all 15.
- Two known hard cases (`xfail`, documented in `engine/DESIGN.md`): `tight_20`
  (full rooms block 2-opt swaps between unequal-size squads — needs 3-opt rotations)
  and `undersupplied_20` (oracle wins via a compound multi-squad eviction).

```bash
cd engine
python -m pytest test_solver_vs_oracle.py -v
```

## Deployment

**Backend → Railway.** Set the service Root Directory to `engine` so the Docker build
context includes the engine sources and the C++ solver compiles. Configure the same
environment variables as local plus the production `CORS_ORIGINS`. Full notes,
including how to split the worker into its own process, are in
`engine/backend/DEPLOY.md`.

**Frontend → Vercel.** Root Directory `frontend`, build command `npm run build`. Set
`VITE_API_URL` to the Railway URL and the Google keys. Add the Vercel origin to the
backend's `CORS_ORIGINS` and to the Google OAuth client's authorised origins.
