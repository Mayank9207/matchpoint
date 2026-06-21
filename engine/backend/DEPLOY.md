# Deploying the MatchPoint backend

The backend imports a compiled C++ solver from the `engine/` tree at runtime, so
it must be built and deployed with `engine/` as the Docker build context.

## Railway

1. **Service Root Directory:** set to `engine` (Settings → Service → Root
   Directory). This makes `engine/railway.toml` and the `engine/` build context
   take effect. `backend/Dockerfile` builds `solver_cpp` for the runtime's
   Python (3.10) in a first stage, so no prebuilt `.so` is needed.

2. **Environment variables** (Settings → Variables):

   | Variable | Required | Notes |
   |---|---|---|
   | `MONGODB_URI` | yes | Atlas connection string |
   | `MONGODB_DB_NAME` | no | defaults to `matchpoint` |
   | `JWT_SECRET` | yes | long random string |
   | `CORS_ORIGINS` | yes | comma-separated; include the deployed frontend origin |
   | `GOOGLE_CLIENT_ID` | for Google login | same value as the frontend's `VITE_GOOGLE_CLIENT_ID` |
   | `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD`/`SMTP_FROM` | for email OTP | as in local `.env` |
   | `SMTP_USE_SSL` | no | `true` for port 465, else STARTTLS |
   | `ENABLE_WORKER` | no | defaults to `true`; keep `true` for a single service |

3. **Seed rooms once** against the production DB, or matchmaking never produces a
   match (it solves squads against `db.rooms`):

   ```bash
   python seed_rooms.py --lat <city-lat> --lon <city-lon>
   ```

   Replace this with a real venue source before going fully live.

## Matchmaking worker

`run_worker_loop` (patience failsafe + stale-proposal cleanup) runs inside the
web process via the app lifespan when `ENABLE_WORKER=true`. Density-triggered
waves fire on squad enter regardless. If you later scale to multiple web
replicas, set `ENABLE_WORKER=false` on the web service and run one dedicated
worker process from a tiny entrypoint that connects to Mongo and awaits
`run_worker_loop()`:

```python
# worker_main.py
import asyncio
from app.database import connect_to_mongo, close_mongo_connection
from app.worker import run_worker_loop

async def main():
    await connect_to_mongo()
    try:
        await run_worker_loop()
    finally:
        await close_mongo_connection()

asyncio.run(main())
```

## Frontend

Set `VITE_API_URL` to the deployed backend URL and `VITE_GOOGLE_CLIENT_ID` /
`VITE_GOOGLE_MAPS_API_KEY` in the frontend host (e.g. Vercel) before building.
Add the frontend origin to the backend `CORS_ORIGINS` and to the Google OAuth
client's Authorized JavaScript origins.
