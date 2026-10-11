#!/usr/bin/env bash
# ==============================================================================
# OrgMind — Stop Script
# Stops any running processes on ports 8000 and 5173
# ==============================================================================

echo "Stopping OrgMind servers on ports 8000 and 5173..."
lsof -ti:8000 | xargs -r kill -9 2>/dev/null || true
lsof -ti:5173 | xargs -r kill -9 2>/dev/null || true
echo "OrgMind servers stopped."
