import React from 'react';
import {
  BrainCircuit,
  Search,
  Database,
  FolderGit2,
  Settings2,
  Sparkles,
  Layers,
  Compass,
  Network
} from 'lucide-react';
import { AppConfig, GraphSchema } from '../types';

export type WorkspaceTab = 'investigate' | 'explore' | 'data';

interface SidebarProps {
  config: AppConfig | null;
  schema: GraphSchema | null;
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  selectedProject: string | null;
  onSelectProject: (projectId: string | null) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  config,
  schema,
  activeTab,
  onSelectTab,
  selectedProject,
  onSelectProject,
}) => {
  const isLive = config?.mode === 'live' && config?.is_connected;

  const projects = [
    {
      id: 'proj-titan',
      name: 'Project Titan',
      code: 'TITAN',
      status: 'delayed',
      label: '18d delay',
    },
    {
      id: 'proj-apollo',
      name: 'Project Apollo',
      code: 'APOLLO',
      status: 'on_track',
      label: 'On Track',
    },
    {
      id: 'proj-mercury',
      name: 'Project Mercury',
      code: 'MERCURY',
      status: 'at_risk',
      label: '7d delay',
    },
  ];

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="logo-badge">
          <BrainCircuit size={22} />
        </div>
        <div className="logo-text">
          <h1>OrgMind</h1>
          <p>Company Brain · FalkorDB</p>
        </div>
      </div>

      {/* Primary Workspace Navigation Tabs */}
      <div className="sidebar-section">
        <div className="section-label">
          <span>Workspaces</span>
          <Sparkles size={13} />
        </div>

        <button
          className={`sidebar-nav-tab ${activeTab === 'investigate' ? 'is-active' : ''}`}
          onClick={() => onSelectTab('investigate')}
        >
          <div className="tab-left">
            <BrainCircuit size={16} />
            <div className="tab-text">
              <span className="tab-title">Investigate</span>
              <span className="tab-sub">Q&A & Interactive Graph</span>
            </div>
          </div>
        </button>

        <button
          className={`sidebar-nav-tab ${activeTab === 'explore' ? 'is-active' : ''}`}
          onClick={() => onSelectTab('explore')}
        >
          <div className="tab-left">
            <Compass size={16} />
            <div className="tab-text">
              <span className="tab-title">Explore</span>
              <span className="tab-sub">Company Knowledge Catalog</span>
            </div>
          </div>
        </button>

        <button
          className={`sidebar-nav-tab ${activeTab === 'data' ? 'is-active' : ''}`}
          onClick={() => onSelectTab('data')}
        >
          <div className="tab-left">
            <Database size={16} />
            <div className="tab-text">
              <span className="tab-title">Data & Connections</span>
              <span className="tab-sub">FalkorDB & Cypher Console</span>
            </div>
          </div>
        </button>
      </div>

      {/* Projects Context Section (Always accessible) */}
      <div className="sidebar-section">
        <div className="section-label">
          <span>Active Initiatives</span>
          <FolderGit2 size={13} />
        </div>

        <button
          className={`sidebar-item ${selectedProject === null ? 'active' : ''}`}
          onClick={() => {
            onSelectProject(null);
            if (activeTab !== 'investigate') onSelectTab('investigate');
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={14} /> All Initiatives
          </span>
          <span className="status-chip on_track" style={{ fontSize: '0.62rem' }}>
            Full Graph
          </span>
        </button>

        {projects.map((p) => (
          <button
            key={p.id}
            className={`sidebar-item ${selectedProject === p.id ? 'active' : ''}`}
            onClick={() => {
              onSelectProject(p.id);
              if (activeTab !== 'investigate') onSelectTab('investigate');
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FolderGit2 size={14} /> {p.name}
            </span>
            <span className={`status-chip ${p.status}`}>{p.label}</span>
          </button>
        ))}
      </div>

      {/* Graph Telemetry Mini Card */}
      {schema && (
        <div className="sidebar-section" style={{ marginTop: 'auto', marginBottom: 0 }}>
          <div className="section-label">
            <span>Graph Telemetry</span>
            <Network size={13} />
          </div>
          <div className="sidebar-telemetry-box">
            <div className="telemetry-stat">
              <span className="stat-name">Nodes</span>
              <strong className="stat-num">{schema.total_nodes}</strong>
            </div>
            <div className="telemetry-stat">
              <span className="stat-name">Edges</span>
              <strong className="stat-num">{schema.total_edges}</strong>
            </div>
            <div className="telemetry-stat">
              <span className="stat-name">Labels</span>
              <strong className="stat-num">{Object.keys(schema.labels).length} types</strong>
            </div>
            <div className="telemetry-stat">
              <span className="stat-name">Database</span>
              <strong className="stat-num text-cyan" title={schema.graph_name}>
                {schema.graph_name}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Database Connection Card */}
      <div className="connection-card">
        <div className="connection-indicator">
          <span className={`pulse-dot ${isLive ? 'live' : 'demo'}`} />
          <span style={{ color: isLive ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
            {isLive ? 'Live FalkorDB Cloud' : 'Zero-Config Demo Mode'}
          </span>
        </div>
        <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 8 }}>
          {isLive
            ? `Connected to ${config?.falkordb_host}`
            : 'Using embedded NovaTech knowledge graph'}
        </p>
        <button
          className="btn-secondary"
          style={{
            width: '100%',
            padding: '6px 10px',
            fontSize: '0.72rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
          onClick={() => onSelectTab('data')}
        >
          <Settings2 size={13} /> Configure FalkorDB
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
