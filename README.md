# 🧠 OrgMind — An Evidence-First Company Brain

> **WeMakeDevs × FalkorDB Graph Hacks** — Target Track: **Company Brain**  
> An interactive company knowledge workspace that traces organizational blockers, dependencies, decisions, and evidence directly through a **FalkorDB** graph.

---

## 🎯 The Core Problem & Solution

Traditional AI assistants hallucinate answers or produce generic summaries without verifiable evidence. When an engineering executive or product lead asks:

> **"Why is this project delayed, and what evidence explains the delay?"**

OrgMind never guesses or invents company facts. Instead, it queries a **FalkorDB** graph, follows the real causal paths across projects, tasks, employees, decisions, and documents, and renders:
1. An executive summary citing **exact property metrics** (delay days, owners, status, dates).
2. The exact **Cypher query** executed against FalkorDB.
3. Interactive **Evidence Cards** linking to real graph nodes and audit documents.
4. An **Interactive Knowledge Graph** (React Flow) that pulsates and highlights the causal root-cause path.

---

## 🏛️ Architecture Overview

```mermaid
flowchart LR
    subgraph Frontend["Frontend (React 19 + Vite + TypeScript)"]
        UI["Modern Discord/Linear Dark UI"]
        Chat["Company Brain Q&A Panel"]
        Evidence["Evidence & Citation Cards"]
        GraphUI["Interactive Graph Canvas (React Flow)"]
        Inspector["Node & Relationship Inspector"]
    end

    subgraph Backend["Backend (FastAPI + Python 3.14)"]
        API["FastAPI REST Endpoints (/api)"]
        Router["Deterministic Question Router"]
        CypherGen["Parameterized Cypher Generator"]
        FalkorService["FalkorDB Driver & Query Executor"]
        Fallback["Zero-Config Fallback Graph Engine"]
    end

    subgraph Database["Graph Database (FalkorDB)"]
        FalkorCloud[("FalkorDB Cloud / Local RedisGraph")]
        CypherEngine["Cypher Pattern Match Engine"]
    end

    UI --> Chat & GraphUI
    Chat --> API
    Evidence -.->|Highlight Active Path| GraphUI
    API --> Router --> CypherGen --> FalkorService
    FalkorService -->|Live Mode (Cypher)| FalkorCloud
    FalkorService -.->|Demo Mode Fallback| Fallback
```

---

## 📊 Graph Data Model & Schema

OrgMind models a complete company ecosystem (*NovaTech Logistics* demo dataset) with 6 core node types and 10 relationship types:

### Node Labels
| Label | Description | Example Properties |
|---|---|---|
| **Project** | High-level initiatives and milestones | `id: 'proj-titan'`, `name`, `status: 'DELAYED'`, `delay_days: 18`, `target_date: '2026-11-15'`, `progress: 65%` |
| **Task** | Engineering, security, and rollout tickets | `id: 'task-deploy-gateway'`, `title`, `status: 'BLOCKED'`, `priority: 'CRITICAL'`, `delay_days: 18`, `blocker_reason` |
| **Person** | Engineers, team leads, and executives | `id: 'person-elena'`, `name: 'Elena Rostova'`, `role: 'VP of Engineering'`, `email`, `team` |
| **Decision** | Governance & Architecture Decision Records | `id: 'dec-telemetry-residency'`, `title: 'DEC-2024-08'`, `status: 'PENDING'`, `impact`, `rationale` |
| **Document** | Specifications, audit reports, RFCs, SLAs | `id: 'doc-sec-audit'`, `title: 'SEC-2024-Q3 Audit Report'`, `type: 'Security Audit'`, `url`, `summary` |
| **Team** | Organizational departments | `id: 'team-platform'`, `name: 'Platform Architecture & DevOps'`, `department: 'Infrastructure'` |

### Edge Relationships
| Relationship | From Label | To Label | Meaning |
|---|---|---|---|
| `HAS_TASK` | `Project` | `Task` | Project contains task |
| `BLOCKED_BY` | `Task` | `Task` | Task cannot complete until upstream task is finished |
| `DEPENDS_ON` | `Task` | `Decision` | Task execution requires approval of an organizational decision |
| `ASSIGNED_TO` | `Task` | `Person` | Individual responsible for executing the task |
| `WAITING_FOR` | `Task` | `Person` | Task blocked waiting for sign-off from a specific person |
| `OWNS` | `Person` | `Project` | Executive or technical owner of project |
| `MADE_BY` | `Decision` | `Person` | Decision maker / owner |
| `REFERENCES` | `Decision` | `Document` | Decision cites policy, RFC, or audit report |
| `MENTIONS` | `Task` | `Document` | Task notes reference an ADR or specification |
| `MEMBER_OF` | `Person` | `Team` | Departmental team membership |

---

## 🔍 Core Hackathon Cypher Queries

### 1. Root Cause Delay Tracing
```cypher
MATCH (p:Project {id: $projectId})-[:HAS_TASK]->(t:Task)
WHERE t.status = 'BLOCKED' OR t.delay_days > 0
OPTIONAL MATCH (t)-[:BLOCKED_BY]->(blocker:Task)
OPTIONAL MATCH (blocker)-[:ASSIGNED_TO]->(owner:Person)
OPTIONAL MATCH (blocker)-[:WAITING_FOR]->(waiting:Person)
OPTIONAL MATCH (blocker)-[:DEPENDS_ON]->(dec:Decision)
OPTIONAL MATCH (dec)-[:MADE_BY]->(decider:Person)
OPTIONAL MATCH (dec)-[:REFERENCES]->(doc:Document)
OPTIONAL MATCH (t)-[:MENTIONS]->(taskDoc:Document)
RETURN p, t, blocker, owner, waiting, dec, decider, doc, taskDoc
```

### 2. Identifying Active Blocker Tasks
```cypher
MATCH (p:Project {id: $projectId})-[:HAS_TASK]->(t:Task)
OPTIONAL MATCH (t)-[r:BLOCKED_BY]->(b:Task)
OPTIONAL MATCH (b)-[:ASSIGNED_TO]->(owner:Person)
RETURN t, r, b, owner
```

### 3. Finding Owners of Blocked Work & Waiting States
```cypher
MATCH (t:Task {status: 'BLOCKED'})
OPTIONAL MATCH (t)-[:ASSIGNED_TO]->(owner:Person)
OPTIONAL MATCH (t)-[:WAITING_FOR]->(waiting:Person)
OPTIONAL MATCH (t)-[:DEPENDS_ON]->(d:Decision)-[:MADE_BY]->(decider:Person)
RETURN t, owner, waiting, d, decider
```

### 4. Auditing Pending Decisions Impacting Velocity
```cypher
MATCH (d:Decision {status: 'PENDING'})
OPTIONAL MATCH (d)-[:MADE_BY]->(owner:Person)
OPTIONAL MATCH (t:Task)-[:DEPENDS_ON]->(d)
OPTIONAL MATCH (p:Project)-[:HAS_TASK]->(t)
OPTIONAL MATCH (d)-[:REFERENCES]->(doc:Document)
RETURN d, owner, t, p, doc
```

---

## ⚡ Quick Start Guide

### Prerequisites
- **Linux / macOS / Windows**
- **Python 3.10+** (tested on Python 3.14)
- **Node.js 18+** & **npm**

### Step 1: Clone & Enter Directory
```bash
cd orgm
```

### Step 2: One-Command Startup
OrgMind includes an automated startup script that handles virtual environments, dependencies, port checks, and starts both backend and frontend servers:

```bash
./start.sh
```

- **Frontend Application**: [http://127.0.0.1:5173](http://127.0.0.1:5173)
- **FastAPI Backend**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Interactive Swagger API Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

To stop both servers at any time:
```bash
./stop.sh
```

---

## 🌐 Connecting FalkorDB Cloud

OrgMind works in **Zero-Config Demo Mode** out-of-the-box using the embedded NovaTech dataset. When you are ready to connect your live FalkorDB Cloud instance:

### Option A: Via the Web UI (Recommended)
1. Open the app at [http://127.0.0.1:5173](http://127.0.0.1:5173).
2. Click **Configure FalkorDB** in the bottom-left sidebar card.
3. Enter your connection details from [app.falkordb.cloud](https://app.falkordb.cloud):
   - **Host / Endpoint**: e.g. `your-cluster.falkordb.cloud`
   - **Port**: `6379` (or your assigned cloud port)
   - **Username**: `default`
   - **Password**: your FalkorDB database password
   - **SSL/TLS**: check if using a secure cloud endpoint
   - **Graph Name**: `orgmind_demo` (or custom name)
4. Click **Test Connection** to verify live connectivity.
5. Click **Save & Connect**!

### Option B: Via `.env` File
Create or edit `.env` in the project root:
```ini
FALKORDB_HOST=your-endpoint.falkordb.cloud
FALKORDB_PORT=6379
FALKORDB_USERNAME=default
FALKORDB_PASSWORD=your_actual_password_here
FALKORDB_GRAPH=orgmind_demo
FALKORDB_SSL=true
DEMO_MODE=false
```
Then restart the app with `./start.sh`.

### Idempotent Database Seeding
To seed your live FalkorDB Cloud instance with the NovaTech demo dataset, simply click **"Re-Seed Demo Graph"** in the sidebar, or run:
```bash
backend/.venv/bin/python backend/seed_db.py
```
This executes idempotent Cypher `MERGE` statements without duplicating records or corrupting existing data.

---

## 🧪 Running Automated Tests

OrgMind includes a comprehensive test suite for intent classification, Cypher query construction, non-hallucination evidence extraction, and REST API endpoints:

```bash
PYTHONPATH=backend backend/.venv/bin/pytest backend/tests -v
```

All 15 automated test cases verify:
- ✅ Why Project Titan is delayed (root cause tracing)
- ✅ Active blocking tasks identification
- ✅ Task owner and waiting-for relationship extraction
- ✅ Pending governance decisions filtering
- ✅ Downstream dependency resolution
- ✅ Document evidence references (ADR-08, SOC2 gap report)
- ✅ Subgraph filtering by project
- ✅ Schema telemetries and counts
- ✅ Health, Config, Graph, Schema, Query, and Seed REST endpoints

---

## 🎮 Interactive Features to Demo

1. **Ask Track Questions**:
   - *"Why is Project Titan delayed?"* -> Shows how API Gateway v2 is blocked by SOC2 telemetry sign-off, which is waiting for DEC-2024-08 owned by Elena Rostova.
   - *"Which tasks are blocking this launch?"*
   - *"Who owns the blocking task?"*
   - *"Which decisions are still pending?"*
   - *"What depends on this task?"*
   - *"Show the evidence connected to this issue."*
2. **Interactive Evidence Path Highlighting**:
   - Click on any **Evidence Card** in the center panel.
   - Notice how the knowledge graph immediately dims unrelated nodes and pulsates the exact active path in neon indigo and cyan!
3. **Deep Node Inspector**:
   - Click any node on the graph canvas to inspect its complete properties, incoming edges, and outgoing edges.
   - Click "Ask Brain about this entity" to ask a contextual question.
4. **Cypher Query Inspector**:
   - Click **"View Cypher Query"** on any answer to see the raw Cypher query sent to FalkorDB.
5. **Direct Cypher Console**:
   - Open **"Cypher Console"** in the sidebar to run arbitrary read-only Cypher queries and inspect tabular JSON results live.

---

## 🛡️ Reliability & Security Highlights
- **Zero Hardcoded Secrets**: All credentials are kept strictly in `.env` (excluded by `.gitignore`).
- **No Frontend Exposure**: Browser JavaScript never directly talks to Redis/FalkorDB; all Cypher queries are mediated by the FastAPI backend.
- **Strict Non-Hallucination**: Answers are compiled only from verified properties and relations present in the graph.
- **Lightweight Footprint**: Runs on modest hardware with zero Docker requirement, zero heavy ML weights, and instant start times.
