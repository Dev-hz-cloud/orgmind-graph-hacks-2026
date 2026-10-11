#!/usr/bin/env python3
"""
Seed NovaTech Logistics demo dataset into FalkorDB Cloud or print Cypher statements.
Usage:
    python backend/seed_db.py
"""

import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.db.falkor import get_falkor_service

def main():
    print("=======================================================")
    print(" OrgMind — FalkorDB Database Seeding Utility")
    print("=======================================================")
    falkor = get_falkor_service()
    print(f"Target Mode: {falkor.mode.upper()}")
    print(f"Target Graph: {falkor.graph_name}")

    if falkor.mode == "live":
        print("Connected to live FalkorDB instance.")
    else:
        print("Note: Running in Demo / In-Memory Mode (No live FalkorDB credentials provided).")

    print("\nExecuting idempotent MERGE seed script...")
    result = falkor.seed()
    print("Result:", result)
    print("\nSeeding complete!")

if __name__ == "__main__":
    main()
