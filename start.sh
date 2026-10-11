#!/usr/bin/env bash
# ==============================================================================
# OrgMind — Unified Startup Script
# Starts both FastAPI Backend (port 8000) and React Vite Frontend (port 5173)
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================================"
echo " 🧠 Starting OrgMind — An Evidence-First Company Brain"
echo " Track: WeMakeDevs × FalkorDB Graph Hacks (Company Brain)"
echo "========================================================"

# 1. Check Python Virtual Environment
if [ ! -d "backend/.venv" ]; then
    echo "📦 Initializing Python virtual environment in backend/.venv..."
    python3 -m venv backend/.venv
    backend/.venv/bin/pip install --upgrade pip
    backend/.venv/bin/pip install -r backend/requirements.txt
fi

# 2. Check Frontend Node Modules
if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm --prefix frontend install
fi

# 3. Check for .env file
if [ ! -f ".env" ]; then
    echo "ℹ️  No .env file found. Copying .env.example -> .env (Zero-Config Demo Mode active)..."
    cp .env.example .env
fi

# Kill any existing processes on port 8000 or 5173
lsof -ti:8000 | xargs -r kill -9 2>/dev/null || true
lsof -ti:5173 | xargs -r kill -9 2>/dev/null || true

echo ""
echo "🚀 Launching FastAPI Backend on http://127.0.0.1:8000..."
backend/.venv/bin/uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

echo "🚀 Launching Vite Frontend on http://127.0.0.1:5173..."
npm --prefix frontend run dev -- --host 127.0.0.1 --port 5173 &
FRONTEND_PID=$!

echo ""
echo "========================================================"
echo " ✨ OrgMind is running!"
echo " 🖥️  Frontend: http://127.0.0.1:5173"
echo " 🔌 Backend:  http://127.0.0.1:8000"
echo " 📖 API Docs: http://127.0.0.1:8000/docs"
echo "========================================================"
echo "Press Ctrl+C to stop both servers."

trap "echo 'Stopping OrgMind...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true; exit 0" SIGINT SIGTERM

wait
