from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class QuestionRequest(BaseModel):
    query: str = Field(..., description="The user's natural language question about the organization")
    project_context: Optional[str] = Field(None, description="Active project ID context (e.g. proj-1a2b3c4d)")
    session_id: Optional[str] = Field(None, description="Optional persistent session ID for conversation memory")


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


class GraphNodeRecord(BaseModel):
    id: str
    label: str
    properties: Dict[str, Any]


class RecordCreateRequest(BaseModel):
    label: str = Field(..., description="Record label (Project, Team, Person, Task, Decision, Document)")
    properties: Dict[str, Any] = Field(default_factory=dict, description="Allowlisted record properties")


class RecordUpdateRequest(BaseModel):
    label: str = Field(..., description="Record label (Project, Team, Person, Task, Decision, Document)")
    properties: Dict[str, Any] = Field(default_factory=dict, description="Allowlisted record properties")


class RecordMutationResponse(BaseModel):
    success: bool
    node: Optional[GraphNodeRecord] = None
    deleted_id: Optional[str] = None
    error: Optional[str] = None
    error_code: Optional[str] = None
    mode: str
    graph_name: Optional[str] = None


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
    session_id: Optional[str] = None
    direct_answer: Optional[str] = None
    summary_stats: Optional[Dict[str, Any]] = None
    causal_chain: Optional[List[Dict[str, Any]]] = None
    blockers: Optional[List[Dict[str, Any]]] = None
    missing_facts: Optional[List[str]] = None


class ConnectionStatusResponse(BaseModel):
    is_connected: bool
    mode: str
    graph_name: str
    host: str
    port: int
    last_error: Optional[str] = None
