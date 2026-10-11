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

const LABEL_CONFIG: Record<
  NodeLabel,
  {
    color: string;
    bgColor: string;
    icon: React.FC<{ size: number; color?: string }>;
    tag: string;
  }
> = {
  Project: {
    color: '#38BDF8',
    bgColor: 'rgba(56, 189, 248, 0.15)',
    icon: FolderGit2,
    tag: 'PROJECT',
  },
  Task: {
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.15)',
    icon: Clock,
    tag: 'TASK',
  },
  Person: {
    color: '#10B981',
    bgColor: 'rgba(16, 185, 129, 0.15)',
    icon: User,
    tag: 'PERSON',
  },
  Decision: {
    color: '#8B5CF6',
    bgColor: 'rgba(139, 92, 246, 0.15)',
    icon: Scale,
    tag: 'DECISION',
  },
  Document: {
    color: '#06B6D4',
    bgColor: 'rgba(6, 182, 212, 0.15)',
    icon: FileText,
    tag: 'DOCUMENT',
  },
  Team: {
    color: '#FB7185',
    bgColor: 'rgba(251, 113, 133, 0.15)',
    icon: Users,
    tag: 'TEAM',
  },
};

export const CustomGraphNode = memo(({ data }: CustomNodeProps) => {
  const { label, title, properties, isHighlighted, isDimmed, isSelected } = data;
  const cfg = LABEL_CONFIG[label] || LABEL_CONFIG.Project;
  const Icon = cfg.icon;

  const status = properties.status;
  const delay = properties.delay_days;
  const isBlocked = status === 'BLOCKED' || status === 'DELAYED';

  // Subtitle snippet
  let subText = '';
  if (label === 'Person') {
    subText = properties.role || properties.email || '';
  } else if (label === 'Task') {
    subText = isBlocked ? `${delay ? `${delay}d delay · ` : ''}Blocked` : properties.due_date ? `Due ${properties.due_date}` : 'Active';
  } else if (label === 'Decision') {
    subText = properties.status === 'PENDING' ? 'Pending sign-off' : 'Approved';
  } else if (label === 'Document') {
    subText = properties.type || 'Specification';
  } else if (label === 'Project') {
    subText = `${properties.progress || 0}% progress · Target Nov 15`;
  }

  return (
    <div
      className={`n8n-node-card ${isHighlighted ? 'is-highlighted' : ''} ${
        isSelected ? 'is-selected' : ''
      } ${isDimmed ? 'is-dimmed' : ''}`}
      onClick={() => data.onSelect?.(data.id)}
    >
      {/* Target handle */}
      <Handle type="target" position={Position.Left} className="n8n-handle" />

      {/* Left Icon Square */}
      <div
        className="n8n-node-icon"
        style={{
          background: isBlocked ? 'rgba(239, 68, 68, 0.18)' : cfg.bgColor,
          borderColor: isBlocked ? 'rgba(239, 68, 68, 0.4)' : `${cfg.color}40`,
        }}
      >
        <Icon size={18} color={isBlocked ? '#EF4444' : cfg.color} />
      </div>

      {/* Center Details */}
      <div className="n8n-node-details">
        <div className="n8n-node-header">
          <span className="n8n-node-type" style={{ color: cfg.color }}>
            {cfg.tag}
          </span>
          {status && (
            <span
              className={`n8n-status-dot ${
                isBlocked ? 'status-red' : status === 'APPROVED' || status === 'ON_TRACK' ? 'status-green' : 'status-yellow'
              }`}
            />
          )}
        </div>
        <div className="n8n-node-title" title={title}>
          {title}
        </div>
        {subText && (
          <div className="n8n-node-sub" title={subText}>
            {subText}
          </div>
        )}
      </div>

      {/* Source handle */}
      <Handle type="source" position={Position.Right} className="n8n-handle" />
    </div>
  );
});

export default CustomGraphNode;
