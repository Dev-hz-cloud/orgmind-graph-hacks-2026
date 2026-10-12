#!/bin/sh
# =============================================================================
# OrgMind — Freebuff Preview Entrypoint (POSIX sh; Freebuff runs this via dash)
# Runs the FastAPI backend (port 8000, matches the Vite /api proxy target)
# and the Vite frontend on the Freebuff-managed preview port ($PORT).
# =============================================================================

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# 1. Backend (uvicorn) — must be running before the frontend proxies /api
backend/.venv/bin/uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# 2. Frontend (Vite) — PORT is injected by Freebuff
npm --prefix frontend run dev -- --host 0.0.0.0 --port "${PORT:-5173}" --strictPort &
FRONTEND_PID=$!

wait "$FRONTEND_PID"
