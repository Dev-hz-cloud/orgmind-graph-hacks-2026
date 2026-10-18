"""
Test isolation for the OrgMind backend suite.

The repository ships a .env that points at a live FalkorDB Cloud instance. Tests
must never write to (or depend on) that remote graph, so this conftest pins the
process to the offline demo engine and disables external LLM providers before the
application configuration is imported.

This only affects the pytest process. It does not read, modify, or delete the
user's .env, credentials, or any database contents.
"""

import os

# Force demo mode and clear any configured host so FalkorDBService never dials out.
os.environ["DEMO_MODE"] = "true"
os.environ["FALKORDB_HOST"] = ""
os.environ["FALKORDB_PORT"] = "6379"

# Belt-and-braces: even if a developer's shell exports the live-write opt-in,
# the test process must never treat writes as enabled by default.
os.environ["ORGMIND_ALLOW_LIVE_WRITES"] = "false"

# Prevent config.py from falling back to the on-disk Groq key file: a non-empty
# (but invalid) key keeps the file fallback from running, and we clear it below.
os.environ["GROQ_API_KEY"] = "test-disabled"
os.environ["OPENAI_API_KEY"] = ""
os.environ["GEMINI_API_KEY"] = ""

from app.config import get_settings  # noqa: E402

_settings = get_settings()
_settings.demo_mode = True
_settings.falkordb_host = ""
_settings.orgmind_allow_live_writes = False
_settings.groq_api_key = ""
_settings.openai_api_key = ""
_settings.gemini_api_key = ""
