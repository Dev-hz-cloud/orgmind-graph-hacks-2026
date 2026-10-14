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
  /* Nothing OS: categories are separated by luminance, not hue */
  Project: {
    color: 'var(--cat-project)',
    bgBadge: 'rgba(255, 255, 255, 0.14)',
    border: 'var(--cat-project)',
    icon: FolderGit2,
    category: 'PROJECT',
  },
  Task: {
    color: 'var(--cat-task)',
    bgBadge: 'rgba(255, 255, 255, 0.11)',
    border: 'var(--cat-task)',
    icon: Clock,
    category: 'TASK',
  },
  Person: {
    color: 'var(--cat-person)',
    bgBadge: 'rgba(255, 255, 255, 0.09)',
    border: 'var(--cat-person)',
    icon: User,
    category: 'PERSON',
  },
  Decision: {
    color: 'var(--cat-decision)',
    bgBadge: 'rgba(255, 255, 255, 0.08)',
    border: 'var(--cat-decision)',
    icon: Scale,
    category: 'DECISION',
  },
  Document: {
    color: 'var(--cat-document)',
    bgBadge: 'rgba(255, 255, 255, 0.07)',
    border: 'var(--cat-document)',
    icon: FileText,
    category: 'DOCUMENT',
  },
  Team: {
    color: 'var(--cat-team)',
    bgBadge: 'rgba(255, 255, 255, 0.06)',
    border: 'var(--cat-team)',
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
          ? 'var(--red-primary)'
          : isSelected
          ? 'var(--ink-primary)'
          : isBlocked
          ? 'rgba(215, 25, 33, 0.6)'
          : 'rgba(255, 255, 255, 0.14)',
      }}
    >
      <Handle type="target" position={Position.Left} className="scratch-node-handle" />

      {/* Node Header — flat plate with a hairline rule */}
      <div
        className="scratch-node-header"
        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}
      >
        <div
          className="scratch-node-icon-box"
          style={{
            background: isBlocked ? 'rgba(215, 25, 33, 0.22)' : theme.bgBadge,
            borderColor: isBlocked ? 'var(--status-danger)' : theme.color,
            color: isBlocked ? 'var(--status-danger)' : theme.color,
          }}
        >
          <Icon size={12} color="currentColor" />
        </div>
        <span
          className="scratch-node-category"
          style={{ color: isBlocked ? 'var(--status-danger)' : theme.color }}
        >
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
