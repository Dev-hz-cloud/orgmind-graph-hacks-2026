import React from 'react';
import {
  BrainCircuit,
  Database,
  Terminal,
  RotateCw,
  FolderGit2,
  Settings2,
  Sparkles,
  Layers
} from 'lucide-react';
import { AppConfig, GraphSchema } from '../types';

interface SidebarProps {
  config: AppConfig | null;
  schema: GraphSchema | null;
  selectedProject: string | null;
  onSelectProject: (projectId: string | null) => void;
  onOpenSettings: () => void;
  onOpenCypher: () => void;
  onSeedData: () => void;
  isSeeding: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  config,
  schema,
  selectedProject,
  onSelectProject,
  onOpenSettings,
  onOpenCypher,
  onSeedData,
  isSeeding,
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

      {/* Projects Section */}
      <div className="sidebar-section">
        <div className="section-label">
          <span>Active Projects</span>
          <FolderGit2 size={13} />
        </div>

        <button
          className={`sidebar-item ${selectedProject === null ? 'active' : ''}`}
          onClick={() => onSelectProject(null)}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={15} /> All Projects View
          </span>
          <span className="status-chip on_track" style={{ fontSize: '0.6rem' }}>
            Full Graph
          </span>
        </button>

        {projects.map((p) => (
          <button
            key={p.id}
            className={`sidebar-item ${selectedProject === p.id ? 'active' : ''}`}
            onClick={() => onSelectProject(p.id)}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FolderGit2 size={15} /> {p.name}
            </span>
            <span className={`status-chip ${p.status}`}>{p.label}</span>
          </button>
        ))}
      </div>

      {/* Tools & Utilities */}
      <div className="sidebar-section">
        <div className="section-label">
          <span>Graph Tools</span>
          <Sparkles size={13} />
        </div>

        <button className="sidebar-item" onClick={onOpenCypher}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Terminal size={15} /> Cypher Console
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--accent-indigo)' }}>Run queries</span>
        </button>

        <button className="sidebar-item" onClick={onSeedData} disabled={isSeeding}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RotateCw size={15} className={isSeeding ? 'animate-spin' : ''} />
            {isSeeding ? 'Seeding Graph...' : 'Re-Seed Demo Graph'}
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Cypher MERGE</span>
        </button>
      </div>

      {/* Graph Schema Snapshot */}
      {schema && (
        <div className="sidebar-section" style={{ marginTop: 'auto', marginBottom: 0 }}>
          <div className="section-label">
            <span>Graph Telemetry</span>
            <Database size={13} />
          </div>
          <div
            style={{
              padding: '10px 12px',
              background: 'var(--bg-surface-2)',
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              fontSize: '0.72rem',
              color: 'var(--text-secondary)',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
            }}
          >
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>Nodes</span>
              <strong style={{ color: '#FFFFFF', fontSize: '0.9rem' }}>{schema.total_nodes}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>Relationships</span>
              <strong style={{ color: '#FFFFFF', fontSize: '0.9rem' }}>{schema.total_edges}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>Labels</span>
              <strong style={{ color: '#FFFFFF' }}>{Object.keys(schema.labels).length} types</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>Graph ID</span>
              <strong style={{ color: 'var(--accent-cyan)', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
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
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 8 }}>
          {isLive
            ? `Connected to ${config?.falkordb_host}`
            : 'Using embedded FalkorDB schema graph'}
        </p>
        <button
          className="btn-secondary"
          style={{ width: '100%', padding: '6px 10px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          onClick={onOpenSettings}
        >
          <Settings2 size={13} /> Configure FalkorDB
        </button>
      </div>
    </aside>
  );
};
