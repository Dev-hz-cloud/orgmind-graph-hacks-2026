import React, { useMemo, useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Node,
  Edge,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import {
  Filter,
  RotateCcw,
  Maximize2,
  ZoomIn,
  ZoomOut,
  ArrowLeft,
  FolderGit2,
  Clock,
  User,
  Users,
  Scale,
  FileText,
  Sparkles,
  GitBranch,
  Boxes,
} from 'lucide-react';
import { GraphNode, GraphEdge, NodeLabel, EvidenceItem } from '../types';
import { CustomGraphNode } from './CustomNode';
import { NodeInspector } from './NodeInspector';

const nodeTypes = {
  custom: CustomGraphNode,
};

interface GraphCanvasProps {
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
  /** Evidence items from the current Brain answer, shown in the node inspector */
  evidence?: EvidenceItem[];
  onAskAboutNode?: (title: string) => void;
  /** Switch to the six-dimension cube explorer (same graph, same state) */
  onSwitchView?: () => void;
}

/* Nothing OS: edges are a monochrome ramp; only blockage carries the red glyph */
const EDGE_COLORS: Record<string, string> = {
  BLOCKED_BY: '#D71921',
  DEPENDS_ON: '#B0B0B0',
  ASSIGNED_TO: '#C2C2C2',
  WAITING_FOR: '#949494',
  HAS_TASK: '#DCDCDC',
  REFERENCES: '#828282',
  MENTIONS: '#B0B0B0',
  MADE_BY: '#A8A8A8',
  OWNS: '#C8C8C8',
  MEMBER_OF: '#828282',
};

/* Must match the rendered .scratch-cube-node card size (bigger cards = more
   legible node text at the default fit, and Dagre spaces them correctly). */
const NODE_WIDTH = 210;
const NODE_HEIGHT = 92;

const CATEGORY_ICONS: Record<NodeLabel, React.FC<{ size: number; color?: string }>> = {
  Project: FolderGit2,
  Task: Clock,
  Person: User,
  Decision: Scale,
  Document: FileText,
  Team: Users,
};

const LEGEND_ITEMS: Array<{ label: NodeLabel; color: string }> = [
  { label: 'Project', color: '#FFFFFF' },
  { label: 'Task', color: '#DCDCDC' },
  { label: 'Person', color: '#C2C2C2' },
  { label: 'Team', color: '#828282' },
  { label: 'Decision', color: '#A8A8A8' },
  { label: 'Document', color: '#949494' },
];

function calculateDagreLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  direction: 'LR' | 'TB' = 'LR'
): Record<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));

  g.setGraph({
    rankdir: direction,
    align: 'UL',
    nodesep: 55,
    ranksep: 110,
    marginx: 45,
    marginy: 45,
  });

  nodes.forEach((n) => {
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  const nodeIds = new Set(nodes.map((n) => n.id));
  edges.forEach((e) => {
    if (nodeIds.has(e.src) && nodeIds.has(e.dst)) {
      g.setEdge(e.src, e.dst);
    }
  });

  dagre.layout(g);

  const positions: Record<string, { x: number; y: number }> = {};
  nodes.forEach((n) => {
    const dagreNode = g.node(n.id);
    if (dagreNode) {
      positions[n.id] = {
        x: Math.round(dagreNode.x - NODE_WIDTH / 2),
        y: Math.round(dagreNode.y - NODE_HEIGHT / 2),
      };
    } else {
      positions[n.id] = { x: 0, y: 0 };
    }
  });

  return positions;
}

const GraphCanvasInternal: React.FC<GraphCanvasProps> = ({
  nodes: rawNodes,
  edges: rawEdges,
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
  onSwitchView,
}) => {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const [filterType, setFilterType] = useState<string>('ALL');
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [layoutDirection, setLayoutDirection] = useState<'LR' | 'TB'>('LR');
  const [neighborhoodOnly, setNeighborhoodOnly] = useState<boolean>(false);
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // Compute 1-hop neighborhood for selected node
  const neighborhood = useMemo(() => {
    if (!selectedNodeId) return { nodeIds: new Set<string>(), edgeIds: new Set<string>() };

    const connectedEdges = rawEdges.filter(
      (e) => e.src === selectedNodeId || e.dst === selectedNodeId
    );
    const nodeIds = new Set<string>([selectedNodeId]);
    const edgeIds = new Set<string>();

    connectedEdges.forEach((e) => {
      edgeIds.add(e.id);
      nodeIds.add(e.src);
      nodeIds.add(e.dst);
    });

    return { nodeIds, edgeIds };
  }, [selectedNodeId, rawEdges]);

  // Canvas-filtered nodes: label filter + optional neighborhood-only focus
  const directoryNodes = useMemo(() => {
    return rawNodes.filter((n) => {
      if (filterType !== 'ALL' && n.label.toUpperCase() !== filterType) {
        return false;
      }
      if (neighborhoodOnly && selectedNodeId && !neighborhood.nodeIds.has(n.id)) {
        return false;
      }
      return true;
    });
  }, [rawNodes, filterType, neighborhoodOnly, selectedNodeId, neighborhood]);

  // Flow Nodes & Edges Generation
  const { flowNodes, flowEdges } = useMemo(() => {
    const visibleNodeIds = new Set(directoryNodes.map((n) => n.id));
    const isHighlightActive =
      highlightNodes.length > 0 || (selectedNodeId !== null && neighborhood.nodeIds.size > 0);

    const positions = calculateDagreLayout(directoryNodes, rawEdges, layoutDirection);

    const generatedNodes: Node[] = directoryNodes.map((n) => {
      const pos = positions[n.id] || { x: 0, y: 0 };
      const isPathHighlighted = highlightNodes.includes(n.id);
      const isNeighborHighlighted = selectedNodeId !== null && neighborhood.nodeIds.has(n.id);
      const isSelected = selectedNodeId === n.id;
      const isHighlighted = isPathHighlighted || isNeighborHighlighted || isSelected;
      const isDimmed = isHighlightActive && !isHighlighted;

      return {
        id: n.id,
        type: 'custom',
        position: pos,
        data: {
          id: n.id,
          label: n.label,
          title: n.properties.name || n.properties.title || n.id,
          properties: n.properties,
          isHighlighted,
          isSelected,
          isDimmed,
          onSelect: (nodeId: string) => {
            onSelectNode(nodeId);
          },
        },
      };
    });

    const generatedEdges: Edge[] = rawEdges
      .filter((e) => visibleNodeIds.has(e.src) && visibleNodeIds.has(e.dst))
      .map((e) => {
        const isPathHighlighted =
          highlightEdges.includes(e.id) ||
          (highlightNodes.includes(e.src) && highlightNodes.includes(e.dst));
        const isNeighborEdge = selectedNodeId !== null && neighborhood.edgeIds.has(e.id);
        const isHighlighted = isPathHighlighted || isNeighborEdge;
        const isHovered = hoveredEdgeId === e.id;
        const isDimmed = isHighlightActive && !isHighlighted && !isHovered;

        const baseColor = EDGE_COLORS[e.rel] || '#B0B0B0';
        const strokeColor = isHighlighted || isHovered ? baseColor : 'rgba(255, 255, 255, 0.16)';
        const strokeWidth = isHighlighted || isHovered ? 2.5 : 1.3;

        const showLabel = isHighlighted || isHovered || (e.rel === 'BLOCKED_BY' && !isDimmed);

        return {
          id: e.id,
          source: e.src,
          target: e.dst,
          label: showLabel ? e.rel : undefined,
          animated: isHighlighted || (e.rel === 'BLOCKED_BY' && !isDimmed),
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: strokeColor,
            width: isHighlighted ? 12 : 9,
            height: isHighlighted ? 12 : 9,
          },
          style: {
            stroke: strokeColor,
            strokeWidth,
            strokeDasharray: e.rel === 'BLOCKED_BY' || e.rel === 'WAITING_FOR' ? '4,4' : undefined,
            opacity: isDimmed ? 0.35 : 1,
            cursor: 'pointer',
          },
          labelStyle: {
            fill: isHighlighted ? '#FFFFFF' : '#C4C4C4',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.6,
            fontFamily: 'var(--font-mono)',
          },
          labelBgStyle: {
            fill: '#000000',
            fillOpacity: 0.95,
            stroke: isHighlighted ? baseColor : 'rgba(255, 255, 255, 0.22)',
            strokeWidth: 1,
          },
          labelBgPadding: [5, 4] as [number, number],
          labelBgBorderRadius: 3,
        };
      });

    return { flowNodes: generatedNodes, flowEdges: generatedEdges };
  }, [
    directoryNodes,
    rawEdges,
    highlightNodes,
    highlightEdges,
    selectedNodeId,
    neighborhood,
    hoveredEdgeId,
    layoutDirection,
    onSelectNode,
  ]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  useEffect(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [flowNodes, flowEdges, setNodes, setEdges]);

  // Refit when the visible node set actually changes (initial load, filter,
  // project switch) — but never on mere selection changes, so a user's manual
  // zoom/pan is not disrupted while exploring.
  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ padding: 0.12, duration: 400 });
    }, 150);
    return () => clearTimeout(timer);
  }, [selectedProject, layoutDirection, filterType, neighborhoodOnly, flowNodes.length, fitView]);

  const hasGraphData = rawNodes.length > 0;

  return (
    <div className="scratch-graph-workspace">
      <main className="n8n-cube-canvas-panel">
        {/* Floating Canvas Toolbar */}
        <div className="canvas-floating-toolbar">
          <div className="canvas-toolbar-left">
            {onBackToChat && (
              <button className="btn-canvas-back" onClick={onBackToChat} title="Return to Company Brain">
                <ArrowLeft size={14} />
                <span>Brain</span>
              </button>
            )}

            <div className="canvas-flow-tag">
              <Sparkles size={13} className="text-dimmed" />
              <span>
                {selectedProject ? selectedProject.toUpperCase().replace('PROJ-', '') : 'FULL GRAPH'}
              </span>
              <span className="canvas-node-count">{directoryNodes.length} nodes</span>
            </div>
          </div>

          <div className="canvas-toolbar-right">
            {onSwitchView && (
              <button
                className="btn-canvas-tool"
                onClick={onSwitchView}
                title="Switch to the six-dimension cube explorer"
              >
                <Boxes size={13} />
                <span>Cube</span>
              </button>
            )}

            <button
              className={`btn-canvas-tool ${showFilters ? 'is-active' : ''}`}
              onClick={() => setShowFilters((v) => !v)}
              title="Filter nodes by category"
            >
              <Filter size={13} />
              <span>Filter</span>
            </button>

            <button
              className="btn-canvas-tool btn-icon"
              onClick={() => zoomOut()}
              title="Zoom out"
            >
              <ZoomOut size={14} />
            </button>
            <button
              className="btn-canvas-tool btn-icon"
              onClick={() => zoomIn()}
              title="Zoom in"
            >
              <ZoomIn size={14} />
            </button>
            <button
              className="btn-canvas-tool btn-icon"
              onClick={() => fitView({ padding: 0.12, duration: 400 })}
              title="Fit graph to view"
            >
              <Maximize2 size={13} />
            </button>

            <button
              className="btn-canvas-tool"
              onClick={() => {
                setLayoutDirection((prev) => (prev === 'LR' ? 'TB' : 'LR'));
                setFilterType('ALL');
                setNeighborhoodOnly(false);
              }}
              title="Reset layout and orientation"
            >
              <RotateCcw size={13} />
              <span>{layoutDirection === 'LR' ? 'Vertical' : 'Horizontal'}</span>
            </button>

            {(highlightNodes.length > 0 || selectedNodeId !== null) && (
              <button className="btn-canvas-tool btn-clear-focus" onClick={onClearHighlight}>
                <GitBranch size={13} />
                <span>Clear Focus</span>
              </button>
            )}
          </div>
        </div>

        {/* Floating category filter chips */}
        {showFilters && (
          <div className="canvas-filter-chips">
            {['ALL', 'PROJECT', 'TASK', 'PERSON', 'DECISION', 'DOCUMENT', 'TEAM'].map((type) => (
              <button
                key={type}
                className={`category-pill ${filterType === type ? 'is-active' : ''}`}
                onClick={() => setFilterType(type)}
              >
                {type === 'ALL' ? 'All' : `${type[0] + type.slice(1).toLowerCase()}s`}
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!hasGraphData && (
          <div className="graph-empty-state">
            <FolderGit2 size={40} className="graph-empty-icon" />
            <h3>No graph data yet</h3>
            <p>
              The graph will appear here once data loads. Check your FalkorDB connection in Settings,
              or re-seed the demo dataset from the sidebar.
            </p>
          </div>
        )}

        {/* Compact Node Inspector (right-side, keeps you on the canvas) */}
        <NodeInspector
          nodeId={selectedNodeId}
          nodes={rawNodes}
          edges={rawEdges}
          evidence={evidence}
          onClose={() => onSelectNode(null)}
          onSelectNode={onSelectNode}
          onAskAboutNode={onAskAboutNode}
          onOpenFlashcard={onOpenFlashcard}
          neighborhoodOnly={neighborhoodOnly}
          onToggleNeighborhood={() => setNeighborhoodOnly((v) => !v)}
        />

        {/* Category legend */}
        <div className="canvas-legend">
          {LEGEND_ITEMS.map((item) => (
            <span key={item.label} className="legend-item">
              <span className="legend-dot" style={{ background: item.color }} />
              {item.label}
            </span>
          ))}
        </div>

        {/* React Flow Canvas */}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          minZoom={0.25}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
          onEdgeMouseLeave={() => setHoveredEdgeId(null)}
          onPaneClick={() => onSelectNode(null)}
        >
          <Background color="#1F1F1F" gap={22} size={1} />
          <Controls className="n8n-cube-controls" showInteractive={false} />
          <MiniMap
            nodeColor={(n) => {
              const label = n.data?.label;
              if (label === 'Project') return '#FFFFFF';
              if (label === 'Task') return '#DCDCDC';
              if (label === 'Person') return '#C2C2C2';
              if (label === 'Decision') return '#A8A8A8';
              if (label === 'Document') return '#949494';
              if (label === 'Team') return '#828282';
              return '#4A4A4A';
            }}
            className="n8n-cube-minimap"
            maskColor="rgba(0, 0, 0, 0.88)"
          />
        </ReactFlow>
      </main>
    </div>
  );
};

export const GraphCanvas: React.FC<GraphCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <GraphCanvasInternal {...props} />
    </ReactFlowProvider>
  );
};

export default GraphCanvas;
