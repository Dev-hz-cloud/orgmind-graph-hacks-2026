"""
Bounded, validated read-only FalkorDB tools for the OrgMind Company Brain Agent.
Enforces read-only safety, rejecting any Cypher mutation keywords.
"""

from __future__ import annotations
import logging
import re
from typing import Any, Dict, List, Optional, Tuple
from app.db.falkor import FalkorDBService, get_falkor_service

logger = logging.getLogger("orgmind.agent.tools")

# Forbidden Cypher keywords that mutate graph data
MUTATION_KEYWORDS = {
    "CREATE", "MERGE", "DELETE", "SET", "REMOVE", "DROP", "DETACH"
}


class AgentGraphTools:
    def __init__(self, falkor_service: Optional[FalkorDBService] = None):
        self.falkor = falkor_service or get_falkor_service()

    def get_tool_definitions(self) -> List[Dict[str, Any]]:
        """Return tool definitions in OpenAI-compatible function-calling schema."""
        return [
            {
                "type": "function",
                "function": {
                    "name": "get_graph_schema",
                    "description": "Inspect the graph schema: node labels, relationship types, total counts, and connection mode. Always call this first when exploring what data exists.",
                    "parameters": {
                        "type": "object",
                        "properties": {},
                        "required": []
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "query_cypher_readonly",
                    "description": "Execute a bounded, strictly read-only Cypher query against FalkorDB. Mutations (CREATE, SET, DELETE, MERGE, DROP) are strictly forbidden and will be rejected.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "cypher": {
                                "type": "string",
                                "description": "Read-only Cypher statement (e.g. MATCH (p:Project)-[:HAS_TASK]->(t:Task) WHERE t.status = 'BLOCKED' RETURN p, t)"
                            },
                            "params": {
                                "type": "object",
                                "description": "Optional parameters dictionary for the Cypher query"
                            }
                        },
                        "required": ["cypher"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "search_entities",
                    "description": "Search for entities in the graph by keyword or property value across Project, Team, Person, Task, Decision, and Document.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "Keyword to search in entity titles, names, IDs, or descriptions"
                            },
                            "label": {
                                "type": "string",
                                "description": "Optional label filter (Project, Team, Person, Task, Decision, Document)"
                            }
                        },
                        "required": ["query"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_entity_neighbors",
                    "description": "Retrieve an entity by ID and all its directly connected 1-hop and 2-hop relationships, neighbors, and properties.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "entity_id": {
                                "type": "string",
                                "description": "Exact entity ID as stored in the graph (e.g. 'proj-1a2b3c4d', 'task-5e6f7a8b', 'person-90abcd12')"
                            }
                        },
                        "required": ["entity_id"]
                    }
                }
            }
        ]

    def execute_tool(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and dispatch tool execution."""
        try:
            if name == "get_graph_schema":
                return self.get_schema()
            elif name == "query_cypher_readonly":
                cypher = arguments.get("cypher", "")
                params = arguments.get("params") or {}
                return self.query_cypher_readonly(cypher, params)
            elif name == "search_entities":
                query = arguments.get("query", "")
                label = arguments.get("label")
                return self.search_entities(query, label)
            elif name == "get_entity_neighbors":
                entity_id = arguments.get("entity_id", "")
                return self.get_entity_neighbors(entity_id)
            else:
                return {
                    "success": False,
                    "error": f"Unknown tool: '{name}'"
                }
        except Exception as e:
            logger.error(f"Error executing agent tool {name}: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    def get_schema(self) -> Dict[str, Any]:
        """Return graph schema."""
        return self.falkor.get_schema()

    def validate_readonly_cypher(self, cypher: str) -> Tuple[bool, Optional[str]]:
        """Verify that a Cypher query contains no mutating keywords."""
        # Remove single-line comments and strings to avoid false positives on comments
        cleaned = re.sub(r'//.*?\n', ' ', cypher)
        cleaned = re.sub(r'"[^"]*"', '""', cleaned)
        cleaned = re.sub(r"'[^']*'", "''", cleaned)

        tokens = set(re.findall(r'\b[A-Z]+\b', cleaned.upper()))
        forbidden_found = tokens.intersection(MUTATION_KEYWORDS)
        if forbidden_found:
            return False, f"Mutation operation forbidden in read-only tool: found {', '.join(sorted(forbidden_found))}"
        return True, None

    def query_cypher_readonly(self, cypher: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Execute read-only Cypher with validation."""
        is_safe, error_msg = self.validate_readonly_cypher(cypher)
        if not is_safe:
            return {
                "success": False,
                "error": error_msg,
                "cypher": cypher
            }

        params = params or {}
        # Ensure reasonable LIMIT if query has no LIMIT clause
        if "LIMIT" not in cypher.upper():
            cypher = cypher.strip().rstrip(";") + " LIMIT 100"

        return self.falkor.execute_cypher(cypher, params)

    def search_entities(self, keyword: str, label: Optional[str] = None) -> Dict[str, Any]:
        """Search entities by keyword across node properties."""
        graph_data = self.falkor.get_full_graph()
        nodes = graph_data.get("nodes", [])

        kw = keyword.lower().strip()
        matches = []
        for n in nodes:
            if label and n.get("label", "").lower() != label.lower():
                continue
            props = n.get("properties", {})
            # Match against ID, name, title, description, summary, role, email
            searchable = " ".join([
                str(n.get("id", "")),
                str(props.get("name", "")),
                str(props.get("title", "")),
                str(props.get("description", "")),
                str(props.get("summary", "")),
                str(props.get("role", "")),
                str(props.get("email", "")),
            ]).lower()

            if kw in searchable:
                matches.append(n)

        return {
            "success": True,
            "keyword": keyword,
            "match_count": len(matches),
            "nodes": matches[:20]
        }

    def get_entity_neighbors(self, entity_id: str) -> Dict[str, Any]:
        """Retrieve entity and 1-2 hop neighbors."""
        graph_data = self.falkor.get_full_graph()
        nodes_by_id = {n["id"]: n for n in graph_data.get("nodes", [])}
        edges = graph_data.get("edges", [])

        target = nodes_by_id.get(entity_id)
        if not target:
            return {
                "success": False,
                "error": f"Entity '{entity_id}' not found in graph."
            }

        connected_edges = []
        connected_node_ids = {entity_id}

        # 1-hop
        for e in edges:
            if e["src"] == entity_id or e["dst"] == entity_id:
                connected_edges.append(e)
                connected_node_ids.add(e["src"])
                connected_node_ids.add(e["dst"])

        # 2-hop
        second_hop_edges = []
        for e in edges:
            if e not in connected_edges:
                if e["src"] in connected_node_ids or e["dst"] in connected_node_ids:
                    second_hop_edges.append(e)
                    connected_node_ids.add(e["src"])
                    connected_node_ids.add(e["dst"])

        all_edges = connected_edges + second_hop_edges
        all_nodes = [nodes_by_id[nid] for nid in connected_node_ids if nid in nodes_by_id]

        return {
            "success": True,
            "target": target,
            "neighbors_count": len(all_nodes),
            "edges_count": len(all_edges),
            "nodes": all_nodes,
            "edges": all_edges
        }
