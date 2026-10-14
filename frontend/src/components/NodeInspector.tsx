import React from 'react';
import {
  X,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  Maximize2,
  GitBranch,
  ShieldAlert,
  Calendar,
  User,
  Hash
} from 'lucide-react';
import { GraphNode, GraphEdge, EvidenceItem } from '../types';

interface NodeInspectorProps {
  nodeId: string | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
  onAskAboutNode?: (title: string) => void;
  /** Evidence items from the current Brain answer (optional) */
  evidence?: EvidenceItem[];
  /** Open the full flashcard for this node */
  onOpenFlashcard?: (nodeId: string) => void;
  /** Whether the canvas currently shows only this node's neighborhood */
  neighborhoodOnly?: boolean;
  onToggleNeighborhood?: () => void;
  /**
   * `overlay` (default) floats over the canvas exactly as before.
   * `inline` fills its container — used inside the right-hand inspector section
   * of the cube explorer so every block click reveals details there.
   */
  variant?: 'overlay' | 'inline';
}

export const NodeInspector: React.FC<NodeInspectorProps> = ({
  nodeId,
  nodes,
  edges,
  onClose,
  onSelectNode,
  onAskAboutNode,
  evidence,
  onOpenFlashcard,
  neighborhoodOnly,
  onToggleNeighborhood,
  variant = 'overlay',
}) => {
  if (!nodeId) return null;

  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  const title = node.properties.name || node.properties.title || node.id;
  const props = node.properties;

  // Evidence from the current Brain answer that references this node
  const nodeEvidence = (evidence || []).filter((ev) => ev.entity_id === nodeId);

  // Find incoming and outgoing edges
  const incoming = edges.filter((e) => e.dst === nodeId);
  const outgoing = edges.filter((e) => e.src === nodeId);

  const getNodeTitle = (id: string) => {
    const found = nodes.find((n) => n.id === id);
    return found ? found.properties.name || found.properties.title || found.id : id;
  };

  const isInline = variant === 'inline';

  return (
    <div
      className={isInline ? 'node-inspector-inline' : undefined}
      style={
        isInline
          ? {
              position: 'static',
              width: '100%',
              background: 'transparent',
              border: 'none',
              borderRadius: 0,
              boxShadow: 'none',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }
          : {
              position: 'absolute',
              top: 60,
              right: 20,
              width: 380,
              maxHeight: 'calc(100vh - 80px)',
              background: 'rgba(0, 0, 0, 0.94)',
              backdropFilter: 'blur(16px)',
              border: '1px solid var(--line-strong)',
              borderRadius: 'var(--r-md)',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }
      }
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
              background: 'rgba(255, 255, 255, 0.08)',
              color: 'var(--text-white)',
              border: '1px solid var(--line)',
            }}
          >
            {node.label}
          </span>
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.98rem',
              color: '#FFFFFF',
              marginTop: 4,
            }}
          >
            {title}
          </h3>
        </div>
        <button className="close-btn" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      {/* Body content */}
      <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
        {/* Action row: expand flashcard / focus neighborhood */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {onOpenFlashcard && (
            <button
              className="btn-secondary btn-inspector-action"
              onClick={() => onOpenFlashcard(nodeId)}
              title="Open full flashcard"
            >
              <Maximize2 size={12} /> Expand
            </button>
          )}
          {onToggleNeighborhood && (
            <button
              className={`btn-secondary btn-inspector-action ${neighborhoodOnly ? 'is-on' : ''}`}
              onClick={onToggleNeighborhood}
              title="Show only this node and its direct connections"
            >
              <GitBranch size={12} /> {neighborhoodOnly ? 'Show All' : 'Neighbors'}
            </button>
          )}
        </div>

        {/* Quick Ask */}
        {onAskAboutNode && (
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
        )}

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
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                    {key.replace('_', ' ')}:
                  </span>
                  <span
                    style={{
                      color:
                        key === 'status' && value === 'BLOCKED'
                          ? 'var(--status-danger)'
                          : 'var(--text-primary)',
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

        {/* Evidence from current Brain answer */}
        {nodeEvidence.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div className="section-label" style={{ paddingLeft: 0 }}>
              <span>Evidence ({nodeEvidence.length})</span>
              <ShieldAlert size={13} />
            </div>
            {nodeEvidence.map((ev) => (
              <div
                key={ev.id}
                style={{
                  padding: '8px 10px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r-sm)',
                  marginBottom: 6,
                  fontSize: '0.72rem',
                }}
              >
                <strong style={{ color: 'var(--text-primary)' }}>{ev.title}</strong>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {ev.summary}
                </p>
              </div>
            ))}
          </div>
        )}

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
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
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
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
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
