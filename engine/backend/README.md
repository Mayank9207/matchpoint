# MatchPoint Backend (FastAPI)

Async FastAPI service for MatchPoint: JWT auth, squad management, and a
matching endpoint that calls the compiled C++ solver in `engine/cpp/build`.

> Location: this backend lives at `engine/backend/`. The matching layer imports
> the engine's `models.py` and the compiled `solver_cpp` extension from the
> parent `engine/` tree at runtime (see `app/matches/solver_bridge.py`).

## Requirements

- Python 3.10+
- A MongoDB Atlas connection string
- The compiled `solver_cpp` extension built for your Python version
  (`engine/cpp/build/solver_cpp*.so`). Rebuild it from `engine/cpp` if your
  Python differs from the prebuilt one.

## Setup

```bash
cd engine/backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env               # then fill in MONGODB_URI and JWT_SECRET
```

## Run locally

```bash
uvicorn app.main:app --reload --port 8000
```

- API root: http://localhost:8000
- Interactive docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

## Tests

```bash
pytest
```

## Environment variables

| Variable                      | Description                                  |
| ----------------------------- | -------------------------------------------- |
| `MONGODB_URI`                 | MongoDB Atlas connection string              |
| `MONGODB_DB_NAME`             | Database name (default: `matchpoint`)        |
| `JWT_SECRET`                  | Secret used to sign access tokens            |
| `JWT_ALGORITHM`               | JWT algorithm (default: `HS256`)             |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime in minutes (default: `1440`)  |
| `CORS_ORIGINS`                | JSON array of allowed frontend origins       |

## Project layout

```
app/
├── main.py            # app instance, CORS, router registration
├── config.py          # pydantic-settings configuration
├── database.py        # Motor client + get_database dependency
├── auth/              # signup / login / me, JWT + password hashing
├── squads/            # create / join / get / leave
├── matches/           # find / get / confirm + solver_bridge
└── shared/            # custom HTTP exceptions
tests/                 # pytest scaffolds
```

## Deployment (Railway)

`railway.toml` builds `backend/Dockerfile`. Set the environment variables above
in the Railway service. Railway injects `$PORT`, which the start command uses.
