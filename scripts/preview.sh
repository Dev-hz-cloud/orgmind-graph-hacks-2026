#!/bin/sh
# =============================================================================
# OrgMind — Freebuff Preview Entrypoint (POSIX sh; Freebuff runs this via dash)
# Runs the FastAPI backend (port 8000, matches the Vite /api proxy target)
# and the Vite frontend on the Freebuff-managed preview port ($PORT).
# =============================================================================

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# 0. Release port 8000 if a previous run left a listener behind (start.sh does
#    the same). Without this the new backend silently fails to bind and the
#    preview keeps serving whichever process already held the port — which
#    means stale API code with no visible error.
release_port() {
  port="$1"
  command -v lsof >/dev/null 2>&1 || return 0
  pids="$(lsof -ti:"$port" 2>/dev/null || true)"
  [ -n "$pids" ] || return 0
  echo "Releasing API port $port held by: $pids"
  kill -9 $pids 2>/dev/null || true
  sleep 1
}

release_port 8000

# 1. Backend (uvicorn) — must be running before the frontend proxies /api
backend/.venv/bin/uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# 2. Frontend (Vite) — PORT is injected by Freebuff.
# Started immediately after uvicorn: Freebuff advertises the port it finds
# listening, and any gap where only the API is up makes it advertise 8000
# instead of the frontend.
npm --prefix frontend run dev -- --host 0.0.0.0 --port "${PORT:-5173}" --strictPort &
FRONTEND_PID=$!

# Report a backend that died during startup (e.g. its port was still held).
# Checked only after the frontend is listening so it can never delay it.
if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
  echo "WARNING: backend exited during startup — /api requests will fail." >&2
fi

wait "$FRONTEND_PID"
