import React, { useMemo, useState, useEffect, useCallback } from 'react';
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
import {
  Search,
  RotateCcw,
  Maximize2,
  Filter,
  Layers,
  Sparkles,
  Eye,
  EyeOff
} from 'lucide-react';
import { GraphNode, GraphEdge, NodeLabel } from '../types';
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

  // Deterministic, structured layered layout
  const { flowNodes, flowEdges } = useMemo(() => {
    const isProjectFiltered = selectedProject !== null;

    // Semantic coordinate mapping to ensure ZERO node overlaps and clean flow
    const positions: Record<string, { x: number; y: number }> = {
      // Layer 0: Projects
      'proj-titan': { x: 50, y: 120 },
      'proj-apollo': { x: 50, y: isProjectFiltered ? 120 : 680 },
      'proj-mercury': { x: 50, y: isProjectFiltered ? 120 : 1020 },

      // Layer 1: Tasks
      'task-deploy-gateway': { x: 380, y: 80 },
      'task-kafka-sync': { x: 380, y: 280 },
      'task-perf-benchmark': { x: 380, y: 480 },
      'task-rfid-scanner': { x: 380, y: isProjectFiltered ? 120 : 680 },
      'task-carrier-webhook': { x: 380, y: isProjectFiltered ? 120 : 1020 },

      // Layer 2: Upstream Blockers & Critical Decisions
      'task-sec-signoff': { x: 730, y: 80 },
      'dec-telemetry-residency': { x: 730, y: 260 },
      'dec-gateway-mesh': { x: 730, y: 440 },
      'dec-carrier-escrow': { x: 730, y: isProjectFiltered ? 240 : 1020 },

      // Layer 3: Supporting Documents & Specifications
      'doc-sec-audit': { x: 1080, y: 80 },
      'doc-adr-08': { x: 1080, y: 260 },
      'doc-rfc-gateway': { x: 1080, y: 440 },
      'doc-carrier-sla': { x: 1080, y: isProjectFiltered ? 380 : 1020 },

      // Layer 4: People (Assignees, Owners & Decision Makers)
      'person-elena': { x: 1440, y: 120 },
      'person-aisha': { x: 1440, y: 260 },
      'person-marcus': { x: 1440, y: 400 },
      'person-sarah': { x: 1440, y: 540 },
      'person-carlos': { x: 1440, y: isProjectFiltered ? 260 : 680 },
      'person-david': { x: 1440, y: isProjectFiltered ? 260 : 1020 },

      // Layer 5: Teams
      'team-platform': { x: 1800, y: 160 },
      'team-security': { x: 1800, y: 280 },
      'team-titan': { x: 1800, y: 540 },
      'team-carrier': { x: 1800, y: isProjectFiltered ? 360 : 1020 },
    };

    // Filter nodes by category and search
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
    const isHighlightActive = highlightNodes.length > 0 || (selectedNodeId !== null && neighborhood.nodeIds.size > 0);

    const generatedNodes: Node[] = filteredRawNodes.map((n) => {
      const pos = positions[n.id] || { x: 300, y: 300 };
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
        const strokeWidth = isHighlighted || isHovered ? 2.2 : 1.2;

        // Show label only if highlighted, hovered, or a critical blocker
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
            fillOpacity: 0.92,
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
    selectedProject,
    onSelectNode,
  ]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  useEffect(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [flowNodes, flowEdges, setNodes, setEdges]);

  // Auto-fit on project change or highlight change
  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ padding: 0.22, duration: 400 });
    }, 100);
    return () => clearTimeout(timer);
  }, [selectedProject, fitView]);

  return (
    <div className="graph-wrapper">
      {/* Refined Floating Toolbar */}
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

        {/* Quick Search & Actions */}
        <div className="toolbar-section">
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
              className="btn-toolbar"
              onClick={onClearHighlight}
              title="Reset path and selection highlights"
            >
              <RotateCcw size={12} />
              <span>Clear Focus</span>
            </button>
          )}

          <button
            className="btn-toolbar"
            onClick={() => fitView({ padding: 0.22, duration: 400 })}
            title="Fit graph to view"
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
        fitViewOptions={{ padding: 0.22 }}
        minZoom={0.2}
        maxZoom={1.8}
        proOptions={{ hideAttribution: true }}
        onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
        onEdgeMouseLeave={() => setHoveredEdgeId(null)}
      >
        <Background color="#1A2234" gap={28} size={1} />
        <Controls
          className="graph-controls"
          showInteractive={false}
        />
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

      {/* Clean Bottom Legend */}
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
