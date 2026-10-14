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


def test_unrecognised_question_is_flagged_not_guessed(brain):
    """An unmatched question must say so instead of silently returning the
    project-delay analysis as if it were the answer."""
    res = brain.answer_question("What is the capital of France?")
    assert "not recognised" in res["answer"].lower()
    assert res["direct_answer"] is None
    assert res["confidence"] < 1.0
    assert res["missing_facts"]
    assert res["highlight_nodes"]  # the graph still highlights the closest match


def test_unrecognised_question_still_has_a_usable_shape(brain):
    res = brain.answer_question("tell me about the team")
    assert "not recognised" in res["answer"].lower()
    for key in ("query", "cypher", "cypher_params", "answer", "evidence",
                "highlight_nodes", "highlight_edges", "confidence", "mode"):
        assert key in res


def test_supported_intents_still_answer_their_own_question(brain):
    cases = {
        "Why is Project Titan delayed?": "Delay Root-Cause Analysis",
        "Which tasks are blocking this launch?": "Active Blocking Tasks",
        "Who owns the blocking task?": "Ownership of Blocked Tasks",
        "Which decisions are still pending?": "Pending Organizational Decisions",
        "What depends on Deploy Multi-Region API Gateway v2?": "Downstream Dependencies",
        "Show the evidence connected to this issue": "Evidence Records",
    }
    for question, marker in cases.items():
        res = brain.answer_question(question)
        assert marker in res["answer"], f"{question} -> {res['answer'][:60]}"
        assert "not recognised" not in res["answer"].lower()
        assert res["confidence"] == 1.0


def test_schema_statistics(brain):
    schema = brain.falkor.get_schema()
    assert "Project" in schema["labels"]
    assert "Task" in schema["labels"]
    assert "Person" in schema["labels"]
    assert "Decision" in schema["labels"]
    assert "Document" in schema["labels"]
    assert "BLOCKED_BY" in schema["relationships"]
    assert "HAS_TASK" in schema["relationships"]
