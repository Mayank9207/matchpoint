# MatchPoint Frontend (Vite + React + TypeScript)

Mobile-first React SPA for MatchPoint, styled with Tailwind CSS and talking to
the FastAPI backend over Axios.

> Location: this frontend lives at `engine/frontend/`.

## Requirements

- Node.js 18+
- The FastAPI backend running (see `engine/backend/README.md`)

## Setup

```bash
cd engine/frontend
npm install
cp .env.example .env        # set VITE_API_URL to your backend URL
```

## Run locally

```bash
npm run dev                 # http://localhost:5173
```

## Build / preview

```bash
npm run build               # type-check + production build to dist/
npm run preview             # serve the built output
```

## Environment variables

| Variable       | Description                                  |
| -------------- | -------------------------------------------- |
| `VITE_API_URL` | Base URL of the FastAPI backend (no trailing slash) |

## Project layout

```
src/
├── main.tsx          # entry: Router + AuthProvider
├── App.tsx           # route table with protected routes
├── api/              # axios client + auth/squads/matches calls
├── auth/             # AuthContext, useAuth, ProtectedRoute
├── pages/            # Login, Signup, Home, SquadLobby, MatchSearch, MatchResult
├── components/       # Button, Input, Card, RadarAnimation
└── types/            # auth, squad, match interfaces
```

## Deployment (Vercel)

`vercel.json` rewrites all routes to `index.html` for client-side routing.
Set `VITE_API_URL` in the Vercel project's environment variables, then deploy
the `engine/frontend` directory (set it as the project root in Vercel).
```
