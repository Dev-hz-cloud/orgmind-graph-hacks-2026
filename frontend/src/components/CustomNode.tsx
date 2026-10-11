import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  FolderGit2,
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

const CUBE_THEMES: Record<
  NodeLabel,
  {
    color: string;
    bgBadge: string;
    border: string;
    icon: React.FC<{ size: number; color?: string }>;
    category: string;
  }
> = {
  Project: {
    color: '#38BDF8',
    bgBadge: 'rgba(56, 189, 248, 0.18)',
    border: '#38BDF8',
    icon: FolderGit2,
    category: 'PROJECT',
  },
  Task: {
    color: '#F59E0B',
    bgBadge: 'rgba(245, 158, 11, 0.18)',
    border: '#F59E0B',
    icon: Clock,
    category: 'TASK',
  },
  Person: {
    color: '#EC4899',
    bgBadge: 'rgba(236, 72, 153, 0.18)',
    border: '#EC4899',
    icon: User,
    category: 'PERSON',
  },
  Decision: {
    color: '#A855F7',
    bgBadge: 'rgba(168, 85, 247, 0.18)',
    border: '#A855F7',
    icon: Scale,
    category: 'DECISION',
  },
  Document: {
    color: '#06B6D4',
    bgBadge: 'rgba(6, 182, 212, 0.18)',
    border: '#06B6D4',
    icon: FileText,
    category: 'DOCUMENT',
  },
  Team: {
    color: '#FB7185',
    bgBadge: 'rgba(251, 113, 133, 0.18)',
    border: '#FB7185',
    icon: Users,
    category: 'TEAM',
  },
};

export const CustomGraphNode = memo(({ data }: CustomNodeProps) => {
  const { label, title, properties, isHighlighted, isDimmed, isSelected } = data;
  const theme = CUBE_THEMES[label] || CUBE_THEMES.Project;
  const Icon = theme.icon;

  const status = properties.status;
  const delay = properties.delay_days;
  const isBlocked = status === 'BLOCKED' || status === 'DELAYED';

  return (
    <div
      className={`scratch-cube-node ${isHighlighted ? 'is-highlighted' : ''} ${
        isSelected ? 'is-selected' : ''
      } ${isDimmed ? 'is-dimmed' : ''}`}
      onClick={() => data.onSelect?.(data.id)}
      style={{
        borderColor: isHighlighted
          ? '#EC4899'
          : isSelected
          ? '#A855F7'
          : isBlocked
          ? 'rgba(239, 68, 68, 0.6)'
          : `${theme.border}44`,
      }}
    >
      <Handle type="target" position={Position.Left} className="scratch-node-handle" />

      {/* Scratch Block Header Notch */}
      <div
        className="scratch-node-header"
        style={{
          background: `linear-gradient(90deg, ${theme.color}25, transparent)`,
          borderBottom: `1px solid ${theme.color}33`,
        }}
      >
        <div
          className="scratch-node-icon-box"
          style={{
            background: isBlocked ? 'rgba(239, 68, 68, 0.25)' : theme.bgBadge,
            borderColor: isBlocked ? '#EF4444' : theme.color,
          }}
        >
          <Icon size={12} color={isBlocked ? '#EF4444' : theme.color} />
        </div>
        <span className="scratch-node-category" style={{ color: theme.color }}>
          {theme.category}
        </span>
      </div>

      {/* Square Center Body */}
      <div className="scratch-node-body">
        <div className="scratch-node-title" title={title}>
          {title}
        </div>

        {/* Status or Metric pill */}
        <div className="scratch-node-footer">
          {isBlocked ? (
            <span className="scratch-status-badge is-delayed">
              {delay ? `+${delay}d Delay` : 'Blocked'}
            </span>
          ) : status ? (
            <span className="scratch-status-badge is-status">{status}</span>
          ) : properties.role ? (
            <span className="scratch-status-badge is-role">{properties.role}</span>
          ) : (
            <span className="scratch-status-badge is-id">{data.id}</span>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="scratch-node-handle" />
    </div>
  );
});

export default CustomGraphNode;
