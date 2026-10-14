import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EvidenceItem, GraphEdge, GraphNode } from '../types';
import {
  CubeDimension,
  FocusRequest,
  clampPanelWidth,
  latestFocus,
  nextFocusNonce,
} from '../shared/dimensions';
import { CubeExplorer } from './CubeExplorer';
import { GraphCanvas } from './GraphCanvas';
import { ScratchConnectionMap } from './ScratchConnectionMap';
import { NodeInspector } from './NodeInspector';

/* ==========================================================================
   Graph Explorer shell
   --------------------------------------------------------------------------
   Hosts the two views of the same live graph and the persistent right-side
   Scratch connection map:

     • Cube explorer  — the six entity categories as six navigable dimensions
     • Node graph     — the original React Flow explorer, unchanged

   Both views share App-level state (selection, evidence highlights, project
   filter), so Directory Index / Company Brain hand-offs keep working.
   ========================================================================== */

const PANEL_WIDTH_KEY = 'orgmind.scratchMap.width';
const PANEL_COLLAPSED_KEY = 'orgmind.scratchMap.collapsed';

function readStoredWidth(): number {
  try {
    const raw = window.localStorage.getItem(PANEL_WIDTH_KEY);
    if (raw) return clampPanelWidth(Number(raw));
  } catch {
    /* storage unavailable — fall through to the default */
  }
  return 380;
}

function readStoredCollapsed(): boolean {
  try {
    return window.localStorage.getItem(PANEL_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

interface GraphExplorerProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  highlightNodes: string[];
  highlightEdges: string[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onClearHighlight: () => void;
  selectedProject: string | null;
  onBackToChat?: () => void;
  onOpenFlashcard?: (nodeId: string) => void;
  evidence?: EvidenceItem[];
  onAskAboutNode?: (title: string) => void;
  /**
   * Focus request raised outside the explorer (Directory Index "Focus in Graph",
   * Company Brain entity hand-offs). Bump `nonce` to re-trigger the same target.
   */
  externalFocus?: FocusRequest | null;
}

export const GraphExplorer: React.FC<GraphExplorerProps> = ({
  nodes,
  edges,
  highlightNodes,
  highlightEdges,
  selectedNodeId,
  onSelectNode,
  onClearHighlight,
  selectedProject,
  onBackToChat,
  onOpenFlashcard,
  evidence,
  onAskAboutNode,
  externalFocus,
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<'cube' | 'graph'>('cube');
  const [panelWidth, setPanelWidth] = useState<number>(readStoredWidth);
  const [collapsed, setCollapsed] = useState<boolean>(readStoredCollapsed);
  const [dimension, setDimension] = useState<CubeDimension | null>(null);
  const [panelFocus, setPanelFocus] = useState<FocusRequest | null>(null);
  const narrowRef = useRef<boolean | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(PANEL_WIDTH_KEY, String(panelWidth));
    } catch {
      /* ignore */
    }
  }, [panelWidth]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PANEL_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  /* Responsive: the connection map collapses on narrow viewports, but the user
     can always reopen it (until the next breakpoint crossing). */
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? window.innerWidth;
      const narrow = width < 900;
      if (narrowRef.current === null) {
        narrowRef.current = narrow;
        if (narrow) setCollapsed(true);
        return;
      }
      if (narrow !== narrowRef.current) {
        narrowRef.current = narrow;
        setCollapsed(narrow);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const switchView = useCallback((next: 'cube' | 'graph') => {
    setView(next);
    if (next === 'graph') setDimension(null);
  }, []);

  /* Both focus sources share one monotonic nonce, so the newest request wins. */
  const focusRequest = useMemo(
    () => latestFocus(panelFocus, externalFocus),
    [panelFocus, externalFocus]
  );

  /* A block click in the Scratch map selects the entity AND asks the cube to
     fly to its dimension, so the panel and the cube never disagree. */
  const handleSelectFromPanel = useCallback(
    (nodeId: string) => {
      setPanelFocus({ nodeId, nonce: nextFocusNonce() });
      onSelectNode(nodeId);
    },
    [onSelectNode]
  );

  const inspectorDetails =
    view === 'cube' && selectedNodeId ? (
      <NodeInspector
        variant="inline"
        nodeId={selectedNodeId}
        nodes={nodes}
        edges={edges}
        evidence={evidence}
        onClose={() => onSelectNode(null)}
        onSelectNode={onSelectNode}
        onAskAboutNode={onAskAboutNode}
        onOpenFlashcard={onOpenFlashcard}
      />
    ) : undefined;

  return (
    <div className="graph-explorer" ref={rootRef}>
      <div className="graph-explorer-main">
        {view === 'cube' ? (
          <CubeExplorer
            nodes={nodes}
            edges={edges}
            highlightNodes={highlightNodes}
            highlightEdges={highlightEdges}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelectNode}
            onClearHighlight={onClearHighlight}
            selectedProject={selectedProject}
            onBackToChat={onBackToChat}
            onOpenFlashcard={onOpenFlashcard}
            evidence={evidence}
            onAskAboutNode={onAskAboutNode}
            onSwitchView={() => switchView('graph')}
            focusRequest={focusRequest}
            onDimensionChange={setDimension}
          />
        ) : (
          <GraphCanvas
            nodes={nodes}
            edges={edges}
            highlightNodes={highlightNodes}
            highlightEdges={highlightEdges}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelectNode}
            onClearHighlight={onClearHighlight}
            selectedProject={selectedProject}
            onBackToChat={onBackToChat}
            onOpenFlashcard={onOpenFlashcard}
            evidence={evidence}
            onAskAboutNode={onAskAboutNode}
            onSwitchView={() => switchView('cube')}
          />
        )}
      </div>

      <ScratchConnectionMap
        nodes={nodes}
        edges={edges}
        selectedNodeId={selectedNodeId}
        onSelectEntity={handleSelectFromPanel}
        onClearSelection={() => onSelectNode(null)}
        dimension={dimension}
        detailsSlot={inspectorDetails}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
        width={panelWidth}
        onWidthChange={setPanelWidth}
      />
    </div>
  );
};

export default GraphExplorer;
