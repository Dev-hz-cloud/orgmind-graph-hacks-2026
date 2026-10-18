# 🎬 OrgMind — End-to-End Demonstration Script

This reproducible script walks through demonstrating OrgMind for hackathon evaluation or video recording.

---

## 1. Environment & Startup

Ensure the application is running:

```bash
cd /home/manav/Downloads/orgm
./start.sh
```

- **Frontend**: `http://127.0.0.1:5173`
- **Backend API Docs**: `http://127.0.0.1:8000/docs`

---

## 2. Graph Grounding & Evidence-First Q&A

1. Navigate to `http://127.0.0.1:5173` in your browser.
2. The Company Brain loads with the initial question:
   > *"Why is Project Titan delayed?"*
3. **Verify the Answer Structure**:
   - **Direct Answer**: Explains that Project Titan is delayed by 18 days due to blocked multi-region gateway deployment.
   - **Verified Evidence**: Displays cards for `task-deploy-gateway`, `task-sec-signoff`, `dec-telemetry-residency`, and `person-elena`.
   - **Causal Path**: Shows the root-cause trajectory from Project to Task to Blocker to Decision to Owner.
   - **Technical Proof**: Expand the *Technical Proof* accordion at the bottom to view the parameterized Cypher query executed against FalkorDB.
4. Click on the `Elena Rostova` person card or `task-deploy-gateway` to open the full interactive flashcard with all properties and relationships.

---

## 3. Spatial Cube & Scratch-Style Workflow Views

1. Click **Open Scratch Flow** in the top right (or the workflow icon in the left rail).
2. Observe the Scratch-style causal blocks mirroring the exact evidence chain retrieved from FalkorDB.
3. Switch back to the **Cube Explorer**:
   - The CSS-3D cube displays the 6 organizational dimensions: *Project, Team, Person, Task, Decision, Document*.
   - Drag to rotate the cube in 3D.
   - Notice the highlighted nodes in the cube corresponding to the active evidence.

---

## 4. Durable Conversation Memory (Surviving Page Refresh)

1. Return to the **Chat** tab.
2. In the input box, enter a user assertion:
   > *"Remember that Marcus Vance is the primary engineer on call this week."*
3. The Brain confirms that Marcus Vance has been noted as on-call for this session.
4. **Simulate Refresh**:
   - Press `Ctrl + R` or `F5` to reload the page in the browser.
5. In the input box, ask the follow-up question:
   > *"Who did I say is on call this week?"*
6. **Observe the Grounded Response**:
   - The Brain retrieves the turn from persistent SQLite storage (`backend/data/orgmind_memory.db`).
   - Answers: *"You said that Marcus Vance is the primary engineer on call this week."*
   - **Honest Boundary Enforcement**: Notice that the Brain explicitly notes:
     > *"However, the graph does not contain an explicit on-call record. This assignment comes from your earlier conversation statement, not from a verified FalkorDB graph fact."*

---

## 5. Read-Only Safety Verification

1. Click the **Database Settings** (gear icon) in the bottom-left sidebar.
2. Open the **Cypher Console** tab.
3. Attempt to run a forbidden mutation:
   ```cypher
   CREATE (n:TestEntity {name: 'Unauthorized Node'})
   ```
4. Click **Run Query**.
5. Observe the tool rejection:
   > `Mutation operation forbidden in read-only tool: found CREATE`

---

## 6. Safe Opt-In Seeding & Database Inspector

1. Switch to the **Database View** (database icon in the left rail).
2. Browse through the tabs: **Projects**, **Teams**, **People**, **Tasks**, **Decisions**, **Documents**.
3. To inspect database seeding from the terminal:
   ```bash
   # Dry-run check:
   python backend/seed_db.py --dry-run

   # Seeding requires explicit opt-in confirmation:
   python backend/seed_db.py --confirm
   ```
   Notice that all records are clearly tagged with `_demo: true` and `dataset: "novatech-logistics"`.
