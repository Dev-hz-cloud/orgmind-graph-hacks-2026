from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root_endpoint():
    res = client.get("/")
    assert res.status_code == 200
    data = res.json()
    assert data["app"] == "OrgMind"


def test_health_endpoint():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "database_mode" in data


def test_config_endpoint():
    res = client.get("/api/config")
    assert res.status_code == 200
    data = res.json()
    assert "falkordb_graph" in data
    # Password should NOT be exposed
    assert "falkordb_password" not in data


def test_get_graph_endpoint():
    res = client.get("/api/graph")
    assert res.status_code == 200
    data = res.json()
    assert "nodes" in data
    assert "edges" in data
    assert len(data["nodes"]) > 0


def test_get_schema_endpoint():
    res = client.get("/api/schema")
    assert res.status_code == 200
    data = res.json()
    assert "labels" in data
    assert "relationships" in data


def test_query_endpoint():
    res = client.post("/api/query", json={"query": "Why is Project Titan delayed?"})
    assert res.status_code == 200
    data = res.json()
    assert "answer" in data
    assert len(data["evidence"]) > 0
    assert len(data["highlight_nodes"]) > 0


def test_seed_endpoint():
    res = client.post("/api/seed")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
