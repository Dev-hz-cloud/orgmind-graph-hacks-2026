import pytest
from app.db.falkor import FalkorDBService
from app.services.brain_service import BrainService


@pytest.fixture
def brain():
    falkor = FalkorDBService()
    falkor.mode = "demo"
    return BrainService(falkor)


def test_why_delayed_question(brain):
    res = brain.answer_question("Why is Project Titan delayed?")
    assert res["query"] == "Why is Project Titan delayed?"
    assert "Titan" in res["answer"]
    assert "BLOCKED" in res["answer"]
    assert len(res["evidence"]) > 0
    assert "proj-titan" in res["highlight_nodes"]
    assert "task-deploy-gateway" in res["highlight_nodes"]
    assert "task-sec-signoff" in res["highlight_nodes"]
    assert "dec-telemetry-residency" in res["highlight_nodes"]
    assert "Elena Rostova" in res["answer"] or "Aisha Patel" in res["answer"]


def test_blocking_tasks_question(brain):
    res = brain.answer_question("Which tasks are blocking this launch?")
    assert "blocked tasks" in res["answer"].lower()
    assert len(res["evidence"]) >= 1
    assert any("Deploy Multi-Region API Gateway" in e["title"] for e in res["evidence"])


def test_task_owner_question(brain):
    res = brain.answer_question("Who owns the blocking task?")
    assert "Ownership" in res["answer"]
    assert len(res["evidence"]) > 0
    assert any(e["label"] == "Person" for e in res["evidence"])


def test_pending_decisions_question(brain):
    res = brain.answer_question("Which decisions are still pending?")
    assert "DEC-2024-08" in res["answer"] or "DEC-2024-11" in res["answer"]
    assert any(e["label"] == "Decision" for e in res["evidence"])


def test_what_depends_on_task(brain):
    res = brain.answer_question("What depends on Deploy Multi-Region API Gateway v2?")
    assert "Downstream" in res["answer"]
    assert "task-deploy-gateway" in res["highlight_nodes"]


def test_evidence_explorer_question(brain):
    res = brain.answer_question("Show the evidence connected to this issue")
    assert "Evidence" in res["answer"]
    assert any(e["type"] == "document" for e in res["evidence"])
    assert any("ADR-08" in e["title"] or "SEC-2024-Q3" in e["title"] for e in res["evidence"])


def test_project_filtering(brain):
    full_graph = brain.falkor.get_full_graph()
    assert full_graph["node_count"] > 10

    filtered = brain.falkor.get_full_graph(project_filter="proj-apollo")
    assert filtered["node_count"] < full_graph["node_count"]
    assert any(n["id"] == "proj-apollo" for n in filtered["nodes"])


def test_schema_statistics(brain):
    schema = brain.falkor.get_schema()
    assert "Project" in schema["labels"]
    assert "Task" in schema["labels"]
    assert "Person" in schema["labels"]
    assert "Decision" in schema["labels"]
    assert "Document" in schema["labels"]
    assert "BLOCKED_BY" in schema["relationships"]
    assert "HAS_TASK" in schema["relationships"]
