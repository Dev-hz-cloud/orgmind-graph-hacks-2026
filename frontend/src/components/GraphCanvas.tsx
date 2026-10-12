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
}

const EDGE_COLORS: Record<string, string> = {
  BLOCKED_BY: '#EF4444',
  DEPENDS_ON: '#A855F7',
  ASSIGNED_TO: '#10B981',
  WAITING_FOR: '#F59E0B',
  HAS_TASK: '#38BDF8',
  REFERENCES: '#22D3EE',
  MENTIONS: '#EC4899',
  MADE_BY: '#8B5CF6',
  OWNS: '#6366F1',
  MEMBER_OF: '#FB7185',
};

const NODE_WIDTH = 190;
const NODE_HEIGHT = 80;

const CATEGORY_ICONS: Record<NodeLabel, React.FC<{ size: number; color?: string }>> = {
  Project: FolderGit2,
  Task: Clock,
  Person: User,
  Decision: Scale,
  Document: FileText,
  Team: Users,
};

const LEGEND_ITEMS: Array<{ label: NodeLabel; color: string }> = [
  { label: 'Project', color: '#38BDF8' },
  { label: 'Task', color: '#F59E0B' },
  { label: 'Person', color: '#EC4899' },
  { label: 'Team', color: '#FB7185' },
  { label: 'Decision', color: '#A855F7' },
  { label: 'Document', color: '#06B6D4' },
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

        const baseColor = EDGE_COLORS[e.rel] || '#94A3B8';
        const strokeColor = isHighlighted || isHovered ? baseColor : 'rgba(168, 85, 247, 0.28)';
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
            fill: isHighlighted ? '#FFFFFF' : '#CBD5E1',
            fontSize: 9,
            fontWeight: 600,
            fontFamily: 'monospace',
          },
          labelBgStyle: {
            fill: '#0F1017',
            fillOpacity: 0.95,
            stroke: isHighlighted ? baseColor : 'rgba(168, 85, 247, 0.3)',
            strokeWidth: 1,
          },
          labelBgPadding: [4, 3] as [number, number],
          labelBgBorderRadius: 4,
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
      fitView({ padding: 0.2, duration: 400 });
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
              <Sparkles size={13} className="text-purple" />
              <span>
                {selectedProject ? selectedProject.toUpperCase().replace('PROJ-', '') : 'FULL GRAPH'}
              </span>
              <span className="canvas-node-count">{directoryNodes.length} nodes</span>
            </div>
          </div>

          <div className="canvas-toolbar-right">
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
              onClick={() => fitView({ padding: 0.2, duration: 400 })}
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
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.15}
          maxZoom={1.8}
          proOptions={{ hideAttribution: true }}
          onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
          onEdgeMouseLeave={() => setHoveredEdgeId(null)}
          onPaneClick={() => onSelectNode(null)}
        >
          <Background color="#121320" gap={24} size={1.2} />
          <Controls className="n8n-cube-controls" showInteractive={false} />
          <MiniMap
            nodeColor={(n) => {
              const label = n.data?.label;
              if (label === 'Project') return '#38BDF8';
              if (label === 'Task') return '#F59E0B';
              if (label === 'Person') return '#EC4899';
              if (label === 'Decision') return '#A855F7';
              if (label === 'Document') return '#06B6D4';
              return '#64748B';
            }}
            className="n8n-cube-minimap"
            maskColor="rgba(8, 9, 14, 0.85)"
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
