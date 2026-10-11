import React from 'react';
import {
  X,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  ShieldAlert,
  Calendar,
  User,
  Hash
} from 'lucide-react';
import { GraphNode, GraphEdge } from '../types';

interface NodeInspectorProps {
  nodeId: string | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
  onAskAboutNode: (title: string) => void;
}

export const NodeInspector: React.FC<NodeInspectorProps> = ({
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

  const title = node.properties.name || node.properties.title || node.id;
  const props = node.properties;

  // Find incoming and outgoing edges
  const incoming = edges.filter((e) => e.dst === nodeId);
  const outgoing = edges.filter((e) => e.src === nodeId);

  const getNodeTitle = (id: string) => {
    const found = nodes.find((n) => n.id === id);
    return found ? found.properties.name || found.properties.title || found.id : id;
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 60,
        right: 20,
        width: 380,
        maxHeight: 'calc(100vh - 80px)',
        background: 'rgba(11, 15, 25, 0.95)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(99, 102, 241, 0.4)',
        borderRadius: 12,
        boxShadow: 'var(--shadow-lg), var(--glow-indigo)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <span
            className="node-type-badge"
            style={{
              background: 'rgba(99, 102, 241, 0.15)',
              color: 'var(--accent-indigo)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
            }}
          >
            {node.label}
          </span>
          <h3 style={{ fontSize: '0.92rem', color: '#FFFFFF', marginTop: 4 }}>{title}</h3>
        </div>
        <button className="close-btn" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      {/* Body content */}
      <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
        {/* Quick Ask */}
        <button
          className="btn-primary"
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: '0.78rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            marginBottom: 16,
          }}
          onClick={() => onAskAboutNode(title)}
        >
          <Sparkles size={13} /> Ask Brain about this {node.label}
        </button>

        {/* Properties table */}
        <div style={{ marginBottom: 16 }}>
          <div className="section-label" style={{ paddingLeft: 0 }}>
            <span>Node Properties</span>
            <Hash size={13} />
          </div>
          <div
            style={{
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: '0.75rem',
            }}
          >
            {Object.entries(props).map(([key, value]) => {
              if (key === 'id') return null;
              return (
                <div
                  key={key}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '4px 0',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                  }}
                >
                  <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                    {key.replace('_', ' ')}:
                  </span>
                  <span
                    style={{
                      color: key === 'status' && value === 'BLOCKED' ? '#EF4444' : '#F1F5F9',
                      fontWeight: key === 'status' ? 600 : 400,
                      textAlign: 'right',
                      maxWidth: '65%',
                      wordBreak: 'break-word',
                    }}
                  >
                    {String(value)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Incoming Edges */}
        {incoming.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div className="section-label" style={{ paddingLeft: 0 }}>
              <span>Incoming Edges ({incoming.length})</span>
              <ArrowLeft size={13} />
            </div>
            {incoming.map((e) => (
              <div
                key={e.id}
                onClick={() => onSelectNode(e.src)}
                style={{
                  padding: '7px 10px',
                  background: 'var(--bg-surface-2)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  marginBottom: 4,
                  fontSize: '0.72rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
              >
                <span style={{ color: 'var(--text-secondary)' }}>
                  <strong>{getNodeTitle(e.src)}</strong>
                </span>
                <span style={{ color: 'var(--accent-indigo)', fontFamily: 'monospace' }}>
                  -[{e.rel}]-&gt;
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Outgoing Edges */}
        {outgoing.length > 0 && (
          <div>
            <div className="section-label" style={{ paddingLeft: 0 }}>
              <span>Outgoing Edges ({outgoing.length})</span>
              <ArrowRight size={13} />
            </div>
            {outgoing.map((e) => (
              <div
                key={e.id}
                onClick={() => onSelectNode(e.dst)}
                style={{
                  padding: '7px 10px',
                  background: 'var(--bg-surface-2)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  marginBottom: 4,
                  fontSize: '0.72rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
              >
                <span style={{ color: 'var(--accent-cyan)', fontFamily: 'monospace' }}>
                  -[{e.rel}]-&gt;
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  <strong>{getNodeTitle(e.dst)}</strong>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
