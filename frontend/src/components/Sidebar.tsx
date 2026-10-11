import React from 'react';
import {
  BrainCircuit,
  MessageSquare,
  Puzzle,
  Layers,
  Terminal,
  RotateCw,
  Settings,
  Sparkles
} from 'lucide-react';
import { AppConfig } from '../types';

export type MainTab = 'chat' | 'flow' | 'deck';

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
        title="Chat Brain (Single Assistant Tab)"
      >
        <span className="pill-indicator" />
        <MessageSquare size={20} />
      </button>

      <button
        className={`discord-box-btn ${activeTab === 'flow' ? 'is-active' : ''}`}
        onClick={() => onSelectTab('flow')}
        title="Scratch Workflow Canvas"
      >
        <span className="pill-indicator" />
        <Puzzle size={20} />
      </button>

      <button
        className={`discord-box-btn ${activeTab === 'deck' ? 'is-active' : ''}`}
        onClick={() => onSelectTab('deck')}
        title="Flashcards Directory"
      >
        <span className="pill-indicator" />
        <Layers size={20} />
      </button>

      <div className="discord-rail-divider" />

      {/* 3. Utilities */}
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
