import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  FolderGit2,
  Clock,
  User,
  Users,
  FileText,
  Scale,
  Maximize2
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

// Scratch Category Color Palette
const SCRATCH_THEMES: Record<
  NodeLabel,
  {
    gradient: string;
    bgBlock: string;
    border: string;
    accent: string;
    icon: React.FC<{ size: number; color?: string }>;
    category: string;
  }
> = {
  Project: {
    gradient: 'linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)',
    bgBlock: '#0C4A6E',
    border: '#38BDF8',
    accent: '#38BDF8',
    icon: FolderGit2,
    category: 'PROJECT',
  },
  Task: {
    gradient: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
    bgBlock: '#78350F',
    border: '#F59E0B',
    accent: '#F59E0B',
    icon: Clock,
    category: 'TASK',
  },
  Person: {
    gradient: 'linear-gradient(135deg, #BE185D 0%, #EC4899 100%)',
    bgBlock: '#831843',
    border: '#EC4899',
    accent: '#EC4899',
    icon: User,
    category: 'MEMBER',
  },
  Decision: {
    gradient: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)',
    bgBlock: '#581C87',
    border: '#A855F7',
    accent: '#A855F7',
    icon: Scale,
    category: 'DECISION',
  },
  Document: {
    gradient: 'linear-gradient(135deg, #0891B2 0%, #22D3EE 100%)',
    bgBlock: '#164E63',
    border: '#22D3EE',
    accent: '#22D3EE',
    icon: FileText,
    category: 'DOCUMENT',
  },
  Team: {
    gradient: 'linear-gradient(135deg, #E11D48 0%, #FB7185 100%)',
    bgBlock: '#881337',
    border: '#FB7185',
    accent: '#FB7185',
    icon: Users,
    category: 'TEAM',
  },
};

export const CustomGraphNode = memo(({ data }: CustomNodeProps) => {
  const { label, title, properties, isHighlighted, isDimmed, isSelected } = data;
  const theme = SCRATCH_THEMES[label] || SCRATCH_THEMES.Project;
  const Icon = theme.icon;

  const status = properties.status;
  const delay = properties.delay_days;
  const isBlocked = status === 'BLOCKED' || status === 'DELAYED';

  let subText = '';
  if (label === 'Person') {
    subText = properties.role || properties.email || '';
  } else if (label === 'Task') {
    subText = isBlocked
      ? `${delay ? `${delay}d delay · ` : ''}Blocked`
      : properties.due_date
      ? `Due ${properties.due_date}`
      : 'Active';
  } else if (label === 'Decision') {
    subText = properties.status === 'PENDING' ? 'Pending sign-off' : 'Approved';
  } else if (label === 'Document') {
    subText = properties.type || 'Specification';
  } else if (label === 'Project') {
    subText = `${properties.progress || 0}% complete`;
  }

  return (
    <div
      className={`scratch-node-card ${isHighlighted ? 'is-highlighted' : ''} ${
        isSelected ? 'is-selected' : ''
      } ${isDimmed ? 'is-dimmed' : ''}`}
      onClick={() => data.onSelect?.(data.id)}
      style={{
        borderColor: isHighlighted ? '#EC4899' : isSelected ? '#A855F7' : `${theme.border}50`,
      }}
    >
      <Handle type="target" position={Position.Left} className="scratch-handle" />

      {/* Left Icon Notch / Block */}
      <div
        className="scratch-node-badge"
        style={{ background: theme.gradient }}
      >
        <Icon size={16} color="#FFFFFF" />
      </div>

      {/* Content */}
      <div className="scratch-node-content">
        <div className="scratch-node-top">
          <span className="scratch-node-cat" style={{ color: theme.accent }}>
            {theme.category}
          </span>
          {isBlocked && (
            <span className="scratch-delay-tag">{delay ? `${delay}d` : 'BLOCKED'}</span>
          )}
        </div>
        <div className="scratch-node-title" title={title}>
          {title}
        </div>
        {subText && (
          <div className="scratch-node-sub" title={subText}>
            {subText}
          </div>
        )}
      </div>

      <div className="scratch-expand-hint" title="Click to open flashcard">
        <Maximize2 size={11} />
      </div>

      <Handle type="source" position={Position.Right} className="scratch-handle" />
    </div>
  );
});

export default CustomGraphNode;
