"""
Strict schema and validation for the writable Company Knowledge Database records.

Only the labels and properties declared here can be created, updated, or deleted
through the API. Write queries are generated from these allowlists with fully
parameterized values, so no caller-supplied Cypher (or property name) ever reaches
the database engine.
"""

from __future__ import annotations
from typing import Any, Dict, Iterable, List
import uuid

#: Node labels that the GUI is allowed to write to.
RECORD_LABELS: tuple[str, ...] = (
    "Project",
    "Team",
    "Person",
    "Task",
    "Decision",
    "Document",
)

#: Prefix used when the server generates a new record id.
ID_PREFIX: Dict[str, str] = {
    "Project": "proj",
    "Team": "team",
    "Person": "person",
    "Task": "task",
    "Decision": "dec",
    "Document": "doc",
}

#: Strict per-label property allowlist. Any key outside this set is rejected.
ALLOWED_PROPERTIES: Dict[str, List[str]] = {
    "Project": [
        "name", "title", "key", "status", "target_date",
        "delay_days", "progress", "description", "summary",
    ],
    "Team": [
        "name", "title", "department", "lead_name",
        "description", "summary", "status",
    ],
    "Person": [
        "name", "title", "role", "email", "team",
        "description", "summary", "status",
    ],
    "Task": [
        "name", "title", "status", "priority", "due_date",
        "delay_days", "blocker_reason", "description", "summary",
    ],
    "Decision": [
        "name", "title", "status", "date", "impact",
        "rationale", "description", "summary",
    ],
    "Document": [
        "name", "title", "type", "url", "summary",
        "description", "updated_at", "status",
    ],
}

#: Properties stored as numbers rather than strings.
NUMERIC_PROPERTIES = {"delay_days", "progress"}

#: Numeric properties that must not be negative.
NON_NEGATIVE_PROPERTIES = {"delay_days", "progress"}

#: Properties that carry the human-readable record title.
TITLE_PROPERTIES = ("name", "title")

#: Maximum accepted length for a string property.
MAX_STRING_LENGTH = 2000


class RecordValidationError(ValueError):
    """Raised when a label or property payload violates the record schema."""


def validate_label(label: str) -> str:
    """Return a canonical allowed label or raise RecordValidationError."""
    if not isinstance(label, str) or not label.strip():
        raise RecordValidationError("A record label is required.")
    normalized = label.strip()
    if normalized not in RECORD_LABELS:
        raise RecordValidationError(
            f"Unsupported record label '{normalized}'. "
            f"Allowed labels: {', '.join(RECORD_LABELS)}."
        )
    return normalized


def normalize_properties(label: str, raw: Any) -> Dict[str, Any]:
    """
    Validate and coerce a raw properties mapping for ``label``.

    Rejects unknown property names, non-numeric values for numeric fields, and
    negative values where they are not meaningful. Never mutates the input.
    """
    if raw is None:
        raw = {}
    if not isinstance(raw, dict):
        raise RecordValidationError("Record properties must be an object.")

    allowed = set(ALLOWED_PROPERTIES[label])
    unknown = [key for key in raw.keys() if key not in allowed]
    if unknown:
        raise RecordValidationError(
            f"Unknown propert{'y' if len(unknown) == 1 else 'ies'} for {label}: "
            f"{', '.join(sorted(unknown))}. "
            f"Allowed: {', '.join(ALLOWED_PROPERTIES[label])}."
        )

    normalized: Dict[str, Any] = {}
    for key, value in raw.items():
        if value is None:
            continue
        if key in NUMERIC_PROPERTIES:
            number = _coerce_number(key, value)
            if key in NON_NEGATIVE_PROPERTIES and number < 0:
                raise RecordValidationError(
                    f"Property '{key}' must be zero or a positive number."
                )
            normalized[key] = number
        else:
            if isinstance(value, str):
                text = value.strip()
            else:
                text = str(value).strip()
            if len(text) > MAX_STRING_LENGTH:
                raise RecordValidationError(
                    f"Property '{key}' exceeds the maximum length of {MAX_STRING_LENGTH} characters."
                )
            normalized[key] = text

    return normalized


def has_title(properties: Dict[str, Any]) -> bool:
    """True when at least one human-readable title property is non-empty."""
    return any(str(properties.get(key, "")).strip() for key in TITLE_PROPERTIES)


def generate_id(label: str) -> str:
    """Generate a collision-resistant, label-prefixed record id."""
    return f"{ID_PREFIX[label]}-{uuid.uuid4().hex[:10]}"


def _coerce_number(key: str, value: Any) -> Any:
    if isinstance(value, bool):
        raise RecordValidationError(f"Property '{key}' must be a number.")
    if isinstance(value, (int, float)):
        return int(value) if float(value).is_integer() else float(value)
    text = str(value).strip()
    if text == "":
        raise RecordValidationError(f"Property '{key}' must be a number.")
    try:
        number = float(text)
    except ValueError:
        raise RecordValidationError(f"Property '{key}' must be a number.") from None
    return int(number) if number.is_integer() else number
