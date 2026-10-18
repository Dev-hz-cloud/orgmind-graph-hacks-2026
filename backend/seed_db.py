#!/usr/bin/env python3
"""
Seed NovaTech Logistics demo dataset into FalkorDB Cloud or print Cypher statements.
Usage:
    python backend/seed_db.py
"""

import argparse
import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.db.falkor import get_falkor_service


def main():
    parser = argparse.ArgumentParser(
        description="OrgMind — FalkorDB Database Seeding Utility with collision protection."
    )
    parser.add_argument(
        "--confirm",
        "--opt-in",
        dest="confirmed",
        action="store_true",
        help="Explicitly authorize database seeding (required for live FalkorDB).",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Bypass collision protection if non-demo records already exist.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print seed plan without executing any database writes.",
    )
    args = parser.parse_args()

    print("=======================================================")
    print(" OrgMind — FalkorDB Database Seeding Utility")
    print("=======================================================")
    falkor = get_falkor_service()
    print(f"Target Mode: {falkor.mode.upper()}")
    print(f"Target Graph: {falkor.graph_name}")

    if args.dry_run:
        print("\n[DRY RUN] No database writes will be performed.")
        print(f"Would seed 26 nodes and 32 relationships labeled with _demo=True.")
        return

    if falkor.mode == "live" and not args.confirmed:
        print("\n[SAFETY BLOCK] Live FalkorDB seeding requires explicit confirmation.")
        print("To proceed with seeding the live database, run:")
        print("    python backend/seed_db.py --confirm")
        sys.exit(1)

    print("\nExecuting idempotent MERGE seed script...")
    result = falkor.seed(opt_in=args.confirmed, force=args.force)
    print("Result:", result)
    if result.get("success"):
        print("\nSeeding complete! Sample company records labeled as demo data.")
    else:
        print(f"\nSeeding halted: {result.get('error')}")


if __name__ == "__main__":
    main()
