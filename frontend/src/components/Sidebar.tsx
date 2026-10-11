import React from 'react';
import {
  BrainCircuit,
  MessageSquare,
  Workflow,
  Database,
  Terminal,
  RotateCw,
  Settings,
} from 'lucide-react';
import { AppConfig } from '../types';

export type MainTab = 'chat' | 'flow' | 'database';

interface SidebarProps {
  config: AppConfig | null;
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  onOpenCypher: () => void;
  onOpenSettings: () => void;
  onSeedData: () => void;
  isSeeding: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  config,
  activeTab,
  onSelectTab,
  onOpenCypher,
  onOpenSettings,
  onSeedData,
  isSeeding,
}) => {
  const isLive = config?.mode === 'live' && config?.is_connected;

  return (
    <nav className="discord-rail-sidebar">
      {/* 1. Brand Squircle Box */}
      <div className="discord-box-btn brand-box" title="OrgMind Company Brain">
        <BrainCircuit size={24} color="#FFFFFF" />
        <span className="brand-glow-ring" />
      </div>

      <div className="discord-rail-divider" />

      {/* 2. Primary Tabs (Discord Box Shape: 48x48px) */}
      <button
        className={`discord-box-btn ${activeTab === 'chat' ? 'is-active' : ''}`}
        onClick={() => onSelectTab('chat')}
        title="Chat Brain (Single Assistant)"
      >
        <span className="pill-indicator" />
        <MessageSquare size={20} />
      </button>

      <button
        className={`discord-box-btn ${activeTab === 'flow' ? 'is-active' : ''}`}
        onClick={() => onSelectTab('flow')}
        title="Workflow Graph (n8n + Scratch Square Blocks)"
      >
        <span className="pill-indicator" />
        <Workflow size={20} />
      </button>

      <button
        className={`discord-box-btn ${activeTab === 'database' ? 'is-active' : ''}`}
        onClick={() => onSelectTab('database')}
        title="Directory Database GUI (Browse & Edit Records)"
      >
        <span className="pill-indicator" />
        <Database size={20} />
      </button>

      <div className="discord-rail-divider" />

      {/* 3. Developer & Seed Tools */}
      <button
        className="discord-box-btn tool-box"
        onClick={onOpenCypher}
        title="Direct Cypher Console"
      >
        <Terminal size={18} />
      </button>

      <button
        className="discord-box-btn tool-box"
        onClick={onSeedData}
        disabled={isSeeding}
        title="Re-Seed Demo Graph (Cypher MERGE)"
      >
        <RotateCw size={18} className={isSeeding ? 'animate-spin' : ''} />
      </button>

      {/* 4. Bottom Settings & Connection */}
      <div className="discord-rail-bottom">
        <button
          className="discord-box-btn settings-box"
          onClick={onOpenSettings}
          title={`FalkorDB Settings (${isLive ? 'Live Cloud' : 'Zero-Config Demo'})`}
        >
          <Settings size={20} />
          <span className={`connection-dot ${isLive ? 'live' : 'demo'}`} />
        </button>
      </div>
    </nav>
  );
};

export default Sidebar;
