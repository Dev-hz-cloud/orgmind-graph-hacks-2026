"""
Tests for the writable Company Knowledge Database record API.

These tests exercise validation, parameterization, and write-guard behavior
without touching a live database. A fake graph stands in for FalkorDB so we can
assert exactly which Cypher and parameters would be sent.
"""

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.db.falkor import FalkorDBService
from app.db.record_schema import (
    RecordValidationError,
    normalize_properties,
    validate_label,
)
from app.main import app
from app.api import routes as routes_module

client = TestClient(app)


class FakeResult:
    def __init__(self, result_set=None):
        self.result_set = result_set or []
        self.header = []


class FakeGraph:
    """Records queries and emulates just enough return shape for the CRUD code."""

    def __init__(self, existing=None):
        self.existing = existing or {}
        self.calls = []

    def query(self, cypher, params=None):
        params = params or {}
        self.calls.append((cypher, params))
        node_id = params.get("id")
        if "RETURN labels" in cypher:
            if node_id in self.existing:
                return FakeResult([[self.existing[node_id]]])
            return FakeResult([])
        if "RETURN n.id" in cypher:
            if node_id in self.existing:
                return FakeResult([[node_id]])
            return FakeResult([])
        return FakeResult([["ok"]])


def make_service(mode="live", connected=True, existing=None, allow_writes=True):
    """Build a FalkorDBService without opening a socket.

    Each service gets its own copy of the settings so toggling the live-write
    opt-in in one test can never leak into another.
    """
    svc = FalkorDBService.__new__(FalkorDBService)
    svc.settings = get_settings().model_copy(
        update={"orgmind_allow_live_writes": allow_writes}
    )
    svc.client = None
    svc.graph = FakeGraph(existing) if connected else None
    svc.mode = mode
    svc.is_connected = connected
    svc.last_error = None
    svc.graph_name = "test_graph"
    svc.mock_nodes = {}
    svc.mock_edges = []
    return svc


# --------------------------------------------------------------------------
# Schema validation
# --------------------------------------------------------------------------

def test_validate_label_accepts_allowlisted_labels():
    for label in ("Project", "Team", "Person", "Task", "Decision", "Document"):
        assert validate_label(label) == label


def test_validate_label_rejects_unknown_label():
    with pytest.raises(RecordValidationError):
        validate_label("Malicious")


def test_normalize_rejects_unknown_property():
    with pytest.raises(RecordValidationError) as exc:
        normalize_properties("Task", {"title": "x", "evil": "drop table"})
    assert "Unknown property" in str(exc.value)


def test_normalize_rejects_negative_delay():
    with pytest.raises(RecordValidationError):
        normalize_properties("Task", {"title": "x", "delay_days": -5})


def test_normalize_coerces_numeric_strings():
    props = normalize_properties("Task", {"title": "x", "delay_days": "7"})
    assert props["delay_days"] == 7


# --------------------------------------------------------------------------
# Service-level CRUD
# --------------------------------------------------------------------------

def test_create_record_uses_parameterized_query():
    svc = make_service()
    result = svc.create_record("Task", {"title": "Telemetry Task", "status": "BLOCKED", "delay_days": 3})

    assert result["success"] is True
    assert result["node"]["label"] == "Task"
    assert result["node"]["id"].startswith("task-")

    cypher, params = svc.graph.calls[0]
    assert "CREATE (n:Task" in cypher
    assert "$props" in cypher
    # The user-supplied value must never be string-interpolated into Cypher.
    assert "Telemetry Task" not in cypher
    assert params["props"]["title"] == "Telemetry Task"


def test_create_record_requires_title():
    svc = make_service()
    result = svc.create_record("Task", {"status": "BLOCKED"})
    assert result["success"] is False
    assert result["error_code"] == "validation"
    assert svc.graph.calls == []


def test_create_record_rejects_unknown_label_without_query():
    svc = make_service()
    result = svc.create_record("Hacker", {"title": "x"})
    assert result["success"] is False
    assert result["error_code"] == "validation"
    assert svc.graph.calls == []


def test_update_record_sets_only_allowlisted_props():
    svc = make_service(existing={"task-1": ["Task"]})
    result = svc.update_record("task-1", "Task", {"status": "BLOCKED", "delay_days": 4})

    assert result["success"] is True
    set_call = [c for c in svc.graph.calls if "SET" in c[0]][0]
    cypher, params = set_call
    assert "SET n.delay_days = $delay_days" in cypher
    assert "n.status = $status" in cypher
    assert params["status"] == "BLOCKED"


def test_update_missing_record_returns_not_found():
    svc = make_service(existing={})
    result = svc.update_record("task-missing", "Task", {"status": "BLOCKED"})
    assert result["success"] is False
    assert result["error_code"] == "not_found"


def test_delete_record_detaches_and_deletes():
    svc = make_service(existing={"task-1": ["Task"]})
    result = svc.delete_record("task-1")
    assert result["success"] is True
    assert any("DETACH DELETE" in c[0] for c in svc.graph.calls)


def test_delete_missing_record_returns_not_found():
    svc = make_service(existing={})
    result = svc.delete_record("ghost")
    assert result["success"] is False
    assert result["error_code"] == "not_found"


def test_delete_non_record_label_refused():
    svc = make_service(existing={"secret-1": ["SystemSecret"]})
    result = svc.delete_record("secret-1")
    assert result["success"] is False
    assert result["error_code"] == "validation"


# --------------------------------------------------------------------------
# Write guards: demo mode / disconnected
# --------------------------------------------------------------------------

@pytest.mark.parametrize("mode,connected", [("demo", False), ("live", False)])
def test_writes_refused_when_not_live_and_connected(mode, connected):
    svc = make_service(mode=mode, connected=connected)

    create = svc.create_record("Task", {"title": "x"})
    update = svc.update_record("task-1", "Task", {"status": "BLOCKED"})
    delete = svc.delete_record("task-1")

    for result in (create, update, delete):
        assert result["success"] is False
        assert result["error_code"] == "write_disabled"

    # No query should ever have been attempted.
    assert svc.graph is None


# --------------------------------------------------------------------------
# Write guards: live-write opt-in (ORGMIND_ALLOW_LIVE_WRITES)
# --------------------------------------------------------------------------

def test_live_writes_disabled_by_default():
    """Live + connected but opt-in off: every write is refused, no query runs."""
    svc = make_service(mode="live", connected=True, allow_writes=False)

    create = svc.create_record("Task", {"title": "x"})
    update = svc.update_record("task-1", "Task", {"status": "BLOCKED"})
    delete = svc.delete_record("task-1")

    for result in (create, update, delete):
        assert result["success"] is False
        assert result["error_code"] == "write_disabled"
        assert "ORGMIND_ALLOW_LIVE_WRITES" in result["error"]
        assert "disabled" in result["error"].lower()

    # The guard must reject before any Cypher is issued.
    assert svc.graph.calls == []


def test_live_writes_enabled_when_opted_in():
    """Live + connected + opt-in on: writes proceed using the isolated fake graph."""
    svc = make_service(mode="live", connected=True, allow_writes=True)

    result = svc.create_record("Task", {"title": "Opted In Task"})
    assert result["success"] is True
    assert result["node"]["label"] == "Task"
    assert any("CREATE" in c[0] for c in svc.graph.calls)


def test_write_opt_in_is_read_per_write_not_cached():
    """Flipping the setting affects the very next write attempt."""
    svc = make_service(mode="live", connected=True, allow_writes=False)
    assert svc.create_record("Task", {"title": "x"})["error_code"] == "write_disabled"

    svc.settings.orgmind_allow_live_writes = True
    assert svc.create_record("Task", {"title": "x"})["success"] is True


# --------------------------------------------------------------------------
# Route-level behavior
# --------------------------------------------------------------------------

def test_create_endpoint_refuses_in_demo_mode(monkeypatch):
    svc = make_service(mode="demo", connected=False)
    monkeypatch.setattr(routes_module, "get_falkor_service", lambda: svc)

    res = client.post("/api/records", json={"label": "Task", "properties": {"title": "x"}})
    assert res.status_code == 409
    assert "not connected" in res.json()["detail"].lower() or "demo" in res.json()["detail"].lower()


def test_create_endpoint_refuses_without_opt_in(monkeypatch):
    """Live + connected but opt-in off must return 409 with enablement guidance."""
    svc = make_service(mode="live", connected=True, allow_writes=False)
    monkeypatch.setattr(routes_module, "get_falkor_service", lambda: svc)

    res = client.post("/api/records", json={"label": "Task", "properties": {"title": "x"}})
    assert res.status_code == 409
    detail = res.json()["detail"]
    assert "ORGMIND_ALLOW_LIVE_WRITES" in detail
    assert svc.graph.calls == []


def test_put_and_delete_endpoints_refuse_without_opt_in(monkeypatch):
    svc = make_service(existing={"task-1": ["Task"]}, allow_writes=False)
    monkeypatch.setattr(routes_module, "get_falkor_service", lambda: svc)

    put = client.put("/api/records/task-1", json={"label": "Task", "properties": {"status": "BLOCKED"}})
    delete = client.delete("/api/records/task-1")
    assert put.status_code == 409
    assert delete.status_code == 409
    assert svc.graph.calls == []


def test_create_endpoint_succeeds_with_opt_in(monkeypatch):
    svc = make_service(mode="live", connected=True, allow_writes=True)
    monkeypatch.setattr(routes_module, "get_falkor_service", lambda: svc)

    res = client.post("/api/records", json={"label": "Task", "properties": {"title": "Opted In"}})
    assert res.status_code == 200
    assert res.json()["success"] is True


def test_create_endpoint_validation_error(monkeypatch):
    svc = make_service()
    monkeypatch.setattr(routes_module, "get_falkor_service", lambda: svc)

    res = client.post("/api/records", json={"label": "Task", "properties": {"evil": "1"}})
    assert res.status_code == 400


def test_create_endpoint_success(monkeypatch):
    svc = make_service()
    monkeypatch.setattr(routes_module, "get_falkor_service", lambda: svc)

    res = client.post("/api/records", json={"label": "Task", "properties": {"title": "New Task", "delay_days": 2}})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["node"]["label"] == "Task"


def test_update_endpoint_not_found(monkeypatch):
    svc = make_service(existing={})
    monkeypatch.setattr(routes_module, "get_falkor_service", lambda: svc)

    res = client.put("/api/records/task-missing", json={"label": "Task", "properties": {"status": "BLOCKED"}})
    assert res.status_code == 404


def test_delete_endpoint_success(monkeypatch):
    svc = make_service(existing={"task-1": ["Task"]})
    monkeypatch.setattr(routes_module, "get_falkor_service", lambda: svc)

    res = client.delete("/api/records/task-1")
    assert res.status_code == 200
    assert res.json()["success"] is True
