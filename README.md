# FleetLanka System (FYP)

Fleet management system built with React PWA, FastAPI, and Supabase.

## Stack
- Frontend: React + Vite + TypeScript
- Backend: FastAPI (Python)
- Database/Auth: Supabase (hosted)
- Local dev: Docker Compose

## Structure
- `frontend/` - React app
- `backend/` - FastAPI APIs + ML
- `supabase/schema.sql` - database schema

## Run Locally
1. Copy env file:
   ```bash
   cp .env.example .env
   ```
2. Add Supabase and API values in `.env`.
3. Start:
   ```bash
   docker compose up --build
   ```

## URLs
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`

