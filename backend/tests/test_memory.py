"""
Unit tests for OrgMind Durable Conversation Memory (SQLite).
Verifies persistence, session isolation, context generation, and cleanup.
"""

import tempfile
from pathlib import Path
import pytest
from app.services.memory import MemoryService


@pytest.fixture
def temp_db():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        path = f.name
    yield path
    # Cleanup
    p = Path(path)
    if p.exists():
        p.unlink()


def test_session_creation_and_isolation(temp_db):
    mem = MemoryService(db_path=temp_db)

    # Create session 1
    s1 = mem.get_or_create_session("session-alpha", title="Alpha")
    assert s1 == "session-alpha"

    # Create session 2
    s2 = mem.get_or_create_session("session-beta", title="Beta")
    assert s2 == "session-beta"

    # Add messages to session 1
    mem.add_message(s1, "user", "Hello Alpha")
    mem.add_message(s1, "assistant", "Response Alpha")

    # Add message to session 2
    mem.add_message(s2, "user", "Hello Beta")

    # Check isolation
    m1 = mem.get_messages(s1)
    m2 = mem.get_messages(s2)

    assert len(m1) == 2
    assert m1[0]["content"] == "Hello Alpha"
    assert m1[1]["content"] == "Response Alpha"

    assert len(m2) == 1
    assert m2[0]["content"] == "Hello Beta"


def test_persistence_across_service_restarts(temp_db):
    # Step 1: Write in first instance
    mem1 = MemoryService(db_path=temp_db)
    sid = mem1.get_or_create_session("persistent-session")
    mem1.add_message(sid, "user", "Who is the lead on Titan?")
    mem1.add_message(
        sid,
        "assistant",
        "Sarah Chen is lead on Titan.",
        evidence=[{"id": "ev-1", "label": "Person", "title": "Sarah Chen", "properties": {}}]
    )
    mem1.add_fact(sid, "User prefers concise answers", entity_ref="user-pref")

    # Step 2: Re-instantiate service (simulating backend restart)
    mem2 = MemoryService(db_path=temp_db)
    msgs = mem2.get_messages(sid)
    facts = mem2.get_facts(sid)

    assert len(msgs) == 2
    assert msgs[0]["content"] == "Who is the lead on Titan?"
    assert msgs[1]["evidence"][0]["title"] == "Sarah Chen"

    assert len(facts) == 1
    assert facts[0]["fact_text"] == "User prefers concise answers"
    assert facts[0]["entity_ref"] == "user-pref"


def test_context_generation_demarcation(temp_db):
    mem = MemoryService(db_path=temp_db)
    sid = "test-context-sess"
    mem.add_message(sid, "user", "Why is Apollo delayed?")
    mem.add_message(sid, "assistant", "Apollo is not delayed, it is on track.")
    mem.add_fact(sid, "User is interested in RFID scanners", entity_ref="task-rfid-scanner")

    context = mem.get_conversation_context(sid)

    assert "### PRIOR CONVERSATION MEMORY" in context
    assert "NOT verified graph facts in FalkorDB" in context
    assert "Why is Apollo delayed?" in context
    assert "User is interested in RFID scanners" in context


def test_missing_and_empty_sessions(temp_db):
    mem = MemoryService(db_path=temp_db)
    # Non-existent session
    assert mem.get_messages("non-existent") == []
    assert mem.get_facts("non-existent") == []
    assert mem.get_conversation_context("non-existent") == ""
    assert mem.get_conversation_context(None) == ""


def test_clear_session(temp_db):
    mem = MemoryService(db_path=temp_db)
    sid = "doomed-session"
    mem.add_message(sid, "user", "Ephemeral message")
    mem.add_fact(sid, "Ephemeral fact")

    assert len(mem.get_messages(sid)) == 1
    assert len(mem.get_facts(sid)) == 1

    mem.clear_session(sid)

    assert len(mem.get_messages(sid)) == 0
    assert len(mem.get_facts(sid)) == 0
