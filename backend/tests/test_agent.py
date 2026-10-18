"""
Unit tests for OrgMind GraphAgent and Tool-Calling mechanisms.
Verifies bounded read-only Cypher execution, mutation blocking,
schema retrieval, and evidence-grounded responses.
"""

import pytest
from app.db.falkor import FalkorDBService
from app.services.agent.tools import AgentGraphTools
from app.services.agent.agent import GraphAgent
from app.services.memory import MemoryService


@pytest.fixture
def test_falkor():
    falkor = FalkorDBService()
    falkor.mode = "demo"
    return falkor


@pytest.fixture
def tools(test_falkor):
    return AgentGraphTools(falkor_service=test_falkor)


def test_tool_definitions(tools):
    defs = tools.get_tool_definitions()
    assert len(defs) == 4
    names = [d["function"]["name"] for d in defs]
    assert "get_graph_schema" in names
    assert "query_cypher_readonly" in names
    assert "search_entities" in names
    assert "get_entity_neighbors" in names


def test_readonly_cypher_allows_queries(tools):
    valid_queries = [
        "MATCH (n) RETURN n LIMIT 10",
        "MATCH (p:Project)-[:HAS_TASK]->(t:Task) WHERE t.status = 'BLOCKED' RETURN p, t",
        "MATCH (d:Decision) WITH d ORDER BY d.date DESC RETURN d",
    ]
    for q in valid_queries:
        is_safe, err = tools.validate_readonly_cypher(q)
        assert is_safe, f"Query wrongly flagged as unsafe: {q} (error: {err})"


def test_readonly_cypher_blocks_mutations(tools):
    forbidden_queries = [
        "CREATE (n:Person {name: 'Malicious'})",
        "MATCH (n:Task) DELETE n",
        "MATCH (n:Task) DETACH DELETE n",
        "MATCH (n:Person {id: 'person-elena'}) SET n.role = 'Hacked'",
        "MERGE (p:Project {id: 'fake-proj'})",
        "MATCH (n) REMOVE n.status",
    ]
    for q in forbidden_queries:
        is_safe, err = tools.validate_readonly_cypher(q)
        assert not is_safe, f"Mutation query was NOT blocked: {q}"
        assert "forbidden" in err.lower()

        # Test tool execution returns rejection
        res = tools.query_cypher_readonly(q)
        assert res.get("success") is False
        assert "forbidden" in res.get("error", "").lower()


def test_search_entities_tool(tools):
    res = tools.search_entities("Titan")
    assert res["success"] is True
    assert res["match_count"] >= 1
    found_ids = [n["id"] for n in res["nodes"]]
    assert "proj-titan" in found_ids or "team-titan" in found_ids


def test_get_entity_neighbors_tool(tools):
    res = tools.get_entity_neighbors("proj-titan")
    assert res["success"] is True
    assert res["target"]["id"] == "proj-titan"
    assert res["neighbors_count"] > 1
    assert res["edges_count"] > 1


def test_agent_generates_grounded_answer_with_memory(test_falkor, tmp_path):
    mem_path = str(tmp_path / "agent_test_mem.db")
    mem = MemoryService(db_path=mem_path)
    agent = GraphAgent(falkor_service=test_falkor, memory_service=mem)

    session_id = "test-agent-sess"
    res = agent.answer_question(
        query="Why is Project Titan delayed?",
        project_context="proj-titan",
        session_id=session_id
    )

    assert "Direct Answer" in res["answer"]
    assert "Verified Graph Evidence" in res["answer"]
    assert len(res["evidence"]) > 0
    assert "proj-titan" in res["highlight_nodes"]
    assert res["session_id"] == session_id

    # Check that turn was persisted to memory
    messages = mem.get_messages(session_id)
    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert messages[1]["role"] == "assistant"
    assert len(messages[1]["evidence"]) > 0


def test_empty_graph_reported_honestly(tmp_path):
    # Setup mock Falkor with 0 nodes
    empty_falkor = FalkorDBService()
    empty_falkor.mode = "live"
    empty_falkor.graph = None  # not connected
    empty_falkor.mock_nodes = {}
    empty_falkor.mock_edges = []

    mem = MemoryService(db_path=str(tmp_path / "empty_test.db"))
    agent = GraphAgent(falkor_service=empty_falkor, memory_service=mem)

    res = agent.answer_question("What is the status of Project Titan?")
    assert (
        "no records were found in the database" in res["answer"].lower()
        or "empty" in res["answer"].lower()
        or "0 records" in res["answer"].lower()
        or "insufficient evidence" in res["answer"].lower()
    )
    assert res["confidence"] == 0.0
    assert len(res["evidence"]) == 0


def test_agent_memory_distinction_from_graph_facts(test_falkor, tmp_path):
    mem_path = str(tmp_path / "distinction_test_mem.db")
    mem = MemoryService(db_path=mem_path)
    agent = GraphAgent(falkor_service=test_falkor, memory_service=mem)

    session_id = "fact-distinction-sess"
    # Seed user statement
    agent.answer_question(
        query="Remember that Marcus Vance is the primary engineer on call this week.",
        session_id=session_id
    )

    # Ask follow up
    res = agent.answer_question(
        query="Who did I say is on call this week?",
        session_id=session_id
    )

    assert "Marcus Vance" in res["answer"]
    # Verify that memory is clearly labeled or distinguished from graph truth
    answer_lower = res["answer"].lower()
    assert (
        "earlier statement" in answer_lower
        or "conversation" in answer_lower
        or "you said" in answer_lower
        or "not" in answer_lower
    )
