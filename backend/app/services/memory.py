"""
Durable conversation memory service for OrgMind using SQLite persistence.
Survives backend restarts and page reloads with strict session isolation.
Keeps conversation memory separate from verified FalkorDB company graph facts.
"""

from __future__ import annotations
import json
import logging
import os
from pathlib import Path
import sqlite3
import time
from typing import Any, Dict, List, Optional
import uuid

from app.config import get_settings

logger = logging.getLogger("orgmind.memory")


class MemoryService:
    def __init__(self, db_path: Optional[str] = None):
        settings = get_settings()
        self.db_path = db_path or settings.sqlite_db_path
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        db_file = Path(self.db_path)
        db_file.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(db_file), timeout=10.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn

    def _init_db(self):
        """Create tables if they do not exist."""
        try:
            with self._get_connection() as conn:
                conn.executescript(
                    """
                    CREATE TABLE IF NOT EXISTS chat_sessions (
                        session_id TEXT PRIMARY KEY,
                        title TEXT,
                        created_at REAL NOT NULL,
                        updated_at REAL NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS chat_messages (
                        id TEXT PRIMARY KEY,
                        session_id TEXT NOT NULL,
                        role TEXT NOT NULL,
                        content TEXT NOT NULL,
                        evidence_json TEXT,
                        created_at REAL NOT NULL,
                        FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id) ON DELETE CASCADE
                    );

                    CREATE TABLE IF NOT EXISTS extracted_facts (
                        id TEXT PRIMARY KEY,
                        session_id TEXT NOT NULL,
                        fact_text TEXT NOT NULL,
                        entity_ref TEXT,
                        created_at REAL NOT NULL,
                        FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id) ON DELETE CASCADE
                    );

                    CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(session_id, created_at);
                    CREATE INDEX IF NOT EXISTS idx_facts_session ON extracted_facts(session_id);
                    """
                )
        except Exception as e:
            logger.error(f"Failed to initialize SQLite memory database at {self.db_path}: {e}")
            raise

    def get_or_create_session(self, session_id: Optional[str] = None, title: Optional[str] = None) -> str:
        """
        Verify an existing session or create a new isolated session.
        """
        sid = (session_id or "").strip() or f"sess-{uuid.uuid4().hex[:12]}"
        now = time.time()
        with self._get_connection() as conn:
            row = conn.execute("SELECT session_id FROM chat_sessions WHERE session_id = ?", (sid,)).fetchone()
            if not row:
                conn.execute(
                    "INSERT INTO chat_sessions (session_id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
                    (sid, title or "Company Brain Session", now, now)
                )
            else:
                conn.execute(
                    "UPDATE chat_sessions SET updated_at = ? WHERE session_id = ?",
                    (now, sid)
                )
        return sid

    def add_message(
        self,
        session_id: str,
        role: str,
        content: str,
        evidence: Optional[List[Dict[str, Any]]] = None
    ) -> str:
        """
        Persist a message in the session.
        """
        sid = self.get_or_create_session(session_id)
        msg_id = f"msg-{uuid.uuid4().hex[:12]}"
        now = time.time()
        ev_json = json.dumps(evidence or [])

        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO chat_messages (id, session_id, role, content, evidence_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (msg_id, sid, role, content, ev_json, now)
            )
            conn.execute("UPDATE chat_sessions SET updated_at = ? WHERE session_id = ?", (now, sid))
        return msg_id

    def get_messages(self, session_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Retrieve chronological message history for a specific session.
        """
        with self._get_connection() as conn:
            cursor = conn.execute(
                """
                SELECT id, session_id, role, content, evidence_json, created_at
                FROM (
                    SELECT id, session_id, role, content, evidence_json,
                           created_at, rowid AS message_order
                    FROM chat_messages
                    WHERE session_id = ?
                    ORDER BY created_at DESC, rowid DESC
                    LIMIT ?
                )
                ORDER BY created_at ASC, message_order ASC
                """,
                (session_id, limit)
            )
            rows = cursor.fetchall()
            messages = []
            for r in rows:
                ev = []
                if r["evidence_json"]:
                    try:
                        ev = json.loads(r["evidence_json"])
                    except Exception:
                        ev = []
                messages.append({
                    "id": r["id"],
                    "session_id": r["session_id"],
                    "role": r["role"],
                    "content": r["content"],
                    "evidence": ev,
                    "created_at": r["created_at"]
                })
            return messages

    def add_fact(self, session_id: str, fact_text: str, entity_ref: Optional[str] = None) -> str:
        """
        Store a user-stated or extracted session fact.
        """
        sid = self.get_or_create_session(session_id)
        fact_id = f"fact-{uuid.uuid4().hex[:12]}"
        now = time.time()
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO extracted_facts (id, session_id, fact_text, entity_ref, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (fact_id, sid, fact_text, entity_ref, now)
            )
        return fact_id

    def get_facts(self, session_id: str) -> List[Dict[str, Any]]:
        """
        Retrieve session-scoped facts.
        """
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT id, session_id, fact_text, entity_ref, created_at FROM extracted_facts WHERE session_id = ? ORDER BY created_at ASC",
                (session_id,)
            )
            return [dict(r) for r in cursor.fetchall()]

    def get_conversation_context(self, session_id: Optional[str], max_turns: int = 5) -> str:
        """
        Format recent conversation turns and facts for LLM context.
        Explicitly clarifies that memory is conversation context, NOT verified company graph facts.
        """
        if not session_id:
            return ""

        msgs = self.get_messages(session_id, limit=max_turns * 2)
        facts = self.get_facts(session_id)

        if not msgs and not facts:
            return ""

        lines = [
            "### PRIOR CONVERSATION MEMORY (Session-Scoped)",
            "CRITICAL NOTE: The following statements are remembered from user conversation history.",
            "They are NOT verified graph facts in FalkorDB. Do NOT treat them as ground truth without graph evidence.",
            ""
        ]

        if facts:
            lines.append("Remembered Session Notes:")
            for f in facts:
                ref = f" (ref: {f['entity_ref']})" if f.get("entity_ref") else ""
                lines.append(f"- {f['fact_text']}{ref}")
            lines.append("")

        if msgs:
            lines.append("Recent Dialogue Turns:")
            for m in msgs[-max_turns * 2:]:
                prefix = "User" if m["role"] == "user" else "Assistant"
                # Strip long markdown to avoid token bloat
                first_lines = m["content"].strip().split("\n")[:4]
                snippet = " ".join(first_lines)[:250]
                lines.append(f"{prefix}: {snippet}")

        return "\n".join(lines)

    def clear_session(self, session_id: str) -> bool:
        """
        Erase session history and associated facts.
        """
        with self._get_connection() as conn:
            conn.execute("DELETE FROM chat_messages WHERE session_id = ?", (session_id,))
            conn.execute("DELETE FROM extracted_facts WHERE session_id = ?", (session_id,))
            conn.execute("DELETE FROM chat_sessions WHERE session_id = ?", (session_id,))
        return True


# Singleton accessor
_memory_service: Optional[MemoryService] = None

def get_memory_service(db_path: Optional[str] = None) -> MemoryService:
    global _memory_service
    if _memory_service is None or db_path is not None:
        _memory_service = MemoryService(db_path=db_path)
    return _memory_service
