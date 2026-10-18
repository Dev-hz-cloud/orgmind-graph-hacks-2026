"""
Seed dataset and Cypher generation for OrgMind (NovaTech Logistics Demo Organization).
Idempotent creation using Cypher MERGE.
"""

from typing import Any, Dict, List, Tuple

DEMO_NODES: List[Dict[str, Any]] = [
    # Projects
    {
        "id": "proj-titan",
        "label": "Project",
        "properties": {
            "id": "proj-titan",
            "name": "Project Titan",
            "key": "TITAN",
            "status": "DELAYED",
            "target_date": "2026-11-15",
            "delay_days": 18,
            "progress": 65,
            "description": "Next-gen predictive dispatch and route optimization platform across EU and NA distribution hubs."
        }
    },
    {
        "id": "proj-apollo",
        "label": "Project",
        "properties": {
            "id": "proj-apollo",
            "name": "Project Apollo",
            "key": "APOLLO",
            "status": "ON_TRACK",
            "target_date": "2026-12-01",
            "delay_days": 0,
            "progress": 88,
            "description": "Android/iOS cross-platform barcode & RFID inventory tracking app for warehouse associates."
        }
    },
    {
        "id": "proj-mercury",
        "label": "Project",
        "properties": {
            "id": "proj-mercury",
            "name": "Project Mercury",
            "key": "MERCURY",
            "status": "AT_RISK",
            "target_date": "2026-10-30",
            "delay_days": 7,
            "progress": 42,
            "description": "Real-time automated freight invoice matching and carrier escrow settlement payment pipeline."
        }
    },

    # Teams
    {
        "id": "team-platform",
        "label": "Team",
        "properties": {
            "id": "team-platform",
            "name": "Platform Architecture & DevOps",
            "department": "Infrastructure",
            "lead_name": "Marcus Vance"
        }
    },
    {
        "id": "team-titan",
        "label": "Team",
        "properties": {
            "id": "team-titan",
            "name": "Titan Routing Core",
            "department": "Engineering",
            "lead_name": "Sarah Chen"
        }
    },
    {
        "id": "team-security",
        "label": "Team",
        "properties": {
            "id": "team-security",
            "name": "InfoSec & Compliance",
            "department": "Security",
            "lead_name": "Elena Rostova"
        }
    },
    {
        "id": "team-carrier",
        "label": "Team",
        "properties": {
            "id": "team-carrier",
            "name": "Carrier Integrations",
            "department": "Product Operations",
            "lead_name": "David Kim"
        }
    },

    # People
    {
        "id": "person-elena",
        "label": "Person",
        "properties": {
            "id": "person-elena",
            "name": "Elena Rostova",
            "role": "VP of Engineering & Security Architect",
            "email": "elena.rostova@novatech-logistics.internal",
            "team": "Platform Architecture & DevOps"
        }
    },
    {
        "id": "person-marcus",
        "label": "Person",
        "properties": {
            "id": "person-marcus",
            "name": "Marcus Vance",
            "role": "Staff Infrastructure Architect",
            "email": "marcus.vance@novatech-logistics.internal",
            "team": "Platform Architecture & DevOps"
        }
    },
    {
        "id": "person-sarah",
        "label": "Person",
        "properties": {
            "id": "person-sarah",
            "name": "Sarah Chen",
            "role": "Lead Distributed Systems Engineer",
            "email": "sarah.chen@novatech-logistics.internal",
            "team": "Titan Routing Core"
        }
    },
    {
        "id": "person-aisha",
        "label": "Person",
        "properties": {
            "id": "person-aisha",
            "name": "Aisha Patel",
            "role": "Senior Security & Compliance Officer",
            "email": "aisha.patel@novatech-logistics.internal",
            "team": "InfoSec & Compliance"
        }
    },
    {
        "id": "person-david",
        "label": "Person",
        "properties": {
            "id": "person-david",
            "name": "David Kim",
            "role": "Product Director, Carrier Services",
            "email": "david.kim@novatech-logistics.internal",
            "team": "Carrier Integrations"
        }
    },
    {
        "id": "person-carlos",
        "label": "Person",
        "properties": {
            "id": "person-carlos",
            "name": "Carlos Mendez",
            "role": "Mobile Tech Lead",
            "email": "carlos.mendez@novatech-logistics.internal",
            "team": "Apollo Warehouse Tech"
        }
    },

    # Tasks
    {
        "id": "task-deploy-gateway",
        "label": "Task",
        "properties": {
            "id": "task-deploy-gateway",
            "title": "Deploy Multi-Region API Gateway v2",
            "status": "BLOCKED",
            "priority": "CRITICAL",
            "due_date": "2026-10-05",
            "delay_days": 18,
            "blocker_reason": "Blocked by security sign-off on cross-border data telemetry and SOC2 boundary definition."
        }
    },
    {
        "id": "task-sec-signoff",
        "label": "Task",
        "properties": {
            "id": "task-sec-signoff",
            "title": "SOC2 Telemetry Boundary Sign-Off",
            "status": "BLOCKED",
            "priority": "HIGH",
            "due_date": "2026-09-28",
            "delay_days": 14,
            "blocker_reason": "Waiting on executive sign-off for Decision DEC-2024-08 regarding EU customer telemetry residency."
        }
    },
    {
        "id": "task-kafka-sync",
        "label": "Task",
        "properties": {
            "id": "task-kafka-sync",
            "title": "Kafka Multi-Cluster Event Streaming",
            "status": "IN_PROGRESS",
            "priority": "MEDIUM",
            "due_date": "2026-10-25",
            "delay_days": 0,
            "blocker_reason": ""
        }
    },
    {
        "id": "task-perf-benchmark",
        "label": "Task",
        "properties": {
            "id": "task-perf-benchmark",
            "title": "Titan 100k Req/sec Load Testing",
            "status": "PENDING",
            "priority": "MEDIUM",
            "due_date": "2026-11-02",
            "delay_days": 5,
            "blocker_reason": "Cannot run synthetic load tests until API Gateway v2 is deployed to staging."
        }
    },
    {
        "id": "task-rfid-scanner",
        "label": "Task",
        "properties": {
            "id": "task-rfid-scanner",
            "title": "Bluetooth Low Energy RFID Scanner Driver",
            "status": "IN_PROGRESS",
            "priority": "HIGH",
            "due_date": "2026-11-10",
            "delay_days": 0,
            "blocker_reason": ""
        }
    },
    {
        "id": "task-carrier-webhook",
        "label": "Task",
        "properties": {
            "id": "task-carrier-webhook",
            "title": "Carrier Webhook Ingestion & Deduplication",
            "status": "BLOCKED",
            "priority": "CRITICAL",
            "due_date": "2026-10-15",
            "delay_days": 7,
            "blocker_reason": "Pending vendor compliance review and Decision DEC-2024-11 for escrow provider."
        }
    },

    # Decisions
    {
        "id": "dec-telemetry-residency",
        "label": "Decision",
        "properties": {
            "id": "dec-telemetry-residency",
            "title": "DEC-2024-08: EU Telemetry & Observability Data Residency Scope",
            "status": "PENDING",
            "date": "2026-09-24",
            "impact": "Halts production telemetry rollout and SOC2 sign-off for Project Titan until legal confirms Frankfurt datacenter isolation.",
            "rationale": "French and German enterprise customers contractually mandate in-region observability data retention."
        }
    },
    {
        "id": "dec-gateway-mesh",
        "label": "Decision",
        "properties": {
            "id": "dec-gateway-mesh",
            "title": "DEC-2024-05: Adoption of Envoy-based Service Mesh for Gateway",
            "status": "APPROVED",
            "date": "2026-08-15",
            "impact": "Approved unified routing and mutual TLS for all Titan microservices.",
            "rationale": "Evaluated Linkerd vs Istio vs Envoy; Envoy selected for latency and FalkorDB integration support."
        }
    },
    {
        "id": "dec-carrier-escrow",
        "label": "Decision",
        "properties": {
            "id": "dec-carrier-escrow",
            "title": "DEC-2024-11: Vendor Selection for Escrow Settlement Partner",
            "status": "PENDING",
            "date": "2026-10-02",
            "impact": "Prevents automated banking reconciliation go-live for Project Mercury.",
            "rationale": "Comparing Stripe Treasury vs Modern Treasury for European banking API hooks."
        }
    },

    # Documents
    {
        "id": "doc-adr-08",
        "label": "Document",
        "properties": {
            "id": "doc-adr-08",
            "title": "ADR-08: Data Residency and Sovereignty Architecture",
            "type": "ADR",
            "url": "https://wiki.novatech-logistics.internal/adr/08-data-residency",
            "summary": "Technical design specifications for isolating customer PII within EU borders for German enterprise contracts.",
            "updated_at": "2026-09-22"
        }
    },
    {
        "id": "doc-sec-audit",
        "label": "Document",
        "properties": {
            "id": "doc-sec-audit",
            "title": "SEC-2024-Q3: SOC2 Type II Gap Assessment Report",
            "type": "Security Audit",
            "url": "https://security.novatech-logistics.internal/audits/2024-q3-soc2-gap.pdf",
            "summary": "Formal audit flag identifying unencrypted telemetry sink risk in default Gateway configuration.",
            "updated_at": "2026-09-26"
        }
    },
    {
        "id": "doc-rfc-gateway",
        "label": "Document",
        "properties": {
            "id": "doc-rfc-gateway",
            "title": "RFC-104: Service Mesh Ingress Architecture",
            "type": "RFC",
            "url": "https://wiki.novatech-logistics.internal/rfc/104-ingress",
            "summary": "High-throughput ingress blueprint detailing Envoy sidecars, mTLS, and FalkorDB graph-backed cache lookups.",
            "updated_at": "2026-08-10"
        }
    },
    {
        "id": "doc-carrier-sla",
        "label": "Document",
        "properties": {
            "id": "doc-carrier-sla",
            "title": "SLA-2024: Carrier Payout Reconciliation Policy",
            "type": "Policy",
            "url": "https://legal.novatech-logistics.internal/policies/carrier-payout-sla",
            "summary": "Stipulates 48-hour automated escrow clearing rules under SEPA and NACHA regulations.",
            "updated_at": "2026-09-18"
        }
    }
]

DEMO_EDGES: List[Dict[str, Any]] = [
    # Project to Tasks
    {"src": "proj-titan", "rel": "HAS_TASK", "dst": "task-deploy-gateway"},
    {"src": "proj-titan", "rel": "HAS_TASK", "dst": "task-sec-signoff"},
    {"src": "proj-titan", "rel": "HAS_TASK", "dst": "task-kafka-sync"},
    {"src": "proj-titan", "rel": "HAS_TASK", "dst": "task-perf-benchmark"},
    {"src": "proj-apollo", "rel": "HAS_TASK", "dst": "task-rfid-scanner"},
    {"src": "proj-mercury", "rel": "HAS_TASK", "dst": "task-carrier-webhook"},

    # Task Blockers & Dependencies
    {"src": "task-deploy-gateway", "rel": "BLOCKED_BY", "dst": "task-sec-signoff"},
    {"src": "task-perf-benchmark", "rel": "BLOCKED_BY", "dst": "task-deploy-gateway"},
    {"src": "task-sec-signoff", "rel": "DEPENDS_ON", "dst": "dec-telemetry-residency"},
    {"src": "task-carrier-webhook", "rel": "DEPENDS_ON", "dst": "dec-carrier-escrow"},

    # Task Assignments & Waiting States
    {"src": "task-deploy-gateway", "rel": "ASSIGNED_TO", "dst": "person-marcus"},
    {"src": "task-sec-signoff", "rel": "ASSIGNED_TO", "dst": "person-aisha"},
    {"src": "task-sec-signoff", "rel": "WAITING_FOR", "dst": "person-elena"},
    {"src": "task-kafka-sync", "rel": "ASSIGNED_TO", "dst": "person-sarah"},
    {"src": "task-perf-benchmark", "rel": "ASSIGNED_TO", "dst": "person-sarah"},
    {"src": "task-rfid-scanner", "rel": "ASSIGNED_TO", "dst": "person-carlos"},
    {"src": "task-carrier-webhook", "rel": "ASSIGNED_TO", "dst": "person-david"},

    # Project Ownership
    {"src": "person-elena", "rel": "OWNS", "dst": "proj-titan"},
    {"src": "person-carlos", "rel": "OWNS", "dst": "proj-apollo"},
    {"src": "person-david", "rel": "OWNS", "dst": "proj-mercury"},

    # Decisions Made By
    {"src": "dec-telemetry-residency", "rel": "MADE_BY", "dst": "person-elena"},
    {"src": "dec-gateway-mesh", "rel": "MADE_BY", "dst": "person-marcus"},
    {"src": "dec-carrier-escrow", "rel": "MADE_BY", "dst": "person-david"},

    # Document Evidence References
    {"src": "dec-telemetry-residency", "rel": "REFERENCES", "dst": "doc-adr-08"},
    {"src": "task-sec-signoff", "rel": "MENTIONS", "dst": "doc-sec-audit"},
    {"src": "task-deploy-gateway", "rel": "MENTIONS", "dst": "doc-rfc-gateway"},
    {"src": "dec-carrier-escrow", "rel": "REFERENCES", "dst": "doc-carrier-sla"},

    # Team Memberships
    {"src": "person-elena", "rel": "MEMBER_OF", "dst": "team-platform"},
    {"src": "person-marcus", "rel": "MEMBER_OF", "dst": "team-platform"},
    {"src": "person-sarah", "rel": "MEMBER_OF", "dst": "team-titan"},
    {"src": "person-aisha", "rel": "MEMBER_OF", "dst": "team-security"},
    {"src": "person-david", "rel": "MEMBER_OF", "dst": "team-carrier"}
]


def generate_seed_cypher() -> List[Tuple[str, Dict[str, Any]]]:
    """
    Generate idempotent Cypher queries using MERGE with parameterized properties.
    """
    statements: List[Tuple[str, Dict[str, Any]]] = []

    # Create / Merge Nodes
    for node in DEMO_NODES:
        label = node["label"]
        node_id = node["id"]
        props = dict(node["properties"])
        props["_demo"] = True
        props["is_demo"] = True
        props["dataset"] = "novatech-logistics"
        # Use MERGE on unique ID and ON CREATE / ON MATCH SET
        cypher = f"""
        MERGE (n:{label} {{id: $id}})
        ON CREATE SET n = $props
        ON MATCH SET n = $props
        """
        statements.append((cypher.strip(), {"id": node_id, "props": props}))

    # Create / Merge Edges
    for edge in DEMO_EDGES:
        src = edge["src"]
        rel = edge["rel"]
        dst = edge["dst"]
        props = dict(edge.get("properties", {}))
        props["_demo"] = True
        props["is_demo"] = True
        props["dataset"] = "novatech-logistics"
        cypher = f"""
        MATCH (a {{id: $src}}), (b {{id: $dst}})
        MERGE (a)-[r:{rel}]->(b)
        ON CREATE SET r += $props
        ON MATCH SET r += $props
        """
        statements.append((cypher.strip(), {"src": src, "dst": dst, "props": props}))

    return statements
