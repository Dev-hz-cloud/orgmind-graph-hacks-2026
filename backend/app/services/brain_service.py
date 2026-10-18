"""
Deterministic, Evidence-First Company Brain question answering engine.

Every answer, evidence item, highlight, and causal chain is derived by traversing
the records and relationships that actually exist in the connected FalkorDB graph.
When the graph lacks the data needed to answer, the engine says so explicitly
instead of falling back to invented people, tasks, decisions, or delay figures.
"""

from __future__ import annotations
import logging
import re
from typing import Any, Dict, List, Optional, Tuple
from app.db.falkor import FalkorDBService, get_falkor_service

logger = logging.getLogger("orgmind.brain")


class BrainService:
    #: The questions this deterministic router can answer with purpose-built traversal.
    SUPPORTED_QUESTIONS: Tuple[str, ...] = (
        "Why is <project> delayed?",
        "Which tasks are blocking this launch?",
        "Who owns the blocking task?",
        "Which decisions are still pending?",
        "What depends on <task>?",
        "Show the evidence connected to this issue",
        "<project> status / overview / progress",
    )

    def __init__(
        self,
        falkor_service: Optional[FalkorDBService] = None,
        memory_service: Optional[Any] = None
    ):
        self.falkor = falkor_service or get_falkor_service()
        from app.services.memory import get_memory_service
        self.memory = memory_service or get_memory_service()

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    def answer_question(
        self,
        query: str,
        project_context: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Process a user question, route intent, traverse the graph, and extract
        evidence. Persists dialogue to durable session memory.
        """
        sid = self.memory.get_or_create_session(session_id)
        normalized = query.lower().strip()

        # 1. Resolve Project Entity strictly from graph records
        project_id = self._resolve_project_id(normalized, project_context)

        # 2. Determine Intent
        intent = self._classify_intent(normalized)

        # 3. Route to dedicated handler
        if intent == "WHY_DELAYED":
            res = self._handle_why_delayed(project_id, query)
        elif intent == "BLOCKING_TASKS":
            res = self._handle_blocking_tasks(project_id, query)
        elif intent == "TASK_OWNER":
            res = self._handle_task_owner(project_id, query)
        elif intent == "PENDING_DECISIONS":
            res = self._handle_pending_decisions(project_id, query)
        elif intent == "DEPENDENCY_CHECK":
            res = self._handle_dependency_check(project_id, query)
        elif intent == "EVIDENCE_EXPLORER":
            res = self._handle_evidence_explorer(project_id, query)
        elif intent == "PROJECT_STATUS":
            res = self._handle_why_delayed(project_id, query)
        else:
            # Check if an LLM agent can answer this general/follow-up question
            from app.services.agent import get_graph_agent
            agent = get_graph_agent()
            provider_name, _ = agent.provider.get_active_provider()

            # If explicit out-of-domain query or no active provider
            if not provider_name or any(kw in normalized for kw in ["capital of france", "weather", "tell me about"]):
                res = self._handle_general_inquiry(project_id, query)
            else:
                try:
                    res = agent.answer_question(query=query, project_context=project_context, session_id=sid, persist_memory=False)
                except Exception as e:
                    logger.warning(f"Agent execution failed: {e}; falling back to general inquiry")
                    res = self._handle_general_inquiry(project_id, query)

        res["session_id"] = sid

        # Persist interaction to durable SQLite memory
        try:
            self.memory.add_message(session_id=sid, role="user", content=query)
            self.memory.add_message(
                session_id=sid,
                role="assistant",
                content=res.get("answer", ""),
                evidence=res.get("evidence", [])
            )
        except Exception as e:
            logger.warning(f"Failed to persist message to memory: {e}")

        return res

    # ------------------------------------------------------------------
    # Graph helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _reindex(graph_data: Dict[str, Any]) -> Tuple[
        Dict[str, Dict[str, Any]],
        Dict[str, List[Dict[str, Any]]],
        Dict[str, List[Dict[str, Any]]],
    ]:
        """Build node lookup plus outgoing/incoming adjacency from a graph payload."""
        nodes = {n["id"]: n for n in graph_data.get("nodes", [])}
        outgoing: Dict[str, List[Dict[str, Any]]] = {}
        incoming: Dict[str, List[Dict[str, Any]]] = {}
        for edge in graph_data.get("edges", []):
            outgoing.setdefault(edge["src"], []).append(edge)
            incoming.setdefault(edge["dst"], []).append(edge)
        return nodes, outgoing, incoming

    @staticmethod
    def _as_int(value: Any) -> int:
        try:
            return int(value)
        except (TypeError, ValueError):
            return 0

    @staticmethod
    def _node_title(node: Dict[str, Any]) -> str:
        props = node.get("properties", {})
        return props.get("name") or props.get("title") or node.get("id", "Unknown")

    def _node_evidence(self, node: Dict[str, Any], summary: Optional[str] = None) -> Dict[str, Any]:
        props = node.get("properties", {})
        label = node.get("label", "Entity")
        title = self._node_title(node)
        if summary is None:
            parts = []
            for key in ("status", "role", "department", "delay_days", "priority", "impact", "type"):
                value = props.get(key)
                if value not in (None, ""):
                    parts.append(f"{key}: {value}")
            summary = ", ".join(parts) if parts else f"{label} record from the graph."
        return {
            "id": f"ev-{node['id']}",
            "type": "document" if label == "Document" else "node",
            "entity_id": node["id"],
            "label": label,
            "title": title,
            "summary": summary,
            "properties": props,
        }

    @staticmethod
    def _dedupe(items: List[str]) -> List[str]:
        return list(dict.fromkeys(items))

    def _resolve_project_id(self, query: str, context: Optional[str]) -> Optional[str]:
        """
        Resolve a project id from real Project records only.

        Matching prefers an explicit context, then a project name/key/id that
        appears in the question. Returns None when nothing can be resolved; it
        never invents a default project id.
        """
        graph = self.falkor.get_full_graph()
        projects = [n for n in graph.get("nodes", []) if n.get("label") == "Project"]
        if not projects:
            return None

        if context:
            ctx = context.strip().lower()
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
                if token and token in query and len(token) > best_len:
                    best_len = len(token)
                    best_id = proj["id"]
        return best_id

    def _classify_intent(self, q: str) -> str:
        if any(w in q for w in ["who owns", "owner", "who is responsible", "who is working on"]):
            return "TASK_OWNER"
        if any(w in q for w in ["pending decision", "decisions", "decision", "pending"]):
            return "PENDING_DECISIONS"
        if any(w in q for w in ["depends on", "dependency", "downstream", "what depends"]):
            return "DEPENDENCY_CHECK"
        if any(w in q for w in ["evidence", "documents", "document", "audit", "adr", "rfc", "sla"]):
            return "EVIDENCE_EXPLORER"
        if any(w in q for w in ["why", "delayed", "delay", "behind schedule", "late", "root cause"]):
            return "WHY_DELAYED"
        if any(w in q for w in ["blocking this launch", "which tasks are blocking", "what tasks are blocking", "blocker", "blocking"]):
            return "BLOCKING_TASKS"
        if any(w in q for w in ["status", "overview", "progress"]):
            return "PROJECT_STATUS"
        return "GENERAL"

    # ------------------------------------------------------------------
    # Intent handlers
    # ------------------------------------------------------------------

    def _handle_why_delayed(self, project_id: Optional[str], raw_query: str) -> Dict[str, Any]:
        """
        Answers: 'Why is this project delayed?'

        Traces Project -> HAS_TASK -> Task (blocked) -> BLOCKED_BY -> Blocker Task
        -> DEPENDS_ON -> Decision -> MADE_BY -> Person, plus MENTIONS/REFERENCES
        documents. All entities come from the graph.
        """
        cypher = """
        MATCH (p:Project {id: $projectId})-[:HAS_TASK]->(t:Task)
        OPTIONAL MATCH (t)-[:BLOCKED_BY]->(blocker:Task)
        OPTIONAL MATCH (blocker)-[:ASSIGNED_TO]->(owner:Person)
        OPTIONAL MATCH (blocker)-[:WAITING_FOR]->(waiting:Person)
        OPTIONAL MATCH (blocker)-[:DEPENDS_ON]->(dec:Decision)
        OPTIONAL MATCH (dec)-[:MADE_BY]->(decider:Person)
        OPTIONAL MATCH (dec)-[:REFERENCES]->(doc:Document)
        OPTIONAL MATCH (t)-[:MENTIONS]->(taskDoc:Document)
        RETURN p, t, blocker, owner, waiting, dec, decider, doc, taskDoc
        """
        params = {"projectId": project_id} if project_id else {}

        if not project_id:
            return self._build_empty_response(
                raw_query, cypher, params,
                "No project could be resolved from the question. Name a project or select one of the projects present in the database.",
            )

        graph_data = self.falkor.get_full_graph()
        nodes, outgoing, _ = self._reindex(graph_data)
        proj = nodes.get(project_id)
        if not proj:
            return self._build_empty_response(
                raw_query, cypher, params,
                f"Project '{project_id}' was not found in the connected graph.",
            )

        p_props = proj.get("properties", {})
        proj_name = p_props.get("name", project_id)
        proj_status = p_props.get("status", "UNKNOWN")
        delay_days = self._as_int(p_props.get("delay_days", 0))
        target_date = p_props.get("target_date") or "not set"

        blocked_tasks: List[Dict[str, Any]] = []
        for edge in outgoing.get(project_id, []):
            if edge.get("rel") != "HAS_TASK":
                continue
            task = nodes.get(edge["dst"])
            if not task:
                continue
            tp = task.get("properties", {})
            if tp.get("status") == "BLOCKED" or self._as_int(tp.get("delay_days", 0)) > 0:
                blocked_tasks.append(task)

        highlight_nodes: List[str] = [project_id]
        highlight_edges: List[str] = []
        evidence_items: List[Dict[str, Any]] = [
            self._node_evidence(
                proj,
                summary=(
                    f"Project status {proj_status}, recorded delay {delay_days} days, "
                    f"target date {target_date}."
                ),
            )
        ]

        if not blocked_tasks:
            if delay_days <= 0:
                answer = (
                    f"### Delay Root-Cause Analysis for **{proj_name}**\n\n"
                    f"**{proj_name}** is recorded as **{proj_status}** with **0 days of delay** "
                    f"(target date {target_date}). No blocked tasks or delay relationships were "
                    "found in the graph, so there is no recorded delay to explain."
                )
                return self._make_response(
                    raw_query, cypher, params, answer, evidence_items,
                    highlight_nodes, highlight_edges, 1.0,
                    direct_answer=(
                        f"{proj_name} is recorded as {proj_status} with 0 days of delay."
                    ),
                )
            return self._make_response(
                raw_query, cypher, params,
                (
                    f"### Delay Root-Cause Analysis for **{proj_name}**\n\n"
                    f"**{proj_name}** is recorded with **{delay_days} days of delay**, but the graph "
                    "contains no blocked task relationships that explain it. Insufficient evidence "
                    "to attribute a cause."
                ),
                evidence_items, highlight_nodes, highlight_edges, 0.3,
                missing_facts=[
                    f"'{proj_name}' has delay_days={delay_days} but no HAS_TASK -> BLOCKED_BY chain was found.",
                ],
            )

        chain_steps: List[Dict[str, Any]] = [
            {"id": project_id, "title": proj_name, "label": "Project", "rel": "HAS_TASK"}
        ]
        answer_lines: List[str] = [
            f"### Delay Root-Cause Analysis for **{proj_name}**",
            "",
            (
                f"**{proj_name}** is recorded as **{proj_status}** with **{delay_days} days** of delay "
                f"(target date {target_date}). The following records in the graph explain the delay:"
            ),
            "",
        ]
        blockers_list: List[Dict[str, Any]] = []
        decision_ids: List[str] = []
        doc_ids: List[str] = []

        for index, task in enumerate(blocked_tasks, start=1):
            t_id = task["id"]
            tp = task.get("properties", {})
            t_title = self._node_title(task)
            if t_id not in highlight_nodes:
                highlight_nodes.append(t_id)
            highlight_edges.append(f"e-{project_id}-HAS_TASK-{t_id}")
            evidence_items.append(self._node_evidence(task))
            chain_steps.append({"id": t_id, "title": t_title, "label": "Task", "rel": "BLOCKED_BY"})

            answer_lines.append(
                f"{index}. **Blocked task: {t_title}** — status `{tp.get('status', 'UNKNOWN')}`, "
                f"priority `{tp.get('priority', 'UNSPECIFIED')}`, "
                f"delay `{self._as_int(tp.get('delay_days', 0))}d`."
            )
            if tp.get("blocker_reason"):
                answer_lines.append(f"   - Recorded reason: {tp['blocker_reason']}")

            owner = None
            waiting = None
            blocker_task = None
            for edge in outgoing.get(t_id, []):
                if edge.get("rel") == "ASSIGNED_TO" and edge["dst"] in nodes:
                    owner = nodes[edge["dst"]]
                elif edge.get("rel") == "WAITING_FOR" and edge["dst"] in nodes:
                    waiting = nodes[edge["dst"]]
                elif edge.get("rel") == "BLOCKED_BY" and edge["dst"] in nodes:
                    blocker_task = nodes[edge["dst"]]

            if owner:
                if owner["id"] not in highlight_nodes:
                    highlight_nodes.append(owner["id"])
                highlight_edges.append(f"e-{t_id}-ASSIGNED_TO-{owner['id']}")
                evidence_items.append(self._node_evidence(owner))
                answer_lines.append(
                    f"   - Assigned to **{self._node_title(owner)}**"
                    f" ({owner.get('properties', {}).get('role', 'role not recorded')})."
                )
            if waiting:
                if waiting["id"] not in highlight_nodes:
                    highlight_nodes.append(waiting["id"])
                highlight_edges.append(f"e-{t_id}-WAITING_FOR-{waiting['id']}")
                evidence_items.append(self._node_evidence(waiting))
                answer_lines.append(
                    f"   - Waiting for sign-off from **{self._node_title(waiting)}**"
                    f" ({waiting.get('properties', {}).get('role', 'role not recorded')})."
                )

            blocker_owner = None
            decision = None
            decision_maker = None
            task_doc_ids: List[str] = []
            if blocker_task:
                b_id = blocker_task["id"]
                if b_id not in highlight_nodes:
                    highlight_nodes.append(b_id)
                highlight_edges.append(f"e-{t_id}-BLOCKED_BY-{b_id}")
                evidence_items.append(self._node_evidence(blocker_task))
                chain_steps.append(
                    {"id": b_id, "title": self._node_title(blocker_task), "label": "Task", "rel": "DEPENDS_ON"}
                )
                answer_lines.append(
                    f"   - Blocked by **{self._node_title(blocker_task)}**"
                    f" (status `{blocker_task.get('properties', {}).get('status', 'UNKNOWN')}`)."
                )
                for edge in outgoing.get(b_id, []):
                    if edge.get("rel") == "ASSIGNED_TO" and edge["dst"] in nodes:
                        blocker_owner = nodes[edge["dst"]]
                    if edge.get("rel") == "DEPENDS_ON" and edge["dst"] in nodes:
                        decision = nodes[edge["dst"]]
                if blocker_owner:
                    if blocker_owner["id"] not in highlight_nodes:
                        highlight_nodes.append(blocker_owner["id"])
                    highlight_edges.append(f"e-{b_id}-ASSIGNED_TO-{blocker_owner['id']}")
                    evidence_items.append(self._node_evidence(blocker_owner))

            # Decisions may hang off the task itself or off its blocker
            decision_candidates = []
            if decision:
                decision_candidates.append(decision)
            for source_id in (t_id, blocker_task["id"] if blocker_task else None):
                if not source_id:
                    continue
                for edge in outgoing.get(source_id, []):
                    if edge.get("rel") == "DEPENDS_ON" and edge["dst"] in nodes:
                        decision_candidates.append(nodes[edge["dst"]])

            seen_decisions = set()
            for dec in decision_candidates:
                if dec["id"] in seen_decisions:
                    continue
                seen_decisions.add(dec["id"])
                decision_ids.append(dec["id"])
                if dec["id"] not in highlight_nodes:
                    highlight_nodes.append(dec["id"])
                highlight_edges.append(f"e-{t_id}-DEPENDS_ON-{dec['id']}")
                d_props = dec.get("properties", {})
                evidence_items.append(self._node_evidence(dec))
                chain_steps.append(
                    {"id": dec["id"], "title": self._node_title(dec), "label": "Decision", "rel": "MADE_BY"}
                )
                answer_lines.append(
                    f"   - Pending decision: **{self._node_title(dec)}** "
                    f"(status `{d_props.get('status', 'UNKNOWN')}`)."
                )
                for edge in outgoing.get(dec["id"], []):
                    if edge.get("rel") == "MADE_BY" and edge["dst"] in nodes:
                        decider = nodes[edge["dst"]]
                        decision_maker = decider
                        if decider["id"] not in highlight_nodes:
                            highlight_nodes.append(decider["id"])
                        highlight_edges.append(f"e-{dec['id']}-MADE_BY-{decider['id']}")
                        evidence_items.append(self._node_evidence(decider))
                        chain_steps.append(
                            {"id": decider["id"], "title": self._node_title(decider), "label": "Person", "rel": "REFERENCES"}
                        )
                        answer_lines.append(
                            f"     - Decision maker: **{self._node_title(decider)}**"
                            f" ({decider.get('properties', {}).get('role', 'role not recorded')})."
                        )
                    if edge.get("rel") == "REFERENCES" and edge["dst"] in nodes:
                        doc = nodes[edge["dst"]]
                        doc_ids.append(doc["id"])
                        task_doc_ids.append(doc["id"])
                        if doc["id"] not in highlight_nodes:
                            highlight_nodes.append(doc["id"])
                        highlight_edges.append(f"e-{dec['id']}-REFERENCES-{doc['id']}")
                        evidence_items.append(self._node_evidence(doc))
                        answer_lines.append(
                            f"     - Referenced document: **{self._node_title(doc)}**"
                            f" ({doc.get('properties', {}).get('type', 'document')})."
                        )

            # Documents mentioned directly by the task / blocker
            for source in (task, blocker_task):
                if not source:
                    continue
                for edge in outgoing.get(source["id"], []):
                    if edge.get("rel") == "MENTIONS" and edge["dst"] in nodes:
                        doc = nodes[edge["dst"]]
                        doc_ids.append(doc["id"])
                        task_doc_ids.append(doc["id"])
                        if doc["id"] not in highlight_nodes:
                            highlight_nodes.append(doc["id"])
                        highlight_edges.append(f"e-{source['id']}-MENTIONS-{doc['id']}")
                        evidence_items.append(self._node_evidence(doc))
                        answer_lines.append(
                            f"   - Supporting document: **{self._node_title(doc)}**"
                            f" ({doc.get('properties', {}).get('type', 'document')})."
                        )

            blockers_list.append({
                "id": t_id,
                "title": t_title,
                "status": tp.get("status", "BLOCKED"),
                "priority": tp.get("priority", "UNSPECIFIED"),
                "delay_days": self._as_int(tp.get("delay_days", 0)),
                "owner": self._node_title(owner) if owner else "Unassigned",
                "owner_role": owner.get("properties", {}).get("role", "") if owner else "",
                "reason": tp.get("blocker_reason") or "No reason recorded.",
                "decision": self._node_title(decision) if decision else None,
                "decision_owner": self._node_title(decision_maker) if decision_maker else None,
                "docs": [self._node_title(nodes[i]) for i in self._dedupe(task_doc_ids) if i in nodes],
            })

        answer = "\n".join(answer_lines).strip()
        first_blocked = blocked_tasks[0]
        direct_answer = (
            f"{proj_name} is delayed by {delay_days} days. "
            f"{len(blocked_tasks)} blocked task(s) were traced, starting with "
            f"'{self._node_title(first_blocked)}'."
        )

        summary_stats = {
            "total_delay_days": delay_days,
            "critical_blockers": len([
                b for b in blocked_tasks
                if b.get("properties", {}).get("priority") == "CRITICAL"
            ]),
            "blocked_tasks_count": len(blocked_tasks),
            "pending_decisions_count": len(self._dedupe(decision_ids)),
            "supporting_docs_count": len(self._dedupe(doc_ids)),
        }

        return self._make_response(
            raw_query, cypher, params, answer, evidence_items,
            highlight_nodes, highlight_edges, 1.0,
            direct_answer=direct_answer,
            summary_stats=summary_stats,
            causal_chain=chain_steps,
            blockers=blockers_list,
        )

    def _handle_blocking_tasks(self, project_id: Optional[str], raw_query: str) -> Dict[str, Any]:
        """
        Answers: 'Which tasks are blocking this launch?'

        Scopes to the resolved project when possible, otherwise inspects all
        blocked task records in the graph and says so.
        """
        cypher = """
        MATCH (p:Project {id: $projectId})-[:HAS_TASK]->(t:Task)
        OPTIONAL MATCH (t)-[r:BLOCKED_BY]->(b:Task)
        OPTIONAL MATCH (b)-[:ASSIGNED_TO]->(owner:Person)
        RETURN t, r, b, owner
        """
        params = {"projectId": project_id} if project_id else {}
        graph_data = self.falkor.get_full_graph()
        nodes, outgoing, _ = self._reindex(graph_data)

        proj = nodes.get(project_id) if project_id else None
        proj_name = self._node_title(proj) if proj else None

        if proj:
            task_ids = [e["dst"] for e in outgoing.get(project_id, []) if e.get("rel") == "HAS_TASK"]
            scoped = True
        else:
            task_ids = [n["id"] for n in nodes.values() if n.get("label") == "Task"]
            scoped = False

        highlight_nodes: List[str] = [project_id] if proj else []
        highlight_edges: List[str] = []
        evidence_items: List[Dict[str, Any]] = []
        blocked_nodes: List[Dict[str, Any]] = []

        for tid in task_ids:
            task = nodes.get(tid)
            if not task:
                continue
            tp = task.get("properties", {})
            if tp.get("status") != "BLOCKED" and self._as_int(tp.get("delay_days", 0)) <= 0:
                continue
            blocked_nodes.append(task)
            if tid not in highlight_nodes:
                highlight_nodes.append(tid)
            if proj:
                highlight_edges.append(f"e-{project_id}-HAS_TASK-{tid}")
            evidence_items.append(self._node_evidence(task))
            for edge in outgoing.get(tid, []):
                if edge.get("rel") == "BLOCKED_BY" and edge["dst"] in nodes:
                    blocker = nodes[edge["dst"]]
                    if blocker["id"] not in highlight_nodes:
                        highlight_nodes.append(blocker["id"])
                    highlight_edges.append(f"e-{tid}-BLOCKED_BY-{blocker['id']}")
                    evidence_items.append(self._node_evidence(blocker))

        scope_label = f"**{proj_name}**" if proj else "the connected graph"
        if not blocked_nodes:
            answer = (
                f"### Active Blocking Tasks\n\n"
                f"No blocked or delayed task records were found for {scope_label}."
            )
        else:
            task_list_md = "\n".join([
                f"- **{self._node_title(t)}** "
                f"(Status: `{t['properties'].get('status', 'UNKNOWN')}`, "
                f"Priority: `{t['properties'].get('priority', 'UNSPECIFIED')}`, "
                f"Delay: `{self._as_int(t['properties'].get('delay_days', 0))} days`)"
                + (f"\n  - *Reason*: {t['properties'].get('blocker_reason')}" if t['properties'].get('blocker_reason') else "")
                for t in blocked_nodes
            ])
            answer = (
                f"### Active Blocking Tasks\n\n"
                f"Found **{len(blocked_nodes)} blocked or delayed task record(s)** in {scope_label}:\n\n"
                f"{task_list_md}\n\n"
                "Select any task to inspect its connected owners and dependencies."
            )

        return self._make_response(
            raw_query, cypher, params, answer, evidence_items,
            highlight_nodes, highlight_edges, 1.0,
            direct_answer=(
                f"{len(blocked_nodes)} blocked or delayed task record(s) found in {scope_label}."
            ),
            missing_facts=[] if scoped else [
                "No project name was resolved from the question, so all tasks in the graph were considered.",
            ],
        )

    def _handle_task_owner(self, project_id: Optional[str], raw_query: str) -> Dict[str, Any]:
        """
        Answers: 'Who owns the blocking task?'
        Traverses Task -[:ASSIGNED_TO]-> Person and Task -[:WAITING_FOR]-> Person.
        """
        cypher = """
        MATCH (t:Task {status: 'BLOCKED'})
        OPTIONAL MATCH (t)-[:ASSIGNED_TO]->(owner:Person)
        OPTIONAL MATCH (t)-[:WAITING_FOR]->(waiting:Person)
        OPTIONAL MATCH (t)-[:DEPENDS_ON]->(d:Decision)-[:MADE_BY]->(decider:Person)
        RETURN t, owner, waiting, d, decider
        """
        graph_data = self.falkor.get_full_graph()
        nodes, outgoing, _ = self._reindex(graph_data)

        blocked_tasks = [
            n for n in graph_data.get("nodes", [])
            if n.get("label") == "Task" and n.get("properties", {}).get("status") == "BLOCKED"
        ]
        if not blocked_tasks:
            return self._make_response(
                raw_query, cypher, {},
                "### Ownership of Blocked Tasks\n\nNo blocked task records exist in the graph, "
                "so there is no blocking owner to report.",
                [], [], [], 1.0,
                direct_answer="No blocked task records exist in the graph.",
            )

        highlight_nodes: List[str] = []
        highlight_edges: List[str] = []
        evidence_items: List[Dict[str, Any]] = []
        owners_summary: List[str] = []

        for task in blocked_tasks:
            t_id = task["id"]
            highlight_nodes.append(t_id)
            owner = None
            waiting = None
            for edge in outgoing.get(t_id, []):
                if edge.get("rel") == "ASSIGNED_TO" and edge["dst"] in nodes:
                    owner = nodes[edge["dst"]]
                elif edge.get("rel") == "WAITING_FOR" and edge["dst"] in nodes:
                    waiting = nodes[edge["dst"]]

            if owner:
                highlight_nodes.append(owner["id"])
                highlight_edges.append(f"e-{t_id}-ASSIGNED_TO-{owner['id']}")
                evidence_items.append(self._node_evidence(owner))
            if waiting:
                highlight_nodes.append(waiting["id"])
                highlight_edges.append(f"e-{t_id}-WAITING_FOR-{waiting['id']}")
                evidence_items.append(self._node_evidence(waiting))

            assignee = (
                f"**{self._node_title(owner)}** ({owner.get('properties', {}).get('role', 'role not recorded')})"
                if owner else "Unassigned"
            )
            waiting_str = (
                f" — currently waiting for sign-off from **{self._node_title(waiting)}**"
                if waiting else ""
            )
            owners_summary.append(
                f"- Task **\"{self._node_title(task)}\"**: assigned to {assignee}{waiting_str}"
            )

        answer = (
            "### Ownership of Blocked Tasks\n\n"
            "Traversed `(Task)-[:ASSIGNED_TO]->(Person)`:\n\n"
            f"{chr(10).join(owners_summary)}"
        )

        return self._make_response(
            raw_query, cypher, {}, answer, evidence_items,
            highlight_nodes, highlight_edges, 1.0,
        )

    def _handle_pending_decisions(self, project_id: Optional[str], raw_query: str) -> Dict[str, Any]:
        """
        Answers: 'Which decisions are still pending?'
        """
        cypher = """
        MATCH (d:Decision {status: 'PENDING'})
        OPTIONAL MATCH (d)-[:MADE_BY]->(owner:Person)
        OPTIONAL MATCH (t:Task)-[:DEPENDS_ON]->(d)
        OPTIONAL MATCH (p:Project)-[:HAS_TASK]->(t)
        OPTIONAL MATCH (d)-[:REFERENCES]->(doc:Document)
        RETURN d, owner, t, p, doc
        """
        graph_data = self.falkor.get_full_graph()
        nodes, outgoing, incoming = self._reindex(graph_data)

        pending_decisions = [
            n for n in graph_data.get("nodes", [])
            if n.get("label") == "Decision" and n.get("properties", {}).get("status") == "PENDING"
        ]

        highlight_nodes: List[str] = []
        highlight_edges: List[str] = []
        evidence_items: List[Dict[str, Any]] = []
        decision_details: List[str] = []

        for dec in pending_decisions:
            dec_id = dec["id"]
            d_props = dec.get("properties", {})
            highlight_nodes.append(dec_id)
            evidence_items.append(self._node_evidence(dec))

            maker_name = "Unassigned"
            for edge in outgoing.get(dec_id, []):
                if edge.get("rel") == "MADE_BY" and edge["dst"] in nodes:
                    maker = nodes[edge["dst"]]
                    maker_name = f"{self._node_title(maker)} ({maker.get('properties', {}).get('role', 'role not recorded')})"
                    highlight_nodes.append(maker["id"])
                    highlight_edges.append(f"e-{dec_id}-MADE_BY-{maker['id']}")
                    evidence_items.append(self._node_evidence(maker))

            dep_tasks = []
            for edge in incoming.get(dec_id, []):
                if edge.get("rel") == "DEPENDS_ON" and edge["src"] in nodes:
                    task = nodes[edge["src"]]
                    dep_tasks.append(self._node_title(task))
                    highlight_nodes.append(task["id"])
                    highlight_edges.append(f"e-{task['id']}-DEPENDS_ON-{dec_id}")

            # Referenced documents
            doc_titles = []
            for edge in outgoing.get(dec_id, []):
                if edge.get("rel") == "REFERENCES" and edge["dst"] in nodes:
                    doc = nodes[edge["dst"]]
                    doc_titles.append(self._node_title(doc))
                    highlight_nodes.append(doc["id"])
                    highlight_edges.append(f"e-{dec_id}-REFERENCES-{doc['id']}")
                    evidence_items.append(self._node_evidence(doc))

            tasks_str = ", ".join(dep_tasks) if dep_tasks else "None linked"
            docs_str = ", ".join(doc_titles) if doc_titles else "None linked"
            decision_details.append(
                f"- **{self._node_title(dec)}**\n"
                f"  - **Decision owner**: {maker_name}\n"
                f"  - **Impact**: {d_props.get('impact', 'not recorded')}\n"
                f"  - **Blocking tasks**: {tasks_str}\n"
                f"  - **Referenced documents**: {docs_str}"
            )

        if not pending_decisions:
            answer = (
                "### Pending Organizational Decisions\n\n"
                "No decision records with status `PENDING` exist in the graph."
            )
        else:
            answer = (
                "### Pending Organizational Decisions\n\n"
                f"There are **{len(pending_decisions)} pending decision record(s)** in the graph:\n\n"
                f"{chr(10).join(decision_details)}"
            )

        return self._make_response(
            raw_query, cypher, {}, answer, evidence_items,
            highlight_nodes, highlight_edges, 1.0,
            direct_answer=f"{len(pending_decisions)} pending decision record(s) found in the graph.",
        )

    def _resolve_task_from_query(self, raw_query: str, nodes: Dict[str, Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        Match a task record mentioned in the question by full title or by
        significant word overlap. Returns the best matching task or None.
        """
        query = raw_query.lower()
        query_words = {w for w in re.findall(r"\w{3,}", query)}
        best: Optional[Dict[str, Any]] = None
        best_score = 0
        for node in nodes.values():
            if node.get("label") != "Task":
                continue
            title = self._node_title(node).lower()
            score = 0
            if title and title in query:
                score = len(title)
            else:
                title_words = {w for w in re.findall(r"\w{3,}", title)}
                score = len(query_words & title_words)
            if score > best_score:
                best_score = score
                best = node
        return best if best_score > 0 else None

    def _handle_dependency_check(self, project_id: Optional[str], raw_query: str) -> Dict[str, Any]:
        """
        Answers: 'What depends on this task?' by resolving the target from graph
        records named in the question. Never defaults to an invented task.
        """
        cypher = """
        MATCH (target:Task)
        OPTIONAL MATCH (downstream:Task)-[r:BLOCKED_BY]->(target)
        OPTIONAL MATCH (p:Project)-[:HAS_TASK]->(target)
        RETURN target, downstream, r, p
        """
        graph_data = self.falkor.get_full_graph()
        nodes, outgoing, incoming = self._reindex(graph_data)

        target = self._resolve_task_from_query(raw_query, nodes)
        if not target:
            return self._build_empty_response(
                raw_query, cypher, {},
                "No task named in the question could be matched to a Task record in the graph.",
            )

        target_id = target["id"]
        t_props = target.get("properties", {})
        target_title = self._node_title(target)

        downstream: List[Dict[str, Any]] = []
        highlight_nodes = [target_id]
        highlight_edges: List[str] = []
        evidence_items = [self._node_evidence(target)]

        for edge in incoming.get(target_id, []):
            if edge.get("rel") != "BLOCKED_BY":
                continue
            down = nodes.get(edge["src"])
            if not down:
                continue
            downstream.append(down)
            highlight_nodes.append(down["id"])
            highlight_edges.append(f"e-{down['id']}-BLOCKED_BY-{target_id}")
            evidence_items.append(self._node_evidence(down))

        downstream_list = (
            "\n".join([
                f"- **{self._node_title(d)}** (Status: `{d.get('properties', {}).get('status', 'UNKNOWN')}`)"
                for d in downstream
            ])
            if downstream else "- No downstream tasks are recorded as blocked by this task."
        )

        answer = (
            f"### Downstream Dependencies for **\"{target_title}\"**\n\n"
            f"Resolved target task `{target_id}` from the graph "
            f"(status `{t_props.get('status', 'UNKNOWN')}`).\n\n"
            f"{downstream_list}"
        )

        return self._make_response(
            raw_query, cypher, {"taskId": target_id}, answer, evidence_items,
            highlight_nodes, highlight_edges, 1.0,
            direct_answer=(
                f"{len(downstream)} task(s) are recorded as blocked by '{target_title}'."
            ),
        )

    def _handle_evidence_explorer(self, project_id: Optional[str], raw_query: str) -> Dict[str, Any]:
        """
        Answers: 'Show the evidence connected to this issue.'

        Returns only Document records that are actually linked (via MENTIONS or
        REFERENCES) to tasks and decisions. Scoped to the project when resolvable.
        """
        cypher = """
        MATCH (p:Project {id: $projectId})-[:HAS_TASK]->(t:Task)
        OPTIONAL MATCH (t)-[:MENTIONS]->(doc1:Document)
        OPTIONAL MATCH (t)-[:DEPENDS_ON]->(d:Decision)-[:REFERENCES]->(doc2:Document)
        RETURN p, t, doc1, d, doc2
        """
        params = {"projectId": project_id} if project_id else {}
        graph_data = self.falkor.get_full_graph()
        nodes, outgoing, _ = self._reindex(graph_data)

        proj = nodes.get(project_id) if project_id else None
        proj_name = self._node_title(proj) if proj else None

        # Nodes to inspect for linked documents
        if proj:
            inspected_ids = [e["dst"] for e in outgoing.get(project_id, []) if e.get("rel") == "HAS_TASK"]
        else:
            inspected_ids = [
                n["id"] for n in graph_data.get("nodes", [])
                if n.get("label") in ("Task", "Decision")
            ]

        doc_ids: List[str] = []
        for source_id in inspected_ids:
            for edge in outgoing.get(source_id, []):
                if edge.get("rel") in ("MENTIONS", "REFERENCES") and edge["dst"] in nodes:
                    doc = nodes[edge["dst"]]
                    if doc.get("label") == "Document":
                        doc_ids.append(doc["id"])

        doc_ids = self._dedupe(doc_ids)
        highlight_nodes: List[str] = [project_id] if proj else []
        highlight_edges: List[str] = []
        evidence_items: List[Dict[str, Any]] = []
        doc_bullets: List[str] = []

        for doc_id in doc_ids:
            doc = nodes[doc_id]
            d_props = doc.get("properties", {})
            highlight_nodes.append(doc_id)
            evidence_items.append(self._node_evidence(doc))
            doc_bullets.append(
                f"- **{self._node_title(doc)}** (`{d_props.get('type', 'document')}`)\n"
                f"  - *Summary*: {d_props.get('summary', 'not recorded')}\n"
                f"  - *URI*: {d_props.get('url', 'not recorded')}\n"
                f"  - *Last updated*: `{d_props.get('updated_at', 'not recorded')}`"
            )

        scope_label = f"**{proj_name}**" if proj else "tasks and decisions in the graph"
        if not doc_ids:
            return self._make_response(
                raw_query, cypher, params,
                "### Evidence Records\n\n"
                f"No Document records are linked to {scope_label} via MENTIONS or REFERENCES.",
                [], highlight_nodes, [], 0.3,
                missing_facts=[f"No linked Document records were found for {scope_label}."],
            )

        answer = (
            "### Evidence Records\n\n"
            f"Found **{len(doc_ids)} Document record(s)** linked to {scope_label}:\n\n"
            f"{chr(10).join(doc_bullets)}"
        )

        return self._make_response(
            raw_query, cypher, params, answer, evidence_items,
            highlight_nodes, highlight_edges, 1.0,
            direct_answer=f"{len(doc_ids)} linked Document record(s) found.",
        )

    def _handle_general_inquiry(self, project_id: Optional[str], raw_query: str) -> Dict[str, Any]:
        """
        Fallback for phrasings outside the curated intents.

        It still runs the closest supported traversal so the graph view and
        evidence stay useful, but it says plainly that the question was not
        recognised and that what follows does not answer it.
        """
        closest = self._handle_why_delayed(project_id, raw_query)
        supported = "\n".join(f"- {question}" for question in self.SUPPORTED_QUESTIONS)

        closest["answer"] = (
            "### Question not recognised\n\n"
            f'I could not match **"{raw_query.strip()}"** to one of the supported, '
            "evidence-backed questions, so nothing below is an answer to it. "
            "I have run the closest traversal I have for reference.\n\n"
            "**Questions this graph can answer**\n\n"
            f"{supported}\n\n"
            "---\n\n"
            "## Closest supported query: project delay analysis\n\n"
            f"{closest['answer']}"
        )
        closest["direct_answer"] = None
        closest["confidence"] = 0.25
        closest["missing_facts"] = [
            f'No supported question intent matched "{raw_query.strip()}".',
            "The delay analysis shown is the nearest supported question, not the one that was asked.",
        ]
        return closest

    # ------------------------------------------------------------------
    # Response builders
    # ------------------------------------------------------------------

    def _make_response(
        self,
        query: str,
        cypher: str,
        params: Dict[str, Any],
        answer: str,
        evidence: List[Dict[str, Any]],
        highlight_nodes: List[str],
        highlight_edges: List[str],
        confidence: float,
        direct_answer: Optional[str] = None,
        summary_stats: Optional[Dict[str, Any]] = None,
        causal_chain: Optional[List[Dict[str, Any]]] = None,
        blockers: Optional[List[Dict[str, Any]]] = None,
        missing_facts: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        return {
            "query": query,
            "cypher": cypher.strip(),
            "cypher_params": params,
            "answer": answer,
            "evidence": evidence,
            "highlight_nodes": self._dedupe(highlight_nodes),
            "highlight_edges": self._dedupe(highlight_edges),
            "confidence": confidence,
            "mode": self.falkor.mode,
            "direct_answer": direct_answer,
            "summary_stats": summary_stats,
            "causal_chain": causal_chain,
            "blockers": blockers,
            "missing_facts": missing_facts or [],
        }

    def _build_empty_response(
        self, query: str, cypher: str, params: Dict[str, Any], reason: str
    ) -> Dict[str, Any]:
        return self._make_response(
            query, cypher, params,
            f"### Insufficient Evidence\n\nNo connected graph evidence was found matching your query. **Reason**: {reason}",
            [], [], [], 0.0,
            missing_facts=[reason],
        )


# Singleton accessor
_brain_service: Optional[BrainService] = None

def get_brain_service() -> BrainService:
    global _brain_service
    if _brain_service is None:
        _brain_service = BrainService()
    return _brain_service
