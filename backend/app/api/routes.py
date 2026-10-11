from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException, Query
from app.config import get_settings, update_settings
from app.db.falkor import get_falkor_service
from app.services.brain_service import get_brain_service
from app.api.models import (
    QuestionRequest,
    QuestionResponse,
    TestConnectionRequest,
    DirectCypherRequest,
    ConnectionStatusResponse
)

router = APIRouter(prefix="/api")


@router.get("/health")
def health_check():
    falkor = get_falkor_service()
    return {
        "status": "healthy",
        "service": "OrgMind Company Brain API",
        "database_connected": falkor.is_connected,
        "database_mode": falkor.mode,
        "graph_name": falkor.graph_name,
        "last_error": falkor.last_error
    }


@router.get("/config")
def get_config():
    falkor = get_falkor_service()
    settings = get_settings()
    return {
        "falkordb_host": settings.falkordb_host or "None (Demo Mode)",
        "falkordb_port": settings.falkordb_port,
        "falkordb_username": settings.falkordb_username,
        "falkordb_password_set": bool(settings.falkordb_password),
        "falkordb_graph": falkor.graph_name,
        "falkordb_ssl": settings.falkordb_ssl,
        "mode": falkor.mode,
        "is_connected": falkor.is_connected,
        "last_error": falkor.last_error
    }


@router.post("/test-connection")
def test_connection(req: TestConnectionRequest):
    falkor = get_falkor_service()
    result = falkor.test_connection_params(
        host=req.host,
        port=req.port,
        username=req.username,
        password=req.password,
        ssl=req.ssl,
        graph_name=req.graph_name
    )
    return result


@router.post("/connect")
def connect_database(req: TestConnectionRequest):
    """
    Connect to FalkorDB Cloud and persist configuration in-memory.
    """
    falkor = get_falkor_service()
    success, msg = falkor.connect(
        host=req.host,
        port=req.port,
        username=req.username,
        password=req.password,
        ssl=req.ssl,
        graph_name=req.graph_name
    )
    if success:
        update_settings(
            falkordb_host=req.host,
            falkordb_port=req.port,
            falkordb_username=req.username,
            falkordb_password=req.password,
            falkordb_ssl=req.ssl,
            falkordb_graph=req.graph_name,
            demo_mode=False
        )
        return {
            "success": True,
            "message": msg,
            "mode": falkor.mode,
            "graph_name": falkor.graph_name
        }
    else:
        return {
            "success": False,
            "error": msg,
            "mode": falkor.mode
        }


@router.post("/switch-demo")
def switch_demo_mode():
    """
    Switch back to Zero-Config Demo Mode.
    """
    falkor = get_falkor_service()
    falkor.mode = "demo"
    falkor.is_connected = False
    falkor.last_error = None
    update_settings(demo_mode=True)
    return {
        "success": True,
        "message": "Switched to Zero-Config Demo Mode (in-memory graph)",
        "mode": "demo"
    }


@router.post("/seed")
def seed_database():
    """
    Idempotently seed the active database (live FalkorDB or demo engine).
    """
    falkor = get_falkor_service()
    result = falkor.seed()
    return result


@router.get("/graph")
def get_graph(project_id: Optional[str] = Query(None, description="Optional project filter")):
    falkor = get_falkor_service()
    return falkor.get_full_graph(project_filter=project_id)


@router.get("/schema")
def get_schema():
    falkor = get_falkor_service()
    return falkor.get_schema()


@router.post("/query", response_model=QuestionResponse)
def ask_brain(req: QuestionRequest):
    brain = get_brain_service()
    result = brain.answer_question(query=req.query, project_context=req.project_context)
    return result


@router.post("/cypher")
def run_direct_cypher(req: DirectCypherRequest):
    """
    Execute read-only or diagnostic Cypher query.
    """
    falkor = get_falkor_service()
    return falkor.execute_cypher(req.cypher, req.params)
