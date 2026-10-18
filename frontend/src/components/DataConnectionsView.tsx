import React, { useState } from 'react';
import {
  Database,
  Terminal,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Play,
  Copy,
  Check,
  Server,
  ShieldCheck,
  KeyRound,
  ExternalLink,
  Layers,
  ArrowRight
} from 'lucide-react';
import { AppConfig, GraphSchema } from '../types';
import {
  testConnection,
  connectDatabase,
  switchDemoMode,
  seedDatabase,
  executeCypher,
} from '../services/api';

interface DataConnectionsViewProps {
  config: AppConfig | null;
  schema: GraphSchema | null;
  onRefreshData: () => Promise<void>;
}

const CYPHER_PRESETS = [
  {
    name: 'Blocked Tasks on the Critical Path',
    query:
      'MATCH (p:Project)-[:HAS_TASK]->(t:Task)-[:BLOCKED_BY]->(b:Task) RETURN p.name AS project, t.name AS blocked_task, b.name AS blocking_task, b.delay_days AS delay;',
  },
  {
    name: 'Pending Decisions & Their Owners',
    query:
      'MATCH (d:Decision)-[:MADE_BY]->(p:Person) RETURN d.id AS id, d.title AS decision, d.status AS status, p.name AS owner, p.role AS role;',
  },
  {
    name: 'All Cross-Team Dependencies',
    query:
      'MATCH (t1:Task)-[r:DEPENDS_ON|BLOCKED_BY]->(t2:Task) RETURN t1.name AS from_task, type(r) AS relationship, t2.name AS to_task;',
  },
  {
    name: 'Count Entities by Label',
    query: 'MATCH (n) RETURN labels(n)[0] AS entity_type, count(n) AS count ORDER BY count DESC;',
  },
];

export const DataConnectionsView: React.FC<DataConnectionsViewProps> = ({
  config,
  schema,
  onRefreshData,
}) => {
  // Connection Form State
  const [formData, setFormData] = useState({
    host: config?.falkordb_host || 'cloud.falkordb.com',
    port: config?.falkordb_port || 6379,
    username: config?.falkordb_username || 'default',
    password: '',
    ssl: config?.falkordb_ssl ?? true,
    graph_name: config?.falkordb_graph || 'orgmind_demo',
  });

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectResult, setConnectResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  // Cypher Console State
  const [cypherQuery, setCypherQuery] = useState(CYPHER_PRESETS[0].query);
  const [isExecutingCypher, setIsExecutingCypher] = useState(false);
  const [cypherResult, setCypherResult] = useState<{
    columns?: string[];
    rows?: any[][];
    error?: string;
    rowCount?: number;
  } | null>(null);
  const [copiedCypher, setCopiedCypher] = useState(false);

  const isLive = config?.mode === 'live' && config?.is_connected;

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testConnection({
        host: formData.host,
        port: Number(formData.port),
        username: formData.username,
        password: formData.password,
        ssl: formData.ssl,
        graph_name: formData.graph_name,
      });
      if (res.success) {
        setTestResult({ success: true, message: res.message || 'Connected successfully to FalkorDB Cloud!' });
      } else {
        setTestResult({ success: false, message: res.error || 'Connection failed' });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Network error during test' });
    } finally {
      setTesting(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnecting(true);
    setConnectResult(null);
    try {
      const res = await connectDatabase({
        host: formData.host,
        port: Number(formData.port),
        username: formData.username,
        password: formData.password,
        ssl: formData.ssl,
        graph_name: formData.graph_name,
      });
      if (res.success) {
        setConnectResult({ success: true, message: 'Connected to FalkorDB Live Cloud instance!' });
        await onRefreshData();
      } else {
        setConnectResult({ success: false, message: res.error || 'Connection attempt failed' });
      }
    } catch (err: any) {
      setConnectResult({ success: false, message: err.message || 'Failed to connect' });
    } finally {
      setConnecting(false);
    }
  };

  const handleSwitchToDemo = async () => {
    try {
      await switchDemoMode();
      await onRefreshData();
      setConnectResult({ success: true, message: 'Switched to zero-config Demo Mode' });
    } catch (err: any) {
      alert(`Error switching to demo: ${err.message}`);
    }
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    setSeedMessage(null);
    try {
      const res = await seedDatabase();
      setSeedMessage(
        `Successfully seeded ${res.nodes_seeded} nodes & ${res.edges_seeded} edges into "${res.graph_name}" via Cypher MERGE!`
      );
      await onRefreshData();
    } catch (err: any) {
      setSeedMessage(`Seeding failed: ${err.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleExecuteCypher = async () => {
    if (!cypherQuery.trim()) return;
    setIsExecutingCypher(true);
    setCypherResult(null);
    try {
      const res = await executeCypher(cypherQuery);
      if (res.success) {
        setCypherResult({
          columns: res.columns || [],
          rows: res.rows || [],
          rowCount: res.row_count || res.rows?.length || 0,
        });
      } else {
        setCypherResult({ error: res.error || 'Cypher execution failed' });
      }
    } catch (err: any) {
      setCypherResult({ error: err.message });
    } finally {
      setIsExecutingCypher(false);
    }
  };

  const handleCopyQuery = () => {
    navigator.clipboard.writeText(cypherQuery);
    setCopiedCypher(true);
    setTimeout(() => setCopiedCypher(false), 2000);
  };

  return (
    <div className="data-view-container">
      {/* Top Banner & Status */}
      <div className="data-header-card">
        <div className="data-header-meta">
          <div className="data-status-row">
            <span className={`pulse-dot ${isLive ? 'live' : 'demo'}`} />
            <h2 className="data-status-title">
              {isLive ? 'Live FalkorDB Cloud Connected' : 'Zero-Config Demo Mode Active'}
            </h2>
          </div>
          <p className="data-status-desc">
            {isLive
              ? `Real-time Cypher execution against ${config?.falkordb_host}:${config?.falkordb_port} on graph "${config?.falkordb_graph}".`
              : 'Using embedded NovaTech Logistics knowledge graph with in-memory graph traversal. Connect your FalkorDB Cloud instance below for live production queries.'}
          </p>
        </div>

        <div className="data-header-switch">
          {isLive ? (
            <button className="btn-secondary" onClick={handleSwitchToDemo}>
              Switch to Demo Mode
            </button>
          ) : (
            <span className="demo-pill-badge">Demo Mode Active</span>
          )}
        </div>
      </div>

      {/* Main Grid: Connection Settings + Graph Telemetry */}
      <div className="data-grid-two-col">
        {/* Left: Connection Configuration */}
        <div className="data-panel-card">
          <div className="data-card-title">
            <Server size={16} />
            <span>FalkorDB Connection Configuration</span>
          </div>
          <p className="data-card-subtitle">
            Configure FalkorDB Cloud credentials. Leave empty to stay in zero-config demo mode.
          </p>

          <form onSubmit={handleConnect} className="data-form">
            <div className="form-grid-2">
              <div className="form-group">
                <label>FalkorDB Host</label>
                <input
                  type="text"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  placeholder="e.g. xxx.cloud.falkordb.com"
                  className="data-input"
                />
              </div>
              <div className="form-group">
                <label>Port</label>
                <input
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) })}
                  className="data-input"
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="data-input"
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter FalkorDB password"
                  className="data-input"
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label>Graph Name</label>
                <input
                  type="text"
                  value={formData.graph_name}
                  onChange={(e) => setFormData({ ...formData, graph_name: e.target.value })}
                  placeholder="orgmind_demo"
                  className="data-input"
                />
              </div>
              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.ssl}
                    onChange={(e) => setFormData({ ...formData, ssl: e.target.checked })}
                  />
                  <span>Enable SSL / TLS (Recommended for Cloud)</span>
                </label>
              </div>
            </div>

            {testResult && (
              <div className={`form-feedback-box ${testResult.success ? 'success' : 'error'}`}>
                {testResult.success ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                <span>{testResult.message}</span>
              </div>
            )}

            {connectResult && (
              <div className={`form-feedback-box ${connectResult.success ? 'success' : 'error'}`}>
                {connectResult.success ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                <span>{connectResult.message}</span>
              </div>
            )}

            <div className="form-button-row">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleTestConnection}
                disabled={testing}
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
              <button type="submit" className="btn-primary" disabled={connecting}>
                {connecting ? 'Connecting...' : 'Save & Connect Live'}
              </button>
            </div>
          </form>
        </div>

        {/* Right: Telemetry & Demo Seeding */}
        <div className="data-panel-card">
          <div className="data-card-title">
            <Database size={16} />
            <span>Graph Schema & Telemetry</span>
          </div>
          <p className="data-card-subtitle">
            Current live graph structure, node label frequencies, and edge counts.
          </p>

          {schema ? (
            <div className="schema-overview-grid">
              <div className="schema-stat-box">
                <span className="stat-label">Total Nodes</span>
                <span className="stat-value">{schema.total_nodes}</span>
              </div>
              <div className="schema-stat-box">
                <span className="stat-label">Total Relationships</span>
                <span className="stat-value">{schema.total_edges}</span>
              </div>
              <div className="schema-stat-box">
                <span className="stat-label">Node Labels</span>
                <span className="stat-value">{Object.keys(schema.labels).length} Types</span>
              </div>
              <div className="schema-stat-box">
                <span className="stat-label">Graph Database</span>
                <span className="stat-value text-strong">{schema.graph_name}</span>
              </div>
            </div>
          ) : (
            <p className="text-muted">Loading schema...</p>
          )}

          {schema && (
            <div className="schema-details-group">
              <div className="details-col">
                <span className="sub-title">Entity Labels</span>
                <div className="pill-list">
                  {Object.entries(schema.labels).map(([lbl, count]) => (
                    <span key={lbl} className="stat-pill">
                      <strong>{lbl}</strong>: {count}
                    </span>
                  ))}
                </div>
              </div>

              <div className="details-col">
                <span className="sub-title">Relationship Types</span>
                <div className="pill-list">
                  {Object.entries(schema.relationships).map(([rel, count]) => (
                    <span key={rel} className="stat-pill">
                      <strong>{rel}</strong>: {count}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Seed Controls */}
          <div className="seed-controls-box">
            <div className="seed-text">
              <h4>Idempotent Demo Graph Seeding</h4>
              <p>
                Populates the NovaTech Logistics demo company (26 nodes, 32 edges) using Cypher MERGE
                statements. Safe to run repeatedly without duplicate records.
              </p>
            </div>
            <button className="btn-seed" onClick={handleSeed} disabled={isSeeding}>
              <RotateCw size={14} className={isSeeding ? 'animate-spin' : ''} />
              <span>{isSeeding ? 'Seeding Graph...' : 'Re-Seed Demo Data'}</span>
            </button>
          </div>

          {seedMessage && (
            <div className="seed-feedback-banner">
              <CheckCircle2 size={14} />
              <span>{seedMessage}</span>
            </div>
          )}
        </div>
      </div>

      {/* Embedded Cypher Console */}
      <div className="data-panel-card cypher-console-panel">
        <div className="cypher-header-row">
          <div className="data-card-title">
            <Terminal size={16} />
            <span>Interactive Cypher Console</span>
          </div>

          <div className="preset-selector-group">
            <span className="preset-label">Query Presets:</span>
            <select
              className="preset-select"
              onChange={(e) => setCypherQuery(e.target.value)}
              value={cypherQuery}
            >
              {CYPHER_PRESETS.map((p, idx) => (
                <option key={idx} value={p.query}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="cypher-editor-container">
          <textarea
            value={cypherQuery}
            onChange={(e) => setCypherQuery(e.target.value)}
            className="cypher-editor"
            rows={4}
            placeholder="MATCH (n) RETURN n LIMIT 10;"
          />
          <div className="cypher-editor-actions">
            <button className="btn-copy" onClick={handleCopyQuery}>
              {copiedCypher ? <Check size={13} color="#FFFFFF" /> : <Copy size={13} />}
              <span>{copiedCypher ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              className="btn-primary"
              onClick={handleExecuteCypher}
              disabled={isExecutingCypher || !cypherQuery.trim()}
            >
              <Play size={13} />
              <span>{isExecutingCypher ? 'Running...' : 'Execute Cypher'}</span>
            </button>
          </div>
        </div>

        {/* Results View */}
        {cypherResult && (
          <div className="cypher-results-box">
            {cypherResult.error ? (
              <div className="cypher-error-alert">
                <AlertTriangle size={15} />
                <span>Error: {cypherResult.error}</span>
              </div>
            ) : (
              <div className="table-responsive">
                <div className="table-meta-bar">
                  <span>Returned {cypherResult.rowCount} rows</span>
                </div>
                <table className="cypher-results-table">
                  <thead>
                    <tr>
                      {cypherResult.columns?.map((col, idx) => (
                        <th key={idx}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cypherResult.rows?.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx}>
                            {cell === null ? (
                              <span className="text-muted">null</span>
                            ) : typeof cell === 'object' ? (
                              JSON.stringify(cell)
                            ) : (
                              String(cell)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DataConnectionsView;
