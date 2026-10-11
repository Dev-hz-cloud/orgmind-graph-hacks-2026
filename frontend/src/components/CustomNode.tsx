import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  FolderGit2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  Users,
  FileText,
  Scale
} from 'lucide-react';
import { NodeLabel } from '../types';

interface CustomNodeProps {
  data: {
    id: string;
    label: NodeLabel;
    title: string;
    properties: Record<string, any>;
    isHighlighted: boolean;
    isDimmed: boolean;
    isSelected?: boolean;
    onSelect?: (id: string) => void;
  };
}

const LABEL_THEME: Record<
  NodeLabel,
  { accent: string; badgeBg: string; badgeColor: string; icon: React.FC<{ size: number; color?: string }> }
> = {
  Project: {
    accent: '#38BDF8',
    badgeBg: 'rgba(56, 189, 248, 0.12)',
    badgeColor: '#38BDF8',
    icon: FolderGit2,
  },
  Task: {
    accent: '#F59E0B',
    badgeBg: 'rgba(245, 158, 11, 0.12)',
    badgeColor: '#F59E0B',
    icon: Clock,
  },
  Person: {
    accent: '#10B981',
    badgeBg: 'rgba(16, 185, 129, 0.12)',
    badgeColor: '#10B981',
    icon: User,
  },
  Decision: {
    accent: '#8B5CF6',
    badgeBg: 'rgba(139, 92, 246, 0.12)',
    badgeColor: '#A78BFA',
    icon: Scale,
  },
  Document: {
    accent: '#06B6D4',
    badgeBg: 'rgba(6, 182, 212, 0.12)',
    badgeColor: '#22D3EE',
    icon: FileText,
  },
  Team: {
    accent: '#F43F5E',
    badgeBg: 'rgba(244, 63, 94, 0.12)',
    badgeColor: '#FB7185',
    icon: Users,
  },
};

export const CustomGraphNode = memo(({ data }: CustomNodeProps) => {
  const { label, title, properties, isHighlighted, isDimmed, isSelected } = data;
  const theme = LABEL_THEME[label] || LABEL_THEME.Project;
  const Icon = theme.icon;

  const status = properties.status;
  const delay = properties.delay_days;
  const priority = properties.priority;

  // Determine left accent stripe
  let accentColor = theme.accent;
  if (status === 'BLOCKED' || status === 'DELAYED') {
    accentColor = '#EF4444';
  }

  // Refined, high-contrast status badge
  let statusBadge = null;
  if (status === 'BLOCKED') {
    statusBadge = (
      <span className="node-status-badge status-blocked">
        <AlertTriangle size={10} /> Blocked {delay ? `(${delay}d)` : ''}
      </span>
    );
  } else if (status === 'DELAYED') {
    statusBadge = (
      <span className="node-status-badge status-delayed">
        <AlertTriangle size={10} /> {delay}d delay
      </span>
    );
  } else if (status === 'ON_TRACK' || status === 'APPROVED') {
    statusBadge = (
      <span className="node-status-badge status-ok">
        <CheckCircle2 size={10} /> {status === 'APPROVED' ? 'Approved' : 'On Track'}
      </span>
    );
  } else if (status === 'PENDING') {
    statusBadge = (
      <span className="node-status-badge status-pending">
        <Clock size={10} /> Pending
      </span>
    );
  } else if (status === 'IN_PROGRESS') {
    statusBadge = (
      <span className="node-status-badge status-progress">
        In Progress
      </span>
    );
  }

  // Meaningful context snippet
  let contextSnippet = '';
  if (label === 'Person') {
    contextSnippet = properties.role ? `${properties.role} · ${properties.team || ''}` : properties.email || '';
  } else if (label === 'Task') {
    contextSnippet = properties.blocker_reason || (properties.due_date ? `Due ${properties.due_date}` : '');
  } else if (label === 'Decision') {
    contextSnippet = properties.impact || properties.rationale || '';
  } else if (label === 'Document') {
    contextSnippet = properties.type ? `${properties.type}: ${properties.summary || ''}` : properties.summary || '';
  } else if (label === 'Project') {
    contextSnippet = `${properties.progress || 0}% progress · Target ${properties.target_date || 'N/A'}`;
  }

  return (
    <div
      className={`node-card ${isHighlighted ? 'is-highlighted' : ''} ${isSelected ? 'is-selected' : ''} ${isDimmed ? 'is-dimmed' : ''}`}
      style={{ borderLeftColor: accentColor }}
      onClick={() => data.onSelect?.(data.id)}
    >
      {/* Target connection point (left & top) */}
      <Handle type="target" position={Position.Left} className="node-handle" />
      <Handle type="target" position={Position.Top} className="node-handle" id="top" />

      {/* Header with Type & Status */}
      <div className="node-card-header">
        <span
          className="node-category-pill"
          style={{ background: theme.badgeBg, color: theme.badgeColor }}
        >
          <Icon size={11} />
          <span>{label}</span>
        </span>
        {statusBadge}
      </div>

      {/* Node Title */}
      <div className="node-card-title" title={title}>
        {title}
      </div>

      {/* Node Snippet Context */}
      {contextSnippet && (
        <div className="node-card-snippet" title={contextSnippet}>
          {contextSnippet}
        </div>
      )}

      {/* Priority or Metadata Footer if critical */}
      {priority && priority === 'CRITICAL' && (
        <div className="node-card-footer">
          <span className="node-priority-chip">CRITICAL PRIORITY</span>
        </div>
      )}

      {/* Source connection point (right & bottom) */}
      <Handle type="source" position={Position.Right} className="node-handle" />
      <Handle type="source" position={Position.Bottom} className="node-handle" id="bottom" />
    </div>
  );
});
