import React, { useMemo, useCallback, useEffect } from 'react';
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
} from '@xyflow/react';
import {
  Search,
  RotateCcw,
  Maximize2,
  Filter
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
}

const EDGE_STYLES: Record<string, { stroke: string; strokeDasharray?: string; strokeWidth: number }> = {
  BLOCKED_BY: { stroke: '#EF4444', strokeDasharray: '5,5', strokeWidth: 2.5 },
  DEPENDS_ON: { stroke: '#A78BFA', strokeWidth: 2 },
  ASSIGNED_TO: { stroke: '#10B981', strokeWidth: 1.8 },
  WAITING_FOR: { stroke: '#F59E0B', strokeDasharray: '4,4', strokeWidth: 2 },
  HAS_TASK: { stroke: '#38BDF8', strokeWidth: 2 },
  REFERENCES: { stroke: '#22D3EE', strokeWidth: 1.8 },
  MENTIONS: { stroke: '#06B6D4', strokeWidth: 1.8 },
  MADE_BY: { stroke: '#8B5CF6', strokeWidth: 1.8 },
  OWNS: { stroke: '#6366F1', strokeWidth: 2 },
  MEMBER_OF: { stroke: '#FB7185', strokeWidth: 1.5 },
};

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  nodes: rawNodes,
  edges: rawEdges,
  highlightNodes,
  highlightEdges,
  selectedNodeId,
  onSelectNode,
  onClearHighlight,
}) => {
  const [filterType, setFilterType] = React.useState<string>('ALL');
  const [searchQuery, setSearchQuery] = React.useState<string>('');

  // Hierarchical auto-layout generator
  const initialNodesAndEdges = useMemo(() => {
    // Group nodes by label for intelligent positioning
    const projectNodes = rawNodes.filter((n) => n.label === 'Project');
    const taskNodes = rawNodes.filter((n) => n.label === 'Task');
    const decisionNodes = rawNodes.filter((n) => n.label === 'Decision');
    const personNodes = rawNodes.filter((n) => n.label === 'Person');
    const docNodes = rawNodes.filter((n) => n.label === 'Document');
    const teamNodes = rawNodes.filter((n) => n.label === 'Team');

    const positions: Record<string, { x: number; y: number }> = {};

    // Column 1: Projects (x: 40)
    projectNodes.forEach((p, idx) => {
      positions[p.id] = { x: 50, y: 100 + idx * 280 };
    });

    // Column 2: Teams (x: 50, top)
    teamNodes.forEach((t, idx) => {
      positions[t.id] = { x: 50, y: 650 + idx * 160 };
    });

    // Column 3: Tasks (x: 420)
    taskNodes.forEach((t, idx) => {
      positions[t.id] = { x: 420, y: 60 + idx * 150 };
    });

    // Column 4: Decisions & Blockers (x: 820)
    decisionNodes.forEach((d, idx) => {
      positions[d.id] = { x: 820, y: 100 + idx * 240 };
    });

    // Column 5: People (x: 1220)
    personNodes.forEach((p, idx) => {
      positions[p.id] = { x: 1220, y: 60 + idx * 150 };
    });

    // Column 6: Documents (x: 820, below decisions)
    docNodes.forEach((doc, idx) => {
      positions[doc.id] = { x: 820, y: 560 + idx * 160 };
    });

    const isHighlightActive = highlightNodes.length > 0;

    // Filter nodes
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

    const flowNodes: Node[] = filteredRawNodes.map((n) => {
      const pos = positions[n.id] || { x: 300, y: 300 };
      const isHighlighted = highlightNodes.includes(n.id) || selectedNodeId === n.id;
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
          isDimmed,
          onSelect: onSelectNode,
        },
      };
    });

    const flowEdges: Edge[] = rawEdges
      .filter((e) => visibleNodeIds.has(e.src) && visibleNodeIds.has(e.dst))
      .map((e) => {
        const styleConfig = EDGE_STYLES[e.rel] || { stroke: '#64748B', strokeWidth: 1.5 };
        const isHighlighted =
          highlightEdges.includes(e.id) ||
          (highlightNodes.includes(e.src) && highlightNodes.includes(e.dst));
        const isDimmed = isHighlightActive && !isHighlighted;

        return {
          id: e.id,
          source: e.src,
          target: e.dst,
          label: e.rel,
          animated: isHighlighted || e.rel === 'BLOCKED_BY',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isHighlighted ? '#6366F1' : styleConfig.stroke,
            width: 14,
            height: 14,
          },
          style: {
            stroke: isHighlighted ? '#6366F1' : styleConfig.stroke,
            strokeWidth: isHighlighted ? 3 : styleConfig.strokeWidth,
            strokeDasharray: styleConfig.strokeDasharray,
            opacity: isDimmed ? 0.2 : 0.9,
          },
          labelStyle: {
            fill: isHighlighted ? '#A5B4FC' : '#94A3B8',
            fontSize: 10,
            fontWeight: 600,
            fontFamily: 'monospace',
          },
          labelBgStyle: {
            fill: '#0B0F19',
            fillOpacity: 0.85,
          },
          labelBgPadding: [4, 2] as [number, number],
          labelBgBorderRadius: 4,
        };
      });

    return { flowNodes, flowEdges };
  }, [rawNodes, rawEdges, highlightNodes, highlightEdges, selectedNodeId, filterType, searchQuery, onSelectNode]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodesAndEdges.flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialNodesAndEdges.flowEdges);

  // Sync state when dependencies change
  useEffect(() => {
    setNodes(initialNodesAndEdges.flowNodes);
    setEdges(initialNodesAndEdges.flowEdges);
  }, [initialNodesAndEdges, setNodes, setEdges]);

  return (
    <main className="graph-panel">
      {/* Floating Toolbar */}
      <div className="graph-overlay-toolbar">
        {/* Filter by Category */}
        <div className="toolbar-group">
          <Filter size={13} color="var(--accent-indigo)" />
          {['ALL', 'PROJECT', 'TASK', 'PERSON', 'DECISION', 'DOCUMENT'].map((type) => (
            <button
              key={type}
              className={`graph-filter-btn ${filterType === type ? 'active' : ''}`}
              onClick={() => setFilterType(type)}
            >
              {type === 'ALL' ? 'All Entities' : `${type[0] + type.slice(1).toLowerCase()}s`}
            </button>
          ))}
        </div>

        {/* Search & Actions */}
        <div className="toolbar-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 6 }}>
            <Search size={13} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search graph node..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '0.75rem',
                outline: 'none',
                width: 140,
              }}
            />
          </div>

          {(highlightNodes.length > 0 || selectedNodeId) && (
            <button
              className="btn-secondary"
              style={{ padding: '3px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 4 }}
              onClick={onClearHighlight}
            >
              <RotateCcw size={12} /> Clear Highlight
            </button>
          )}
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
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={1.8}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1A2234" gap={24} size={1} />
        <Controls
          style={{
            background: 'rgba(11, 15, 25, 0.85)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            overflow: 'hidden',
          }}
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
          style={{
            background: 'rgba(11, 15, 25, 0.9)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
          }}
          maskColor="rgba(6, 8, 15, 0.7)"
        />
      </ReactFlow>

      {/* Bottom Compact Legend */}
      <div className="graph-legend">
        <div className="legend-item">
          <span className="legend-color" style={{ background: '#38BDF8' }} />
          <span>Project</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ background: '#F59E0B' }} />
          <span>Task</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ background: '#10B981' }} />
          <span>Person</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ background: '#8B5CF6' }} />
          <span>Decision</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ background: '#06B6D4' }} />
          <span>Document</span>
        </div>
        <div className="legend-item" style={{ marginLeft: 8, borderLeft: '1px solid var(--border-medium)', paddingLeft: 8 }}>
          <span style={{ color: '#EF4444', fontWeight: 600 }}>---</span>
          <span>BLOCKED_BY</span>
        </div>
      </div>
    </main>
  );
};
