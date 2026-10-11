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
    onSelect?: (id: string) => void;
  };
}

const LABEL_CONFIG: Record<
  NodeLabel,
  { color: string; bg: string; border: string; icon: React.FC<{ size: number; color?: string }> }
> = {
  Project: {
    color: '#38BDF8',
    bg: 'rgba(56, 189, 248, 0.12)',
    border: '#0284C7',
    icon: FolderGit2,
  },
  Task: {
    color: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.12)',
    border: '#D97706',
    icon: Clock,
  },
  Person: {
    color: '#34D399',
    bg: 'rgba(52, 211, 153, 0.12)',
    border: '#059669',
    icon: User,
  },
  Decision: {
    color: '#A78BFA',
    bg: 'rgba(167, 139, 250, 0.12)',
    border: '#7C3AED',
    icon: Scale,
  },
  Document: {
    color: '#22D3EE',
    bg: 'rgba(34, 211, 238, 0.12)',
    border: '#0891B2',
    icon: FileText,
  },
  Team: {
    color: '#FB7185',
    bg: 'rgba(251, 113, 133, 0.12)',
    border: '#E11D48',
    icon: Users,
  },
};

export const CustomGraphNode = memo(({ data }: CustomNodeProps) => {
  const { label, title, properties, isHighlighted, isDimmed } = data;
  const config = LABEL_CONFIG[label] || LABEL_CONFIG.Project;
  const Icon = config.icon;

  // Specific status pills
  const status = properties.status;
  const delay = properties.delay_days;
  const priority = properties.priority;

  let statusBadge = null;
  if (status === 'BLOCKED') {
    statusBadge = (
      <span className="status-chip delayed" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        <AlertTriangle size={10} /> Blocked {delay ? `(${delay}d)` : ''}
      </span>
    );
  } else if (status === 'DELAYED') {
    statusBadge = (
      <span className="status-chip delayed" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        <AlertTriangle size={10} /> Delayed ({delay}d)
      </span>
    );
  } else if (status === 'ON_TRACK' || status === 'APPROVED') {
    statusBadge = (
      <span className="status-chip on_track" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        <CheckCircle2 size={10} /> {status === 'APPROVED' ? 'Approved' : 'On Track'}
      </span>
    );
  } else if (status === 'PENDING') {
    statusBadge = (
      <span className="status-chip at_risk" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        <Clock size={10} /> Pending
      </span>
    );
  } else if (status === 'IN_PROGRESS') {
    statusBadge = (
      <span className="status-chip" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818CF8', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
        In Progress
      </span>
    );
  }

  // Snippet detail
  let detailSnippet = '';
  if (label === 'Person') {
    detailSnippet = properties.role || properties.team || '';
  } else if (label === 'Task' && properties.blocker_reason) {
    detailSnippet = properties.blocker_reason;
  } else if (label === 'Decision') {
    detailSnippet = properties.impact || '';
  } else if (label === 'Document') {
    detailSnippet = properties.summary || '';
  } else if (label === 'Project') {
    detailSnippet = `${properties.progress || 0}% complete · Target: ${properties.target_date || 'N/A'}`;
  }

  return (
    <div
      className={`rf-node-card ${isHighlighted ? 'highlighted' : ''} ${isDimmed ? 'dimmed' : ''}`}
      style={{
        borderLeft: `4px solid ${config.color}`,
      }}
      onClick={() => data.onSelect?.(data.id)}
    >
      <Handle type="target" position={Position.Top} style={{ background: config.color, width: 7, height: 7 }} />
      
      <div className="node-header">
        <span
          className="node-type-badge"
          style={{ background: config.bg, color: config.color, border: `1px solid ${config.border}` }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Icon size={11} /> {label}
          </span>
        </span>
        {statusBadge}
      </div>

      <div className="node-title">{title}</div>

      {detailSnippet && (
        <div
          className="node-prop-snippet"
          style={{
            maxHeight: '36px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {detailSnippet}
        </div>
      )}

      {priority && (
        <div style={{ marginTop: 4, fontSize: '0.65rem', color: priority === 'CRITICAL' ? '#EF4444' : '#94A3B8' }}>
          Priority: <strong>{priority}</strong>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: config.color, width: 7, height: 7 }} />
    </div>
  );
});
