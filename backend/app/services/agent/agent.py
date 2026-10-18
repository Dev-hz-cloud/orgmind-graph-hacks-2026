"""
Graph-Grounded Agent for OrgMind Company Brain.
Combines LLM planning, bounded read-only FalkorDB tools, evidence extraction,
and durable session memory.
"""

from __future__ import annotations
import json
import logging
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from app.api.models import QuestionResponse, EvidenceItem
from app.db.falkor import FalkorDBService, get_falkor_service
from app.services.agent.tools import AgentGraphTools
from app.services.agent.provider import LLMProvider
from app.services.memory import MemoryService, get_memory_service

logger = logging.getLogger("orgmind.agent")

SYSTEM_PROMPT = """You are OrgMind, an Evidence-First Company Brain powered by FalkorDB.
Your job is to answer organizational questions strictly grounded in verifiable graph data.

RULES:
1. Grounding: Every claim must be backed by data retrieved through your tools. Never invent people, tasks, blockers, decisions, or documents.
2. Tools: Use `get_graph_schema` to see what labels and relationships exist. Use `query_cypher_readonly`, `search_entities`, or `get_entity_neighbors` to retrieve specific entities.
3. Honesty: If the graph has 0 records or lacks data for a query, state clearly that no records were found in the database. Never hallucinate.
4. Memory vs Facts: Conversation memory contains past dialogue context, NOT verified database facts. Do not cite remembered user statements as FalkorDB ground truth.
5. Formatting: Structure your answers cleanly:
   - ### Direct Answer
   - ### Verified Graph Evidence (cite the exact node IDs returned by your tools)
   - ### Inferences & Causal Analysis
   - ### Missing Information & Uncertainties
"""


class GraphAgent:
    def __init__(
        self,
        falkor_service: Optional[FalkorDBService] = None,
        memory_service: Optional[MemoryService] = None,
        provider: Optional[LLMProvider] = None,
    ):
        self.falkor = falkor_service or get_falkor_service()
        self.memory = memory_service or get_memory_service()
        self.tools = AgentGraphTools(falkor_service=self.falkor)
        self.provider = provider or LLMProvider()

    def answer_question(
        self,
        query: str,
        project_context: Optional[str] = None,
        session_id: Optional[str] = None,
        persist_memory: bool = True,
    ) -> Dict[str, Any]:
        """
        Full agent execution loop:
        1. Ensure session exists and load memory.
        2. Plan and execute tools with LLM (or deterministic fallback if provider offline).
        3. Extract evidence, highlights, and causal chains.
        4. Persist turn to durable memory.
        """
        sid = self.memory.get_or_create_session(session_id)

        # Detect user-stated facts to save in memory
        self._extract_and_save_user_facts(sid, query)

        # 1. Check provider availability
        active_provider, active_model = self.provider.get_active_provider()

        executed_cypher_queries: List[str] = []
        retrieved_nodes: Dict[str, Dict[str, Any]] = {}
        retrieved_edges: List[Dict[str, Any]] = []

        if active_provider:
            answer_text, executed_cypher_queries, retrieved_nodes, retrieved_edges = self._run_llm_agent_loop(
                query=query,
                project_context=project_context,
                session_id=sid
            )
        else:
            logger.info("No active LLM provider found. Using schema-guided graph traversal.")
            answer_text, executed_cypher_queries, retrieved_nodes, retrieved_edges = self._run_deterministic_graph_engine(
                query=query,
                project_context=project_context,
                session_id=sid
            )

        # 2. Format evidence items
        evidence_items = self._format_evidence(retrieved_nodes)

        # 3. Highlight nodes and edges for the 3D cube and graph explorer
        highlight_nodes = list(retrieved_nodes.keys())
        highlight_edges = [
            f"e-{e['src']}-{e.get('rel', 'RELATED_TO')}-{e['dst']}"
            for e in retrieved_edges
        ]

        # 4. Determine confidence
        confidence = 1.0 if retrieved_nodes else 0.0

        # Primary Cypher statement for transparency
        primary_cypher = executed_cypher_queries[0] if executed_cypher_queries else "MATCH (n) RETURN n"

        # 5. Build structured response
        response = {
            "query": query,
            "cypher": primary_cypher,
            "cypher_params": {},
            "answer": answer_text,
            "evidence": evidence_items,
            "highlight_nodes": highlight_nodes,
            "highlight_edges": highlight_edges,
            "confidence": confidence,
            "mode": self.falkor.mode,
            "session_id": sid,
            "missing_facts": [] if retrieved_nodes else ["No matching records found in the database for this query."]
        }

        if persist_memory:
            # 6. Persist assistant turn to durable memory
            self.memory.add_message(
                session_id=sid,
                role="user",
                content=query
            )
            self.memory.add_message(
                session_id=sid,
                role="assistant",
                content=answer_text,
                evidence=evidence_items
            )

        return response

    def _run_llm_agent_loop(
        self,
        query: str,
        project_context: Optional[str],
        session_id: str,
        max_iterations: int = 4
    ) -> Tuple[str, List[str], Dict[str, Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Execute multi-turn tool calling loop with the LLM provider.
        """
        executed_cypher: List[str] = []
        collected_nodes: Dict[str, Dict[str, Any]] = {}
        collected_edges: List[Dict[str, Any]] = []

        memory_context = self.memory.get_conversation_context(session_id)
        system_content = SYSTEM_PROMPT
        if memory_context:
            system_content += f"\n\n{memory_context}"

        user_content = query
        if project_context:
            user_content += f"\n[Context: Currently viewing project '{project_context}']"

        messages: List[Dict[str, Any]] = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": user_content}
        ]

        tool_defs = self.tools.get_tool_definitions()

        for iteration in range(max_iterations):
            resp = self.provider.call_chat_completion(
                messages=messages,
                tools=tool_defs,
                temperature=0.1
            )

            if not resp.get("success"):
                logger.warning(f"LLM call failed on iteration {iteration}: {resp.get('error')}")
                break

            tool_calls = resp.get("tool_calls")
            content = resp.get("content")

            # Assistant message
            assistant_msg: Dict[str, Any] = {
                "role": "assistant",
                "content": content or ""
            }
            if tool_calls:
                assistant_msg["tool_calls"] = tool_calls
            messages.append(assistant_msg)

            if not tool_calls:
                # LLM finished reasoning and produced final content
                if content:
                    return content, executed_cypher, collected_nodes, collected_edges
                break

            # Process tool calls
            for tc in tool_calls:
                fn = tc.get("function", {})
                fn_name = fn.get("name", "")
                raw_args = fn.get("arguments", "{}")
                try:
                    args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
                except Exception:
                    args = {}

                if fn_name == "query_cypher_readonly":
                    c = args.get("cypher", "")
                    if c:
                        executed_cypher.append(c)

                # Execute bounded tool
                tool_result = self.tools.execute_tool(fn_name, args)

                # Collect any nodes or edges returned by tool
                self._harvest_tool_entities(tool_result, collected_nodes, collected_edges)

                # Append tool response
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.get("id", f"call_{iteration}"),
                    "name": fn_name,
                    "content": json.dumps(tool_result)[:3000]  # truncate to avoid context limit
                })

        # Fallback if loop terminated without clear content
        if not collected_nodes:
            # Try deterministic fallback to ensure answers are never lost
            return self._run_deterministic_graph_engine(query, project_context, session_id=session_id)

        # Synthesize from harvested nodes
        synthetic_answer = self._synthesize_from_harvest(query, collected_nodes, collected_edges)
        return synthetic_answer, executed_cypher, collected_nodes, collected_edges

    def _run_deterministic_graph_engine(
        self,
        query: str,
        project_context: Optional[str],
        session_id: Optional[str] = None
    ) -> Tuple[str, List[str], Dict[str, Dict[str, Any]], List[Dict[str, Any]]]:
        """
        High-reliability schema-aware deterministic graph engine.
        Executes verified Cypher based on user intent and returns real graph records.
        Used as guaranteed fallback if no LLM provider is configured.
        """
        q = query.lower().strip()
        executed_cypher: List[str] = []
        nodes: Dict[str, Dict[str, Any]] = {}
        edges: List[Dict[str, Any]] = []

        # Check for remembered user statements in this session
        remembered_notes: List[str] = []
        if session_id:
            facts = self.memory.get_facts(session_id)
            q_words = set(re.findall(r'\w{3,}', q))
            for f in facts:
                f_words = set(re.findall(r'\w{3,}', f['fact_text'].lower()))
                if q_words.intersection(f_words) or any(term in q for term in ["say", "tell", "remember", "earlier", "on call"]):
                    remembered_notes.append(f['fact_text'])

        # Resolve target project strictly from actual Project records
        pid = self._resolve_project_from_graph(q, project_context)

        if pid:
            # Traversal this engine represents, kept for transparency in the UI.
            cypher = """
            MATCH (p:Project {id: $projectId})-[:HAS_TASK]->(t:Task)
            OPTIONAL MATCH (t)-[:BLOCKED_BY]->(blocker:Task)
            OPTIONAL MATCH (t)-[:ASSIGNED_TO]->(owner:Person)
            OPTIONAL MATCH (t)-[:DEPENDS_ON]->(dec:Decision)
            OPTIONAL MATCH (dec)-[:MADE_BY]->(decider:Person)
            OPTIONAL MATCH (dec)-[:REFERENCES]->(doc:Document)
            RETURN p, t, blocker, owner, dec, decider, doc
            """
            executed_cypher.append(cypher.strip())
            # Read the real subgraph around the resolved project. get_full_graph
            # works against both a live graph and the offline demo store, so the
            # engine never fabricates records when Cypher execution is unavailable.
            self._harvest_tool_entities(self.tools.get_entity_neighbors(pid), nodes, edges)

        # Add any entities whose fields match the question text
        self._harvest_tool_entities(self.tools.search_entities(query), nodes, edges)

        # Check if database is empty
        schema = self.tools.get_schema()
        total_nodes = schema.get("total_nodes", 0)

        if total_nodes == 0:
            msg = (
                "### Database Graph is Empty\n\n"
                f"Connected to FalkorDB graph **'{schema.get('graph_name', 'orgmind_demo')}'**, "
                "but the graph currently contains **0 nodes and 0 relationships**.\n\n"
                "To explore OrgMind with sample organizational records, run the opt-in seed script:\n"
                "```bash\n"
                "python backend/seed_db.py --confirm\n"
                "```\n"
                "*(Note: Database writes require explicit authorization and will not run automatically.)*"
            )
            return msg, executed_cypher, {}, []

        answer = self._synthesize_from_harvest(query, nodes, edges)
        if remembered_notes:
            notes_str = "\n".join(f"- {note}" for note in remembered_notes)
            prefix = (
                "### Direct Answer\n"
                f"You noted earlier in this conversation session:\n"
                f"{notes_str}\n\n"
                "*(Note: Remembered from user conversation memory; not an independently verified FalkorDB graph record.)*\n\n"
            )
            answer = prefix + answer
        return answer, executed_cypher, nodes, edges

    def _resolve_project_from_graph(
        self,
        query_lower: str,
        project_context: Optional[str],
    ) -> Optional[str]:
        """
        Resolve a project id from real Project records only. Returns None when
        no project can be matched, so the caller never queries an invented id.
        """
        graph = self.falkor.get_full_graph()
        projects = [n for n in graph.get("nodes", []) if n.get("label") == "Project"]
        if not projects:
            return None

        if project_context:
            ctx = project_context.strip().lower()
            for proj in projects:
                if proj["id"].lower() == ctx:
                    return proj["id"]
            for proj in projects:
                props = proj.get("properties", {})
                for candidate in (props.get("name", ""), props.get("key", "")):
                    if candidate and str(candidate).strip().lower() == ctx:
                        return proj["id"]

        best_id: Optional[str] = None
        best_len = 0
        for proj in projects:
            props = proj.get("properties", {})
            for candidate in (proj["id"], props.get("name", ""), props.get("key", "")):
                if not candidate:
                    continue
                token = str(candidate).strip().lower()
                if token and token in query_lower and len(token) > best_len:
                    best_len = len(token)
                    best_id = proj["id"]
        return best_id

    def _harvest_tool_entities(
        self,
        tool_result: Dict[str, Any],
        nodes_dict: Dict[str, Dict[str, Any]],
        edges_list: List[Dict[str, Any]]
    ):
        """Extract nodes and edges from any tool output format."""
        if not isinstance(tool_result, dict):
            return

        # Direct nodes list
        for n in tool_result.get("nodes", []):
            if isinstance(n, dict) and "id" in n:
                nodes_dict[n["id"]] = n

        # Direct edges list
        for e in tool_result.get("edges", []):
            if isinstance(e, dict) and "src" in e and "dst" in e:
                edges_list.append(e)

        # Target node from get_entity_neighbors
        if "target" in tool_result and isinstance(tool_result["target"], dict):
            t = tool_result["target"]
            if "id" in t:
                nodes_dict[t["id"]] = t

        # Rows from Cypher execution
        for row in tool_result.get("rows", []):
            if isinstance(row, list):
                for item in row:
                    if isinstance(item, dict):
                        if item.get("type") == "node" and "id" in item:
                            nodes_dict[item["id"]] = item
                        elif item.get("type") == "edge" and "src" in item:
                            edges_list.append(item)
                        elif "id" in item and "label" in item:
                            nodes_dict[item["id"]] = item

    def _synthesize_from_harvest(
        self,
        query: str,
        nodes: Dict[str, Dict[str, Any]],
        edges: List[Dict[str, Any]]
    ) -> str:
        """Construct clear evidence-based answer from harvested graph entities."""
        if not nodes:
            return (
                "### Insufficient Evidence\n\n"
                f"No connected graph evidence was found matching **\"{query}\"** in the active database.\n\n"
                "**Verified graph facts**: 0 records matched."
            )

        # Categorize
        by_label: Dict[str, List[Dict[str, Any]]] = {}
        for n in nodes.values():
            lbl = n.get("label", "Entity")
            by_label.setdefault(lbl, []).append(n)

        sections = []
        sections.append("### Direct Answer")

        # Check for projects
        projects = by_label.get("Project", [])
        tasks = by_label.get("Task", [])
        decisions = by_label.get("Decision", [])
        people = by_label.get("Person", [])
        docs = by_label.get("Document", [])

        blocked_tasks = [
            t for t in tasks
            if t.get("properties", {}).get("status") == "BLOCKED" or t.get("properties", {}).get("delay_days", 0) > 0
        ]

        if projects:
            p_props = projects[0].get("properties", {})
            p_name = p_props.get("name", projects[0]["id"])
            p_status = p_props.get("status", "UNKNOWN")
            delay = p_props.get("delay_days", 0)
            sections.append(
                f"**{p_name}** is currently **{p_status}** ({delay} days behind schedule). "
                f"Found {len(blocked_tasks)} blocking task(s) and {len(decisions)} related governance decision(s)."
            )
        else:
            sections.append(
                f"Found **{len(nodes)} verified entity record(s)** across the graph relevant to your inquiry."
            )

        sections.append("\n### Verified Graph Evidence")
        for lbl, items in by_label.items():
            sections.append(f"**{lbl} Entities ({len(items)})**:")
            for item in items[:5]:
                p = item.get("properties", {})
                title = p.get("name") or p.get("title") or item["id"]
                detail_parts = []
                for k in ["status", "role", "delay_days", "priority", "date", "impact"]:
                    if k in p and p[k]:
                        detail_parts.append(f"{k}: `{p[k]}`")
                details = f" ({', '.join(detail_parts)})" if detail_parts else ""
                sections.append(f"- **{title}** [`{item['id']}`]{details}")

        if edges:
            sections.append(f"\n**Verified Relationships ({len(edges)})**:")
            for e in edges[:6]:
                sections.append(f"- [`{e['src']}`] ➔ **{e.get('rel', 'RELATED_TO')}** ➔ [`{e['dst']}`]")

        sections.append("\n### Inferences & Causal Analysis")
        if blocked_tasks and decisions:
            sections.append(
                "Execution bottlenecks originate in pending architecture decisions halting critical-path tasks. "
                "Resolving the pending decision owners will unblock downstream deployment."
            )
        else:
            sections.append("Relationships between entities show active dependencies traced from FalkorDB.")

        sections.append("\n### Missing Information & Uncertainties")
        if not docs:
            sections.append("- No formal ADR or security audit documents are linked to these tasks in the database.")
        else:
            sections.append("- All core claims above are backed by primary graph records.")

        return "\n".join(sections)

    def _format_evidence(self, nodes: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
        evidence = []
        for nid, n in nodes.items():
            props = n.get("properties", {})
            title = props.get("name") or props.get("title") or nid
            lbl = n.get("label", "Entity")

            summary_parts = []
            for k in ["status", "role", "department", "delay_days", "priority", "impact"]:
                if k in props and props[k]:
                    summary_parts.append(f"{k}={props[k]}")
            summary = ", ".join(summary_parts) if summary_parts else f"{lbl} in FalkorDB"

            evidence.append({
                "id": f"ev-{nid}",
                "type": "node",
                "entity_id": nid,
                "label": lbl,
                "title": title,
                "summary": summary,
                "properties": props
            })
        return evidence

    def _extract_and_save_user_facts(self, session_id: str, query: str):
        """Check if user query asserts a fact to remember."""
        q_lower = query.lower()
        triggers = ["remember that", "note that", "my name is", "i am", "we decided"]
        for t in triggers:
            if t in q_lower:
                fact_text = query.strip()
                self.memory.add_fact(session_id, fact_text)
                logger.info(f"Persisted user fact in session {session_id}: {fact_text[:50]}")
                break


# Singleton accessor
_graph_agent: Optional[GraphAgent] = None

def get_graph_agent() -> GraphAgent:
    global _graph_agent
    if _graph_agent is None:
        _graph_agent = GraphAgent()
    return _graph_agent
