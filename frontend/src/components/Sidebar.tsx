import React from 'react';
import {
  BrainCircuit,
  Hash,
  Sparkles,
  Zap,
  BookOpen,
  Terminal,
  RotateCw,
  Settings,
  HelpCircle,
  AlertTriangle,
  Scale,
  User,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { AppConfig, GraphSchema } from '../types';

export type ActiveView = 'chat' | 'graph' | 'records';

interface SidebarProps {
  config: AppConfig | null;
  schema: GraphSchema | null;
  activeView: ActiveView;
  onSelectView: (view: ActiveView) => void;
  selectedProject: string | null;
  onSelectProject: (projectId: string | null) => void;
  onQuickAsk: (question: string) => void;
  onOpenCypher: () => void;
  onOpenSettings: () => void;
  onSeedData: () => void;
  isSeeding: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  config,
  schema,
  activeView,
  onSelectView,
  selectedProject,
  onSelectProject,
  onQuickAsk,
  onOpenCypher,
  onOpenSettings,
  onSeedData,
  isSeeding,
}) => {
  const isLive = config?.mode === 'live' && config?.is_connected;

  const projects = [
    { id: 'proj-titan', name: 'project-titan', delay: '18d delay', isDelayed: true },
    { id: 'proj-apollo', name: 'project-apollo', delay: 'On Track', isOnTrack: true },
    { id: 'proj-mercury', name: 'project-mercury', delay: '7d delay', isRisk: true },
  ];

  return (
    <aside className="discord-sidebar">
      {/* 1. Server Header (Discord Style) */}
      <div className="discord-server-header">
        <div className="discord-server-icon">
          <BrainCircuit size={20} color="#FFFFFF" />
        </div>
        <div className="discord-server-info">
          <div className="discord-server-name">
            <span>OrgMind</span>
            <ShieldCheck size={14} className="discord-verified-icon" />
          </div>
          <span className="discord-server-sub">FalkorDB Company Brain</span>
        </div>
      </div>

      <div className="discord-channels-scroll">
        {/* 2. Workspace Channels */}
        <div className="discord-channel-group">
          <div className="discord-group-header">
            <span>VIEWS</span>
          </div>

          <button
            className={`discord-channel-item ${activeView === 'chat' ? 'is-active' : ''}`}
            onClick={() => onSelectView('chat')}
          >
            <div className="channel-item-left">
              <span className="channel-icon-hash">#</span>
              <span className="channel-name">investigation</span>
            </div>
            <span className="channel-badge-sub">Chat & Evidence</span>
          </button>

          <button
            className={`discord-channel-item ${activeView === 'graph' ? 'is-active' : ''}`}
            onClick={() => onSelectView('graph')}
          >
            <div className="channel-item-left">
              <Zap size={14} className="channel-icon-n8n" />
              <span className="channel-name">workflow-graph</span>
            </div>
            <span className="channel-badge-n8n">n8n View</span>
          </button>

          <button
            className={`discord-channel-item ${activeView === 'records' ? 'is-active' : ''}`}
            onClick={() => onSelectView('records')}
          >
            <div className="channel-item-left">
              <BookOpen size={14} className="channel-icon-book" />
              <span className="channel-name">company-records</span>
            </div>
          </button>
        </div>

        {/* 3. Project Channels */}
        <div className="discord-channel-group">
          <div className="discord-group-header">
            <span>INITIATIVES</span>
          </div>

          <button
            className={`discord-channel-item ${
              selectedProject === null && activeView === 'chat' ? 'is-active' : ''
            }`}
            onClick={() => {
              onSelectProject(null);
              onSelectView('chat');
            }}
          >
            <div className="channel-item-left">
              <span className="channel-icon-hash">#</span>
              <span className="channel-name">all-initiatives</span>
            </div>
          </button>

          {projects.map((p) => {
            const isSelected = selectedProject === p.id && activeView === 'chat';
            return (
              <button
                key={p.id}
                className={`discord-channel-item ${isSelected ? 'is-active' : ''}`}
                onClick={() => {
                  onSelectProject(p.id);
                  onSelectView('chat');
                }}
              >
                <div className="channel-item-left">
                  <span className="channel-icon-hash">#</span>
                  <span className="channel-name">{p.name}</span>
                </div>
                <span
                  className={`discord-status-pill ${
                    p.isDelayed ? 'pill-red' : p.isOnTrack ? 'pill-green' : 'pill-yellow'
                  }`}
                >
                  {p.delay}
                </span>
              </button>
            );
          })}
        </div>

        {/* 4. Quick Investigations (1-Click Questions) */}
        <div className="discord-channel-group">
          <div className="discord-group-header">
            <span>QUICK QUESTIONS</span>
          </div>

          <button
            className="discord-quick-btn"
            onClick={() => {
              onSelectView('chat');
              onQuickAsk('Why is Project Titan delayed?');
            }}
          >
            <AlertTriangle size={13} className="text-red" />
            <span>Why is Titan delayed?</span>
          </button>

          <button
            className="discord-quick-btn"
            onClick={() => {
              onSelectView('chat');
              onQuickAsk('Which tasks are blocking this launch?');
            }}
          >
            <Zap size={13} className="text-yellow" />
            <span>Critical blockers</span>
          </button>

          <button
            className="discord-quick-btn"
            onClick={() => {
              onSelectView('chat');
              onQuickAsk('Which decisions are still pending?');
            }}
          >
            <Scale size={13} className="text-purple" />
            <span>Pending decisions</span>
          </button>

          <button
            className="discord-quick-btn"
            onClick={() => {
              onSelectView('chat');
              onQuickAsk('Who owns the blocking task?');
            }}
          >
            <User size={13} className="text-green" />
            <span>Blocker owners</span>
          </button>
        </div>

        {/* 5. Database Tools */}
        <div className="discord-channel-group">
          <div className="discord-group-header">
            <span>DATABASE TOOLS</span>
          </div>

          <button className="discord-quick-btn" onClick={onOpenCypher}>
            <Terminal size={13} />
            <span>Cypher Console</span>
          </button>

          <button className="discord-quick-btn" onClick={onSeedData} disabled={isSeeding}>
            <RotateCw size={13} className={isSeeding ? 'animate-spin' : ''} />
            <span>{isSeeding ? 'Seeding...' : 'Re-Seed Demo Graph'}</span>
          </button>
        </div>
      </div>

      {/* 6. Discord User Bar (Bottom Profile & Connection Bar) */}
      <div className="discord-user-bar">
        <div className="discord-user-avatar-wrap">
          <div className="discord-user-avatar">
            <BrainCircuit size={16} />
          </div>
          <span className={`discord-status-dot ${isLive ? 'live' : 'demo'}`} />
        </div>

        <div className="discord-user-names" onClick={onOpenSettings} title="Click to configure FalkorDB">
          <span className="discord-user-tag">FalkorDB Brain</span>
          <span className="discord-user-status">
            {isLive ? 'Live Cloud' : 'Demo Mode (26 nodes)'}
          </span>
        </div>

        <button
          className="discord-user-settings-btn"
          onClick={onOpenSettings}
          title="FalkorDB Connection Settings"
        >
          <Settings size={16} />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
