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
  Search,
  RotateCcw,
  Maximize2,
  Filter,
  ArrowRightLeft,
  ArrowUpDown,
  Sparkles,
} from 'lucide-react';
import { GraphNode, GraphEdge } from '../types';
import { CustomGraphNode } from './CustomNode';

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
}

// Low-contrast default edges, clear restrained highlighted edges
const EDGE_COLORS: Record<string, string> = {
  BLOCKED_BY: '#EF4444',
  DEPENDS_ON: '#A78BFA',
  ASSIGNED_TO: '#10B981',
  WAITING_FOR: '#F59E0B',
  HAS_TASK: '#38BDF8',
  REFERENCES: '#22D3EE',
  MENTIONS: '#06B6D4',
  MADE_BY: '#8B5CF6',
  OWNS: '#6366F1',
  MEMBER_OF: '#FB7185',
};

const NODE_WIDTH = 250;
const NODE_HEIGHT = 110;

/**
 * Calculates dynamic directed graph coordinates using Dagre.
 * Replaces hardcoded positioning with proper rank & order hierarchy.
 */
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
    nodesep: 45,
    ranksep: 85,
    marginx: 40,
    marginy: 40,
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
}) => {
  const { fitView } = useReactFlow();
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [layoutDirection, setLayoutDirection] = useState<'LR' | 'TB'>('LR');

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

  // Dynamic Dagre Layout + Flow Nodes & Edges Generation
  const { flowNodes, flowEdges } = useMemo(() => {
    // 1. Filter nodes by category and search
    const filteredRawNodes = rawNodes.filter((n) => {
      if (filterType !== 'ALL' && n.label.toUpperCase() !== filterType) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const title = (n.properties.name || n.properties.title || n.id).toLowerCase();
        return title.includes(q);
      }
      return true;
    });

    const visibleNodeIds = new Set(filteredRawNodes.map((n) => n.id));
    const isHighlightActive =
      highlightNodes.length > 0 || (selectedNodeId !== null && neighborhood.nodeIds.size > 0);

    // 2. Compute dynamic layout using Dagre
    const positions = calculateDagreLayout(filteredRawNodes, rawEdges, layoutDirection);

    // 3. Generate React Flow nodes
    const generatedNodes: Node[] = filteredRawNodes.map((n) => {
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
          onSelect: onSelectNode,
        },
      };
    });

    // 4. Generate React Flow edges
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
        const strokeColor = isHighlighted || isHovered ? baseColor : 'rgba(148, 163, 184, 0.22)';
        const strokeWidth = isHighlighted || isHovered ? 2.4 : 1.2;

        // Show label if highlighted, hovered, or a critical blocker edge
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
            fill: isHighlighted ? '#FFFFFF' : '#94A3B8',
            fontSize: 9.5,
            fontWeight: 600,
            fontFamily: 'monospace',
          },
          labelBgStyle: {
            fill: '#0E131F',
            fillOpacity: 0.94,
            stroke: isHighlighted ? baseColor : 'rgba(255, 255, 255, 0.1)',
            strokeWidth: 1,
          },
          labelBgPadding: [5, 3] as [number, number],
          labelBgBorderRadius: 4,
        };
      });

    return { flowNodes: generatedNodes, flowEdges: generatedEdges };
  }, [
    rawNodes,
    rawEdges,
    highlightNodes,
    highlightEdges,
    selectedNodeId,
    neighborhood,
    filterType,
    searchQuery,
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

  // Auto-fit on project change, direction change, or initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ padding: 0.18, duration: 400 });
    }, 80);
    return () => clearTimeout(timer);
  }, [selectedProject, layoutDirection, fitView]);

  return (
    <div className="graph-wrapper">
      {/* Floating Toolbar with Filters & Layout Direction */}
      <div className="graph-toolbar">
        {/* Category Filters */}
        <div className="toolbar-section">
          <span className="toolbar-label">
            <Filter size={12} />
            <span>Filter</span>
          </span>
          <div className="filter-pill-group">
            {['ALL', 'PROJECT', 'TASK', 'DECISION', 'PERSON', 'DOCUMENT'].map((type) => (
              <button
                key={type}
                className={`filter-pill ${filterType === type ? 'is-active' : ''}`}
                onClick={() => setFilterType(type)}
              >
                {type === 'ALL' ? 'All' : `${type[0] + type.slice(1).toLowerCase()}s`}
              </button>
            ))}
          </div>
        </div>

        {/* Layout Orientation & Search */}
        <div className="toolbar-section">
          <button
            className="btn-toolbar"
            onClick={() => setLayoutDirection((prev) => (prev === 'LR' ? 'TB' : 'LR'))}
            title={`Switch to ${layoutDirection === 'LR' ? 'Top-to-Bottom' : 'Left-to-Right'} layout`}
          >
            {layoutDirection === 'LR' ? <ArrowUpDown size={12} /> : <ArrowRightLeft size={12} />}
            <span>{layoutDirection === 'LR' ? 'Vertical Layout' : 'Horizontal Flow'}</span>
          </button>

          <div className="graph-search-box">
            <Search size={13} className="text-muted" />
            <input
              type="text"
              placeholder="Find node in graph..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="graph-search-input"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="search-clear-btn">
                ×
              </button>
            )}
          </div>

          {(highlightNodes.length > 0 || selectedNodeId !== null) && (
            <button
              className="btn-toolbar btn-highlight-active"
              onClick={onClearHighlight}
              title="Reset path and selection highlights"
            >
              <RotateCcw size={12} />
              <span>Clear Focus</span>
            </button>
          )}

          <button
            className="btn-toolbar"
            onClick={() => fitView({ padding: 0.18, duration: 400 })}
            title="Fit graph to canvas"
          >
            <Maximize2 size={12} />
            <span>Fit View</span>
          </button>
        </div>
      </div>

      {/* React Flow Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.15}
        maxZoom={1.8}
        proOptions={{ hideAttribution: true }}
        onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
        onEdgeMouseLeave={() => setHoveredEdgeId(null)}
      >
        <Background color="#1A2234" gap={28} size={1} />
        <Controls className="graph-controls" showInteractive={false} />
        <MiniMap
          nodeColor={(n) => {
            const label = n.data?.label;
            if (label === 'Project') return '#38BDF8';
            if (label === 'Task') return '#F59E0B';
            if (label === 'Person') return '#10B981';
            if (label === 'Decision') return '#8B5CF6';
            if (label === 'Document') return '#06B6D4';
            return '#64748B';
          }}
          className="graph-minimap"
          maskColor="rgba(6, 8, 15, 0.75)"
        />
      </ReactFlow>

      {/* Legend */}
      <div className="graph-bottom-legend">
        <div className="legend-chip">
          <span className="legend-dot" style={{ background: '#38BDF8' }} />
          <span>Project</span>
        </div>
        <div className="legend-chip">
          <span className="legend-dot" style={{ background: '#F59E0B' }} />
          <span>Task</span>
        </div>
        <div className="legend-chip">
          <span className="legend-dot" style={{ background: '#8B5CF6' }} />
          <span>Decision</span>
        </div>
        <div className="legend-chip">
          <span className="legend-dot" style={{ background: '#06B6D4' }} />
          <span>Document</span>
        </div>
        <div className="legend-chip">
          <span className="legend-dot" style={{ background: '#10B981' }} />
          <span>Person</span>
        </div>
        <div className="legend-chip legend-separator">
          <span style={{ color: '#EF4444', fontWeight: 700 }}>╌╌</span>
          <span>BLOCKED_BY</span>
        </div>
      </div>
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
