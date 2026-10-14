import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, PanelRight, MousePointer2, Sparkles, Network } from 'lucide-react';
import { GraphEdge, GraphNode } from '../types';
import {
  BLOCKING_RELATIONS,
  CubeDimension,
  DIMENSION_ICONS,
  SCRATCH_BLOCK_COLORS,
  clampPanelWidth,
  dimensionOf,
  nodeTitle,
} from '../shared/dimensions';

/* ==========================================================================
   Scratch Connection Map (right-side panel)
   --------------------------------------------------------------------------
   The only place in the explorer where category colour is allowed: the six
   entity categories keep their Scratch block hue here, while the cube itself
   stays in the Nothing OS monochrome ramp.

   Every block is a real node and every connector is a real edge, labelled with
   the untouched relationship name coming from FalkorDB.
   ========================================================================== */

interface ScratchBlockProps {
  node: GraphNode;
  isHub?: boolean;
  isActive?: boolean;
  degree: number;
  onSelect: (nodeId: string) => void;
}

const ScratchBlock: React.FC<ScratchBlockProps> = ({ node, isHub, isActive, degree, onSelect }) => {
  const dim = dimensionOf(node);
  const colors = SCRATCH_BLOCK_COLORS[dim];
  const Icon = DIMENSION_ICONS[dim];
  const status = node.properties?.status as string | undefined;

  return (
    <button
      type="button"
      className={[
        'scblock',
        isHub ? 'is-hub' : '',
        isActive ? 'is-active' : '',
        status === 'BLOCKED' ? 'is-blocked' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ background: colors.bg, color: colors.text }}
      onClick={() => onSelect(node.id)}
      title={`${dim} · ${nodeTitle(node, node.id)}`}
      aria-pressed={isActive}
    >
      <span className="scblock-icon" aria-hidden="true">
        <Icon size={isHub ? 16 : 14} />
      </span>
      <span className="scblock-body">
        <span className="scblock-cat">{dim}</span>
        <span className="scblock-title">{nodeTitle(node, node.id)}</span>
        <span className="scblock-id">{node.id}</span>
      </span>
      <span className="scblock-meta">
        {status && <span className="scblock-status">{status}</span>}
        <span className="scblock-degree">{degree}</span>
      </span>
    </button>
  );
};

const ScratchConnector: React.FC<{ rel: string }> = ({ rel }) => (
  <div
    className={`cmap-connector ${BLOCKING_RELATIONS.has(rel) ? 'is-blocking' : ''}`}
    aria-hidden="false"
  >
    <span className="cmap-connector-line" />
    <span className="cmap-connector-arrow" />
    <span className="cmap-connector-rel">-[{rel}]-&gt;</span>
  </div>
);

interface ScratchConnectionMapProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  /** Select an entity; the cube flies to its dimension */
  onSelectEntity: (nodeId: string) => void;
  onClearSelection: () => void;
  /** Entities of the currently focused cube dimension (roster mode) */
  dimension?: CubeDimension | null;
  detailsSlot?: React.ReactNode;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  width: number;
  onWidthChange: (width: number) => void;
}

export const ScratchConnectionMap: React.FC<ScratchConnectionMapProps> = ({
  nodes,
  edges,
  selectedNodeId,
  onSelectEntity,
  onClearSelection,
  dimension,
  detailsSlot,
  collapsed,
  onToggleCollapsed,
  width,
  onWidthChange,
}) => {
  const panelRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const degrees = useMemo(() => {
    const map = new Map<string, number>();
    edges.forEach((e) => {
      map.set(e.src, (map.get(e.src) || 0) + 1);
      map.set(e.dst, (map.get(e.dst) || 0) + 1);
    });
    return map;
  }, [edges]);

  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) || null : null;

  const { incoming, outgoing } = useMemo(() => {
    if (!selectedNodeId) return { incoming: [], outgoing: [] };

    const inc = edges
      .filter((e) => e.dst === selectedNodeId)
      .map((e) => ({ edge: e, other: nodeMap.get(e.src) }))
      .filter((item): item is { edge: GraphEdge; other: GraphNode } => !!item.other);

    const out = edges
      .filter((e) => e.src === selectedNodeId)
      .map((e) => ({ edge: e, other: nodeMap.get(e.dst) }))
      .filter((item): item is { edge: GraphEdge; other: GraphNode } => !!item.other);

    return { incoming: inc, outgoing: out };
  }, [edges, selectedNodeId, nodeMap]);

  const dimensionRoster = useMemo(() => {
    if (!dimension) return [];
    return nodes
      .filter((n) => dimensionOf(n) === dimension)
      .sort((a, b) => (degrees.get(b.id) || 0) - (degrees.get(a.id) || 0));
  }, [dimension, nodes, degrees]);

  const relationSummary = useMemo(() => {
    const counts = new Map<string, number>();
    [...incoming, ...outgoing].forEach(({ edge }) => {
      counts.set(edge.rel, (counts.get(edge.rel) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [incoming, outgoing]);

  /* ------------------------------------------------------------- resizing */

  const onResizePointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startWidth: width };
    setIsResizing(true);
  };

  const onResizePointerMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    onWidthChange(clampPanelWidth(drag.startWidth - (e.clientX - drag.startX)));
  };

  const endResize = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setIsResizing(false);
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const onResizeKeyDown = (e: React.KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onWidthChange(clampPanelWidth(width + 24));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      onWidthChange(clampPanelWidth(width - 24));
    }
  };

  /* Keep the panel usable when the window shrinks under the stored width */
  useEffect(() => {
    const onWindowResize = () => onWidthChange(clampPanelWidth(width));
    window.addEventListener('resize', onWindowResize);
    return () => window.removeEventListener('resize', onWindowResize);
  }, [width, onWidthChange]);

  const selectEntity = useCallback(
    (nodeId: string) => {
      onSelectEntity(nodeId);
    },
    [onSelectEntity]
  );

  if (collapsed) {
    return (
      <aside className="cmap-panel is-collapsed" ref={panelRef} aria-label="Scratch connection map">
        <button
          type="button"
          className="cmap-rail-toggle"
          onClick={onToggleCollapsed}
          title="Expand the Scratch connection map"
        >
          <PanelRight size={15} />
        </button>
        <span className="cmap-rail-label">Connection map</span>
        {selectedNode && <span className="cmap-rail-dot" title={nodeTitle(selectedNode, selectedNode.id)} />}
      </aside>
    );
  }

  return (
    <aside
      className={`cmap-panel ${isResizing ? 'is-resizing' : ''}`}
      style={{ width }}
      ref={panelRef}
      aria-label="Scratch connection map"
    >
      <span
        className="cmap-resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize connection map"
        tabIndex={0}
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={endResize}
        onPointerCancel={endResize}
        onKeyDown={onResizeKeyDown}
      >
        <span className="cmap-resize-grip" />
      </span>

      <header className="cmap-header">
        <div className="cmap-header-row">
          <span className="cmap-title">
            <span className="cmap-title-dot" />
            Scratch connection map
          </span>
          <div className="cmap-header-actions">
            {selectedNodeId && (
              <button
                type="button"
                className="cmap-icon-btn"
                onClick={onClearSelection}
                title="Clear the selected entity"
              >
                <X size={14} />
              </button>
            )}
            <button
              type="button"
              className="cmap-icon-btn"
              onClick={onToggleCollapsed}
              title="Collapse the panel"
            >
              <PanelRight size={14} />
            </button>
          </div>
        </div>

        <div className="cmap-sub">
          {selectedNode ? (
            <>
              <span className="cmap-sub-title">{nodeTitle(selectedNode, selectedNode.id)}</span>
              <span className="cmap-sub-meta">
                {incoming.length} in · {outgoing.length} out
              </span>
            </>
          ) : dimension ? (
            <>
              <span className="cmap-sub-title">{dimension} dimension</span>
              <span className="cmap-sub-meta">{dimensionRoster.length} records</span>
            </>
          ) : (
            <span className="cmap-sub-meta">Nothing selected</span>
          )}
        </div>
      </header>

      <div className="cmap-body">
        {selectedNode ? (
          <div className="cmap-flow">
            {incoming.length > 0 && <div className="cmap-group-label">Incoming relationships</div>}
            {incoming.map(({ edge, other }) => (
              <React.Fragment key={edge.id}>
                <ScratchBlock
                  node={other}
                  degree={degrees.get(other.id) || 0}
                  onSelect={selectEntity}
                />
                <ScratchConnector rel={edge.rel} />
              </React.Fragment>
            ))}

            <ScratchBlock
              node={selectedNode}
              isHub
              isActive
              degree={degrees.get(selectedNode.id) || 0}
              onSelect={selectEntity}
            />

            {outgoing.length > 0 && (
              <div className="cmap-group-label is-outgoing">Outgoing relationships</div>
            )}
            {outgoing.map(({ edge, other }) => (
              <React.Fragment key={edge.id}>
                <ScratchConnector rel={edge.rel} />
                <ScratchBlock
                  node={other}
                  degree={degrees.get(other.id) || 0}
                  onSelect={selectEntity}
                />
              </React.Fragment>
            ))}

            {incoming.length === 0 && outgoing.length === 0 && (
              <div className="cmap-inline-empty">
                <Network size={14} />
                <span>
                  No relationships recorded for this {selectedNode.label.toLowerCase()} in the current
                  view. Try focusing it in the cube or re-seeding the demo graph.
                </span>
              </div>
            )}

            {relationSummary.length > 0 && (
              <div className="cmap-rel-summary">
                {relationSummary.map(([rel, count]) => (
                  <span
                    key={rel}
                    className={`cmap-rel-chip ${BLOCKING_RELATIONS.has(rel) ? 'is-blocking' : ''}`}
                  >
                    {rel}
                    <span className="cmap-rel-chip-count">{count}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : dimension && dimensionRoster.length > 0 ? (
          <div className="cmap-roster">
            <div className="cmap-group-label">{dimension} dimension</div>
            <div className="cmap-roster-grid">
              {dimensionRoster.map((node) => (
                <ScratchBlock
                  key={node.id}
                  node={node}
                  degree={degrees.get(node.id) || 0}
                  onSelect={selectEntity}
                />
              ))}
            </div>
            <div className="cmap-inline-empty is-hint">
              <MousePointer2 size={13} />
              <span>Select a block to map its relationships, or click an entity in the cube.</span>
            </div>
          </div>
        ) : (
          <div className="cmap-empty">
            <span className="cmap-empty-glyph">◻◻◻</span>
            <h4>No entity selected</h4>
            <p>
              Pick an entity in the cube (or a dimension face) and its relationships appear here as
              Scratch-style blocks connected by directional lines.
            </p>
            <span className="cmap-empty-hint">
              <Sparkles size={12} /> Tip: press 1–6 to jump between dimensions
            </span>
          </div>
        )}
      </div>

      {detailsSlot && <div className="cmap-details">{detailsSlot}</div>}
    </aside>
  );
};

export default ScratchConnectionMap;
