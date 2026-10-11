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
      className={`n8n-cube-node ${isHighlighted ? 'is-highlighted' : ''} ${
        isSelected ? 'is-selected' : ''
      } ${isDimmed ? 'is-dimmed' : ''}`}
      onClick={() => data.onSelect?.(data.id)}
      style={{
        borderColor: isHighlighted
          ? '#EC4899'
          : isSelected
          ? '#A855F7'
          : isBlocked
          ? 'rgba(239, 68, 68, 0.5)'
          : `${theme.border}40`,
      }}
    >
      <Handle type="target" position={Position.Left} className="n8n-cube-handle" />

      {/* Left Cube Badge */}
      <div
        className="cube-badge"
        style={{
          background: isBlocked ? 'rgba(239, 68, 68, 0.2)' : theme.bgBadge,
          borderColor: isBlocked ? '#EF4444' : theme.color,
        }}
      >
        <Icon size={14} color={isBlocked ? '#EF4444' : theme.color} />
      </div>

      {/* Center Details */}
      <div className="cube-details">
        <div className="cube-top-row">
          <span className="cube-category-tag" style={{ color: theme.color }}>
            {theme.category}
          </span>
          {isBlocked && (
            <span className="cube-delay-pill">{delay ? `${delay}d` : 'BLOCKED'}</span>
          )}
        </div>
        <div className="cube-title" title={title}>
          {title}
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="n8n-cube-handle" />
    </div>
  );
});

export default CustomGraphNode;
