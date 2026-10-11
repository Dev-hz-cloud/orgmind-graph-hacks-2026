from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class QuestionRequest(BaseModel):
    query: str = Field(..., description="The user's natural language question about the organization")
    project_context: Optional[str] = Field(None, description="Active project ID context (e.g. proj-titan)")


class TestConnectionRequest(BaseModel):
    host: str = Field(..., description="FalkorDB host or cloud endpoint")
    port: int = Field(6379, description="Port number")
    username: str = Field("default", description="Username")
    password: str = Field("", description="Password")
    ssl: bool = Field(False, description="Enable SSL/TLS")
    graph_name: str = Field("orgmind_demo", description="Graph database key/name")


class DirectCypherRequest(BaseModel):
    cypher: str = Field(..., description="Cypher query string to execute")
    params: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Query parameters")


class EvidenceItem(BaseModel):
    id: str
    type: str
    entity_id: str
    label: str
    title: str
    summary: str
    properties: Dict[str, Any]


class QuestionResponse(BaseModel):
    query: str
    cypher: str
    cypher_params: Dict[str, Any]
    answer: str
    evidence: List[EvidenceItem]
    highlight_nodes: List[str]
    highlight_edges: List[str]
    confidence: float
    mode: str


class ConnectionStatusResponse(BaseModel):
    is_connected: bool
    mode: str
    graph_name: str
    host: str
    port: int
    last_error: Optional[str] = None
