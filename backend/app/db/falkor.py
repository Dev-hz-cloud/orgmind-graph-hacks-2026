"""
FalkorDB database service with Live Cloud driver and Zero-Config Fallback engine.
"""

from __future__ import annotations
import logging
from typing import Any, Dict, List, Optional, Tuple
import redis.exceptions

try:
    import falkordb
    from falkordb import FalkorDB, Graph
except ImportError:
    falkordb = None
    FalkorDB = None
    Graph = None

from app.config import get_settings, Settings
from app.db.seed_data import DEMO_NODES, DEMO_EDGES, generate_seed_cypher

logger = logging.getLogger("orgmind.falkor")


class FalkorDBService:
    def __init__(self):
        self.settings: Settings = get_settings()
        self.client: Optional[Any] = None
        self.graph: Optional[Any] = None
        self.mode: str = "demo"  # "live" or "demo"
        self.is_connected: bool = False
        self.last_error: Optional[str] = None
        self.graph_name: str = self.settings.falkordb_graph

        # Embedded in-memory graph storage for fallback demo mode
        self.mock_nodes: Dict[str, Dict[str, Any]] = {n["id"]: dict(n) for n in DEMO_NODES}
        self.mock_edges: List[Dict[str, Any]] = [dict(e) for e in DEMO_EDGES]

        # Attempt initial live connection if host is configured
        if self.settings.falkordb_host and not self.settings.demo_mode:
            self.connect()

    def connect(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        ssl: Optional[bool] = None,
        graph_name: Optional[str] = None,
    ) -> Tuple[bool, str]:
        """
        Connect to a live FalkorDB instance.
        """
        target_host = host if host is not None else self.settings.falkordb_host
        target_port = port if port is not None else self.settings.falkordb_port
        target_user = username if username is not None else self.settings.falkordb_username
        target_pass = password if password is not None else self.settings.falkordb_password
        target_ssl = ssl if ssl is not None else self.settings.falkordb_ssl
        target_graph = graph_name if graph_name is not None else self.settings.falkordb_graph

        if not target_host:
            self.mode = "demo"
            self.is_connected = False
            self.last_error = "No FalkorDB host configured. Running in Demo Mode."
            return False, self.last_error

        try:
            logger.info(f"Connecting to FalkorDB at {target_host}:{target_port} (SSL={target_ssl})...")
            client = FalkorDB(
                host=target_host,
                port=target_port,
                username=target_user or "default",
                password=target_pass or None,
                ssl=target_ssl,
                socket_timeout=5,
                socket_connect_timeout=5,
            )
            g = client.select_graph(target_graph)
            # Lightweight verification query
            g.query("RETURN 1 AS ping")

            self.client = client
            self.graph = g
            self.graph_name = target_graph
            self.mode = "live"
            self.is_connected = True
            self.last_error = None
            logger.info(f"Successfully connected to FalkorDB graph '{target_graph}'.")
            return True, f"Connected to FalkorDB Cloud graph '{target_graph}'."

        except redis.exceptions.AuthenticationError as e:
            self.mode = "demo"
            self.is_connected = False
            self.last_error = f"Authentication failed: {str(e)}"
            logger.error(self.last_error)
            return False, self.last_error

        except (redis.exceptions.ConnectionError, redis.exceptions.TimeoutError) as e:
            self.mode = "demo"
            self.is_connected = False
            self.last_error = f"Connection failed to {target_host}:{target_port}: {str(e)}"
            logger.error(self.last_error)
            return False, self.last_error

        except Exception as e:
            self.mode = "demo"
            self.is_connected = False
            self.last_error = f"FalkorDB initialization error: {str(e)}"
            logger.error(self.last_error)
            return False, self.last_error

    def test_connection_params(
        self,
        host: str,
        port: int,
        username: str,
        password: str,
        ssl: bool,
        graph_name: str,
    ) -> Dict[str, Any]:
        """
        Safely test connection parameters without mutating current active connection unless requested.
        """
        try:
            test_client = FalkorDB(
                host=host,
                port=port,
                username=username or "default",
                password=password or None,
                ssl=ssl,
                socket_timeout=5,
                socket_connect_timeout=5,
            )
            test_graph = test_client.select_graph(graph_name)
            res = test_graph.query("RETURN 'pong' AS status")
            row = res.result_set[0] if res.result_set else ["pong"]
            return {
                "success": True,
                "message": f"Successfully connected to FalkorDB graph '{graph_name}'!",
                "graph_name": graph_name,
                "host": host,
                "port": port
            }
        except redis.exceptions.AuthenticationError as e:
            return {
                "success": False,
                "error": f"Authentication failed. Please verify your FalkorDB Cloud username and password: {str(e)}"
            }
        except (redis.exceptions.ConnectionError, redis.exceptions.TimeoutError) as e:
            return {
                "success": False,
                "error": f"Unable to reach {host}:{port}. Check host endpoint, port, and network: {str(e)}"
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"FalkorDB test error: {str(e)}"
            }

    def seed(self) -> Dict[str, Any]:
        """
        Idempotently seed the database with NovaTech demo company records.
        """
        if self.mode == "live" and self.graph:
            statements = generate_seed_cypher()
            executed = 0
            for cypher, params in statements:
                self.graph.query(cypher, params)
                executed += 1
            return {
                "success": True,
                "mode": "live",
                "graph_name": self.graph_name,
                "statements_executed": executed,
                "nodes_seeded": len(DEMO_NODES),
                "edges_seeded": len(DEMO_EDGES)
            }
        else:
            # Reset in-memory demo data
            self.mock_nodes = {n["id"]: dict(n) for n in DEMO_NODES}
            self.mock_edges = [dict(e) for e in DEMO_EDGES]
            return {
                "success": True,
                "mode": "demo",
                "graph_name": "orgmind_demo (in-memory)",
                "statements_executed": len(DEMO_NODES) + len(DEMO_EDGES),
                "nodes_seeded": len(DEMO_NODES),
                "edges_seeded": len(DEMO_EDGES)
            }

    def execute_cypher(self, cypher: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Execute Cypher query and format results as nodes, edges, or tabular data.
        """
        params = params or {}
        if self.mode == "live" and self.graph:
            try:
                result = self.graph.query(cypher, params)
                columns = result.header if hasattr(result, "header") else []
                rows = []
                for row in (result.result_set or []):
                    formatted_row = []
                    for item in row:
                        if hasattr(item, "labels"):  # FalkorDB Node
                            formatted_row.append({
                                "type": "node",
                                "id": getattr(item, "properties", {}).get("id", str(item.id)),
                                "label": item.labels[0] if item.labels else "Node",
                                "properties": item.properties
                            })
                        elif hasattr(item, "relation"):  # FalkorDB Edge
                            formatted_row.append({
                                "type": "edge",
                                "id": getattr(item, "id", None),
                                "relation": item.relation,
                                "src": getattr(item.src_node, "properties", {}).get("id", str(item.src_node)),
                                "dst": getattr(item.dest_node, "properties", {}).get("id", str(item.dest_node)),
                                "properties": item.properties
                            })
                        else:
                            formatted_row.append(item)
                    rows.append(formatted_row)

                return {
                    "success": True,
                    "columns": columns,
                    "rows": rows,
                    "row_count": len(rows),
                    "mode": "live"
                }
            except Exception as e:
                logger.error(f"Error executing Cypher query: {e}")
                return {
                    "success": False,
                    "error": str(e),
                    "mode": "live"
                }
        else:
            # Fallback query simulator for in-memory graph
            return self._execute_mock_cypher(cypher, params)

    def _execute_mock_cypher(self, cypher: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Deterministic mock Cypher runner for demo mode supporting primary query patterns.
        """
        # Return full graph if querying all nodes or schema
        upper = cypher.upper()
        if "MATCH (N)" in upper or "RETURN N" in upper:
            return {
                "success": True,
                "columns": ["n"],
                "rows": [[[dict(n)] for n in self.mock_nodes.values()]],
                "row_count": len(self.mock_nodes),
                "mode": "demo"
            }
        return {
            "success": True,
            "columns": ["result"],
            "rows": [],
            "row_count": 0,
            "mode": "demo"
        }

    def get_full_graph(self, project_filter: Optional[str] = None) -> Dict[str, Any]:
        """
        Retrieve all nodes and edges formatted for the React Flow frontend.
        """
        if self.mode == "live" and self.graph:
            try:
                # Query all nodes and relationships
                cypher = """
                MATCH (n)
                OPTIONAL MATCH (n)-[r]->(m)
                RETURN n, r, m
                """
                res = self.graph.query(cypher)
                nodes_dict: Dict[str, Dict[str, Any]] = {}
                edges_list: List[Dict[str, Any]] = []
                seen_edges = set()

                for row in (res.result_set or []):
                    n_item, r_item, m_item = row[0], row[1], row[2]
                    if n_item:
                        nid = n_item.properties.get("id", f"node-{n_item.id}")
                        if nid not in nodes_dict:
                            nodes_dict[nid] = {
                                "id": nid,
                                "label": n_item.labels[0] if n_item.labels else "Entity",
                                "properties": dict(n_item.properties)
                            }
                    if m_item:
                        mid = m_item.properties.get("id", f"node-{m_item.id}")
                        if mid not in nodes_dict:
                            nodes_dict[mid] = {
                                "id": mid,
                                "label": m_item.labels[0] if m_item.labels else "Entity",
                                "properties": dict(m_item.properties)
                            }
                    if r_item and n_item and m_item:
                        src_id = n_item.properties.get("id", f"node-{n_item.id}")
                        dst_id = m_item.properties.get("id", f"node-{m_item.id}")
                        edge_key = (src_id, r_item.relation, dst_id)
                        if edge_key not in seen_edges:
                            seen_edges.add(edge_key)
                            edges_list.append({
                                "id": f"e-{src_id}-{r_item.relation}-{dst_id}",
                                "src": src_id,
                                "dst": dst_id,
                                "rel": r_item.relation,
                                "properties": dict(r_item.properties or {})
                            })

                nodes = list(nodes_dict.values())
                edges = edges_list

                # If project filter applied
                if project_filter:
                    nodes, edges = self._filter_subgraph(nodes, edges, project_filter)

                return {
                    "nodes": nodes,
                    "edges": edges,
                    "mode": "live",
                    "graph_name": self.graph_name,
                    "node_count": len(nodes),
                    "edge_count": len(edges)
                }
            except Exception as e:
                logger.warning(f"Error fetching live graph, falling back to demo graph: {e}")

        # Demo mode in-memory data
        nodes = list(self.mock_nodes.values())
        edges = [
            {
                "id": f"e-{e['src']}-{e['rel']}-{e['dst']}",
                "src": e["src"],
                "dst": e["dst"],
                "rel": e["rel"],
                "properties": e.get("properties", {})
            }
            for e in self.mock_edges
        ]
        if project_filter:
            nodes, edges = self._filter_subgraph(nodes, edges, project_filter)

        return {
            "nodes": nodes,
            "edges": edges,
            "mode": "demo",
            "graph_name": "orgmind_demo (in-memory)",
            "node_count": len(nodes),
            "edge_count": len(edges)
        }

    def _filter_subgraph(
        self, nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]], project_id: str
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Filter to only nodes and edges connected to the specified project.
        """
        active_ids = {project_id}
        # First degree
        for e in edges:
            if e["src"] == project_id or e["dst"] == project_id:
                active_ids.add(e["src"])
                active_ids.add(e["dst"])
        # Second degree (e.g. blockers of tasks, decisions of tasks)
        for e in edges:
            if e["src"] in active_ids or e["dst"] in active_ids:
                active_ids.add(e["src"])
                active_ids.add(e["dst"])

        filtered_nodes = [n for n in nodes if n["id"] in active_ids]
        filtered_edges = [e for e in edges if e["src"] in active_ids and e["dst"] in active_ids]
        return filtered_nodes, filtered_edges

    def get_schema(self) -> Dict[str, Any]:
        """
        Return graph schema statistics (labels, relationship types, counts).
        """
        graph_data = self.get_full_graph()
        nodes = graph_data["nodes"]
        edges = graph_data["edges"]

        label_counts: Dict[str, int] = {}
        for n in nodes:
            label = n.get("label", "Entity")
            label_counts[label] = label_counts.get(label, 0) + 1

        rel_counts: Dict[str, int] = {}
        for e in edges:
            rel = e.get("rel", "RELATED_TO")
            rel_counts[rel] = rel_counts.get(rel, 0) + 1

        return {
            "labels": label_counts,
            "relationships": rel_counts,
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "mode": self.mode,
            "graph_name": self.graph_name,
            "is_connected": self.is_connected
        }


# Singleton service instance
_falkor_service: Optional[FalkorDBService] = None

def get_falkor_service() -> FalkorDBService:
    global _falkor_service
    if _falkor_service is None:
        _falkor_service = FalkorDBService()
    return _falkor_service
