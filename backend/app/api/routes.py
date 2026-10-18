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
    ConnectionStatusResponse,
    RecordCreateRequest,
    RecordUpdateRequest,
    RecordMutationResponse,
)

router = APIRouter(prefix="/api")


def _record_error_status(error_code: Optional[str]) -> int:
    """Map a record write error code to an HTTP status."""
    if error_code == "write_disabled":
        return 409
    if error_code == "not_found":
        return 404
    if error_code == "validation":
        return 400
    return 500



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
        "allow_live_writes": settings.orgmind_allow_live_writes,
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
def seed_database(opt_in: bool = False, force: bool = False):
    """
    Idempotently seed the active database (live FalkorDB or demo engine).
    """
    falkor = get_falkor_service()
    result = falkor.seed(opt_in=opt_in, force=force)
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
    result = brain.answer_question(
        query=req.query,
        project_context=req.project_context,
        session_id=req.session_id
    )
    return result


@router.get("/chat/history")
def get_chat_history(session_id: str = Query(..., description="Session identifier")):
    from app.services.memory import get_memory_service
    mem = get_memory_service()
    return {
        "session_id": session_id,
        "messages": mem.get_messages(session_id),
        "facts": mem.get_facts(session_id)
    }


@router.post("/chat/clear")
def clear_chat_history(session_id: str = Query(..., description="Session identifier")):
    from app.services.memory import get_memory_service
    mem = get_memory_service()
    mem.clear_session(session_id)
    return {"success": True, "session_id": session_id}


@router.post("/cypher")
def run_direct_cypher(req: DirectCypherRequest):
    """
    Execute read-only or diagnostic Cypher query.
    """
    falkor = get_falkor_service()
    return falkor.execute_cypher(req.cypher, req.params)


@router.post("/records", response_model=RecordMutationResponse)
def create_record(req: RecordCreateRequest):
    """
    Create a database record for an allowlisted node label.

    Writes are refused (HTTP 409) unless the service is connected to a live
    FalkorDB graph and the operator has opted in with
    ORGMIND_ALLOW_LIVE_WRITES=true. Values are always bound as query parameters.
    """
    falkor = get_falkor_service()
    result = falkor.create_record(req.label, req.properties)
    if not result.get("success"):
        raise HTTPException(
            status_code=_record_error_status(result.get("error_code")),
            detail=result.get("error", "Record could not be created.")
        )
    return result


@router.put("/records/{node_id}", response_model=RecordMutationResponse)
def update_record(node_id: str, req: RecordUpdateRequest):
    """
    Update allowlisted properties on an existing record.
    """
    falkor = get_falkor_service()
    result = falkor.update_record(node_id, req.label, req.properties)
    if not result.get("success"):
        raise HTTPException(
            status_code=_record_error_status(result.get("error_code")),
            detail=result.get("error", "Record could not be updated.")
        )
    return result


@router.delete("/records/{node_id}", response_model=RecordMutationResponse)
def delete_record(node_id: str):
    """
    Delete a record and its relationships.
    """
    falkor = get_falkor_service()
    result = falkor.delete_record(node_id)
    if not result.get("success"):
        raise HTTPException(
            status_code=_record_error_status(result.get("error_code")),
            detail=result.get("error", "Record could not be deleted.")
        )
    return result
