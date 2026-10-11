import React from 'react';
import {
  X,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Clock,
  User,
  AlertTriangle,
  FileText,
  Scale,
  FolderGit2,
  Users
} from 'lucide-react';
import { GraphNode, GraphEdge, NodeLabel } from '../types';

interface FlashcardModalProps {
  nodeId: string | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
  onAskAboutNode: (title: string) => void;
}

const LABEL_THEMES: Record<
  NodeLabel,
  {
    bgGradient: string;
    borderGlow: string;
    badgeColor: string;
    icon: React.FC<{ size: number; color?: string }>;
    tag: string;
  }
> = {
  Project: {
    bgGradient: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(99, 102, 241, 0.2))',
    borderGlow: '#38BDF8',
    badgeColor: '#38BDF8',
    icon: FolderGit2,
    tag: 'PROJECT',
  },
  Task: {
    bgGradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(239, 68, 68, 0.2))',
    borderGlow: '#F59E0B',
    badgeColor: '#F59E0B',
    icon: Clock,
    tag: 'TASK',
  },
  Person: {
    bgGradient: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(236, 72, 153, 0.25))',
    borderGlow: '#EC4899',
    badgeColor: '#EC4899',
    icon: User,
    tag: 'TEAM MEMBER',
  },
  Decision: {
    bgGradient: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(99, 102, 241, 0.25))',
    borderGlow: '#A855F7',
    badgeColor: '#A855F7',
    icon: Scale,
    tag: 'DECISION',
  },
  Document: {
    bgGradient: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(59, 130, 246, 0.2))',
    borderGlow: '#06B6D4',
    badgeColor: '#06B6D4',
    icon: FileText,
    tag: 'DOCUMENT',
  },
  Team: {
    bgGradient: 'linear-gradient(135deg, rgba(244, 63, 94, 0.2), rgba(236, 72, 153, 0.2))',
    borderGlow: '#F43F5E',
    badgeColor: '#FB7185',
    icon: Users,
    tag: 'TEAM',
  },
};

export const FlashcardModal: React.FC<FlashcardModalProps> = ({
  nodeId,
  nodes,
  edges,
  onClose,
  onSelectNode,
  onAskAboutNode,
}) => {
  if (!nodeId) return null;

  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  const theme = LABEL_THEMES[node.label] || LABEL_THEMES.Project;
  const Icon = theme.icon;
  const props = node.properties || {};

  const title = props.name || props.title || node.id;
  const status = props.status;
  const delay = props.delay_days;
  const role = props.role;
  const email = props.email;
  const team = props.team;

  // Connected nodes
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const connectedOut = edges
    .filter((e) => e.src === node.id)
    .map((e) => ({ edge: e, target: nodeMap.get(e.dst) }))
    .filter((x) => x.target !== undefined);

  const connectedIn = edges
    .filter((e) => e.dst === node.id)
    .map((e) => ({ edge: e, source: nodeMap.get(e.src) }))
    .filter((x) => x.source !== undefined);

  return (
    <div className="flashcard-overlay" onClick={onClose}>
      <div className="flashcard-container" onClick={(e) => e.stopPropagation()}>
        {/* Glow Header */}
        <div
          className="flashcard-header"
          style={{ background: theme.bgGradient, borderColor: `${theme.borderGlow}50` }}
        >
          <div className="flashcard-badge" style={{ color: theme.badgeColor }}>
            <Icon size={14} />
            <span>{theme.tag}</span>
          </div>

          <button className="flashcard-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Main Card Body */}
        <div className="flashcard-body">
          {/* Top Info Banner */}
          <div className="flashcard-hero">
            {node.label === 'Person' ? (
              <div className="flashcard-avatar-huge">
                <span>{title.split(' ').map((n: string) => n[0]).join('')}</span>
              </div>
            ) : (
              <div
                className="flashcard-icon-huge"
                style={{ background: theme.bgGradient, color: theme.badgeColor }}
              >
                <Icon size={32} />
              </div>
            )}

            <div className="flashcard-hero-text">
              <h2 className="flashcard-title">{title}</h2>
              {role && <p className="flashcard-role">{role} {team ? `· ${team}` : ''}</p>}
              {status && (
                <div className="flashcard-status-row">
                  <span
                    className={`status-pill ${
                      status === 'BLOCKED' || status === 'DELAYED'
                        ? 'pill-red'
                        : status === 'APPROVED' || status === 'ON_TRACK'
                        ? 'pill-green'
                        : 'pill-yellow'
                    }`}
                  >
                    {status} {delay ? `(${delay}d impact)` : ''}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Human Readable Explanation */}
          <div className="flashcard-story-box">
            <span className="story-label">Context & Impact:</span>
            <p className="story-text">
              {props.blocker_reason ||
                props.description ||
                props.summary ||
                props.impact ||
                (node.label === 'Person'
                  ? `${title} is the designated owner for key technical decisions and delivery milestones.`
                  : `Active graph record linked across project dependencies.`)}
            </p>
          </div>

          {/* Properties Grid */}
          <div className="flashcard-props-grid">
            {Object.entries(props)
              .filter(([k]) => !['name', 'title', 'id', 'description', 'summary', 'blocker_reason', 'impact'].includes(k))
              .map(([key, val]) => (
                <div key={key} className="flashcard-prop-item">
                  <span className="prop-name">{key.replace(/_/g, ' ')}</span>
                  <strong className="prop-value">{String(val)}</strong>
                </div>
              ))}
          </div>

          {/* Connected Graph Links */}
          {(connectedOut.length > 0 || connectedIn.length > 0) && (
            <div className="flashcard-connections">
              <span className="connections-heading">Connected Graph Cards:</span>
              <div className="connection-chips-row">
                {connectedOut.map(({ edge, target }) => (
                  <button
                    key={edge.id}
                    className="connection-chip"
                    onClick={() => target && onSelectNode(target.id)}
                  >
                    <span className="conn-rel">-[{edge.rel}]-&gt;</span>
                    <strong className="conn-title">
                      {target?.properties.name || target?.properties.title || target?.id}
                    </strong>
                  </button>
                ))}
                {connectedIn.map(({ edge, source }) => (
                  <button
                    key={edge.id}
                    className="connection-chip"
                    onClick={() => source && onSelectNode(source.id)}
                  >
                    <span className="conn-rel">&lt;-[{edge.rel}]-</span>
                    <strong className="conn-title">
                      {source?.properties.name || source?.properties.title || source?.id}
                    </strong>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flashcard-footer">
          <button
            className="btn-flashcard-ask"
            onClick={() => {
              onAskAboutNode(title);
              onClose();
            }}
          >
            <Sparkles size={14} />
            <span>Ask Brain About This Card</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FlashcardModal;
