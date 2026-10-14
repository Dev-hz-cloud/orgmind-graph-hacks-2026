import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  ArrowRight,
  FolderGit2,
  Clock,
  User,
  Users,
  FileText,
  Scale,
  Sparkles,
  ExternalLink,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Network
} from 'lucide-react';
import { GraphNode, GraphEdge, NodeLabel } from '../types';

interface ExploreViewProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onSelectEntityInInvestigate: (entityId: string, projectId?: string) => void;
  onAskAboutEntity: (entityTitle: string) => void;
}

const LABEL_ICONS: Record<NodeLabel, React.FC<{ size: number; color?: string }>> = {
  Project: FolderGit2,
  Task: Clock,
  Person: User,
  Decision: Scale,
  Document: FileText,
  Team: Users,
};

const LABEL_COLORS: Record<NodeLabel, string> = {
  Project: '#FFFFFF',
  Task: '#DCDCDC',
  Person: '#C2C2C2',
  Decision: '#A8A8A8',
  Document: '#949494',
  Team: '#828282',
};

export const ExploreView: React.FC<ExploreViewProps> = ({
  nodes,
  edges,
  onSelectEntityInInvestigate,
  onAskAboutEntity,
}) => {
  const [selectedLabel, setSelectedLabel] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeEntityId, setActiveEntityId] = useState<string | null>(
    nodes.length > 0 ? nodes[0].id : null
  );

  // Filtered nodes
  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      if (selectedLabel !== 'ALL' && n.label.toUpperCase() !== selectedLabel) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const title = (n.properties.name || n.properties.title || n.id).toLowerCase();
        const desc = (n.properties.description || n.properties.summary || '').toLowerCase();
        return title.includes(q) || desc.includes(q) || n.id.toLowerCase().includes(q);
      }
      return true;
    });
  }, [nodes, selectedLabel, searchQuery]);

  // Active selected entity
  const activeEntity = useMemo(() => {
    return nodes.find((n) => n.id === activeEntityId) || filteredNodes[0] || null;
  }, [nodes, activeEntityId, filteredNodes]);

  // Connected edges & neighbors for active entity
  const { incoming, outgoing } = useMemo(() => {
    if (!activeEntity) return { incoming: [], outgoing: [] };

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    const inc = edges
      .filter((e) => e.dst === activeEntity.id)
      .map((e) => ({
        edge: e,
        sourceNode: nodeMap.get(e.src),
      }))
      .filter((item) => item.sourceNode !== undefined);

    const out = edges
      .filter((e) => e.src === activeEntity.id)
      .map((e) => ({
        edge: e,
        targetNode: nodeMap.get(e.dst),
      }))
      .filter((item) => item.targetNode !== undefined);

    return { incoming: inc, outgoing: out };
  }, [activeEntity, edges, nodes]);

  const handleInspectEntity = (id: string) => {
    setActiveEntityId(id);
  };

  const handleNavigateToInvestigate = () => {
    if (!activeEntity) return;
    const projectId =
      activeEntity.label === 'Project'
        ? activeEntity.id
        : activeEntity.properties.project_id || undefined;
    onSelectEntityInInvestigate(activeEntity.id, projectId);
  };

  return (
    <div className="explore-view-container">
      {/* Top Header */}
      <div className="explore-header">
        <div className="explore-header-info">
          <h2>Company Knowledge Catalog</h2>
          <p>
            Explore all {nodes.length} company records and {edges.length} graph relationships across
            projects, people, tasks, decisions, and documents.
          </p>
        </div>

        <div className="explore-header-actions">
          <div className="explore-search-input-wrap">
            <Search size={14} className="text-muted" />
            <input
              type="text"
              placeholder="Search across all entities, roles, or docs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="explore-search-input"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="search-clear-btn">
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Label Filter Bar */}
      <div className="explore-filter-bar">
        <span className="filter-title">
          <Filter size={13} />
          <span>Entity Type:</span>
        </span>
        <div className="explore-filter-pills">
          {['ALL', 'PROJECT', 'TASK', 'DECISION', 'DOCUMENT', 'PERSON', 'TEAM'].map((lbl) => {
            const count =
              lbl === 'ALL'
                ? nodes.length
                : nodes.filter((n) => n.label.toUpperCase() === lbl).length;

            return (
              <button
                key={lbl}
                className={`explore-pill ${selectedLabel === lbl ? 'is-active' : ''}`}
                onClick={() => setSelectedLabel(lbl)}
              >
                <span>{lbl === 'ALL' ? 'All Records' : `${lbl[0] + lbl.slice(1).toLowerCase()}s`}</span>
                <span className="pill-count">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Split Layout: Entity List & Deep Inspector */}
      <div className="explore-content-grid">
        {/* Left Column: Entity Cards List */}
        <div className="explore-list-column">
          <div className="list-column-header">
            <span>Showing {filteredNodes.length} entities</span>
          </div>

          <div className="explore-items-scroll">
            {filteredNodes.length === 0 ? (
              <div className="explore-empty-state">
                <p>No entities found matching your search.</p>
              </div>
            ) : (
              filteredNodes.map((node) => {
                const Icon = LABEL_ICONS[node.label] || FolderGit2;
                const color = LABEL_COLORS[node.label] || '#8A8A8A';
                const isSelected = activeEntity?.id === node.id;
                const title = node.properties.name || node.properties.title || node.id;
                const status = node.properties.status;
                const delay = node.properties.delay_days;

                return (
                  <div
                    key={node.id}
                    className={`explore-entity-card ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleInspectEntity(node.id)}
                  >
                    <div className="card-top-row">
                      <div className="card-type-tag" style={{ color, borderColor: `${color}40` }}>
                        <Icon size={12} />
                        <span>{node.label}</span>
                      </div>
                      {status && (
                        <span
                          className={`status-chip ${
                            status === 'BLOCKED' || status === 'DELAYED'
                              ? 'delayed'
                              : status === 'ON_TRACK' || status === 'APPROVED'
                              ? 'on_track'
                              : 'at_risk'
                          }`}
                        >
                          {status} {delay ? `(${delay}d)` : ''}
                        </span>
                      )}
                    </div>

                    <h4 className="card-title">{title}</h4>

                    <div className="card-desc">
                      {node.properties.description ||
                        node.properties.summary ||
                        node.properties.role ||
                        node.properties.blocker_reason ||
                        `ID: ${node.id}`}
                    </div>

                    <div className="card-footer-row">
                      <span className="card-id-mono">{node.id}</span>
                      <ChevronRight size={13} className="card-chevron" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Deep Relationship & Property Inspector */}
        <div className="explore-inspector-column">
          {activeEntity ? (
            <div className="deep-inspector-card">
              {/* Header */}
              <div className="deep-inspector-header">
                <div>
                  <div
                    className="deep-inspector-label"
                    style={{ color: LABEL_COLORS[activeEntity.label] }}
                  >
                    {activeEntity.label.toUpperCase()}
                  </div>
                  <h3 className="deep-inspector-title">
                    {activeEntity.properties.name ||
                      activeEntity.properties.title ||
                      activeEntity.id}
                  </h3>
                  <span className="deep-inspector-id">{activeEntity.id}</span>
                </div>

                {/* Primary Action Buttons */}
                <div className="inspector-primary-actions">
                  <button
                    className="btn-inspect-action primary"
                    onClick={handleNavigateToInvestigate}
                    title="Open in Investigation Workspace and focus on canvas"
                  >
                    <Network size={14} />
                    <span>Focus in Graph</span>
                  </button>
                  <button
                    className="btn-inspect-action secondary"
                    onClick={() =>
                      onAskAboutEntity(
                        activeEntity.properties.name ||
                          activeEntity.properties.title ||
                          activeEntity.id
                      )
                    }
                    title="Ask Company Brain about this entity"
                  >
                    <Sparkles size={14} />
                    <span>Ask Brain</span>
                  </button>
                </div>
              </div>

              <div className="deep-inspector-body">
                {/* Properties Section */}
                <div className="inspector-section">
                  <h4 className="section-title">Properties & Attributes</h4>
                  <div className="property-table">
                    {Object.entries(activeEntity.properties).map(([key, val]) => (
                      <div key={key} className="property-row">
                        <span className="property-key">{key}</span>
                        <span className="property-val">
                          {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Outgoing Relationships */}
                <div className="inspector-section">
                  <h4 className="section-title">
                    Outgoing Relationships ({outgoing.length})
                  </h4>
                  {outgoing.length === 0 ? (
                    <p className="no-rels-text">No outgoing graph edges.</p>
                  ) : (
                    <div className="rel-list">
                      {outgoing.map(({ edge, targetNode }) => {
                        const TargetIcon = targetNode
                          ? LABEL_ICONS[targetNode.label] || FolderGit2
                          : FolderGit2;
                        const targetColor = targetNode
                          ? LABEL_COLORS[targetNode.label]
                          : '#8A8A8A';

                        return (
                          <div
                            key={edge.id}
                            className="rel-card"
                            onClick={() => targetNode && handleInspectEntity(targetNode.id)}
                          >
                            <span className="rel-type-tag">-[{edge.rel}]-&gt;</span>
                            <div className="rel-target-info">
                              <span
                                className="rel-target-label"
                                style={{ color: targetColor }}
                              >
                                <TargetIcon size={11} />
                                {targetNode?.label}
                              </span>
                              <strong className="rel-target-name">
                                {targetNode?.properties.name ||
                                  targetNode?.properties.title ||
                                  edge.dst}
                              </strong>
                            </div>
                            <ArrowRight size={13} className="text-muted" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Incoming Relationships */}
                <div className="inspector-section">
                  <h4 className="section-title">
                    Incoming Relationships ({incoming.length})
                  </h4>
                  {incoming.length === 0 ? (
                    <p className="no-rels-text">No incoming graph edges.</p>
                  ) : (
                    <div className="rel-list">
                      {incoming.map(({ edge, sourceNode }) => {
                        const SourceIcon = sourceNode
                          ? LABEL_ICONS[sourceNode.label] || FolderGit2
                          : FolderGit2;
                        const sourceColor = sourceNode
                          ? LABEL_COLORS[sourceNode.label]
                          : '#8A8A8A';

                        return (
                          <div
                            key={edge.id}
                            className="rel-card"
                            onClick={() => sourceNode && handleInspectEntity(sourceNode.id)}
                          >
                            <div className="rel-target-info">
                              <span
                                className="rel-target-label"
                                style={{ color: sourceColor }}
                              >
                                <SourceIcon size={11} />
                                {sourceNode?.label}
                              </span>
                              <strong className="rel-target-name">
                                {sourceNode?.properties.name ||
                                  sourceNode?.properties.title ||
                                  edge.src}
                              </strong>
                            </div>
                            <span className="rel-type-tag">&lt;-[{edge.rel}]-</span>
                            <ArrowRight size={13} className="text-muted" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="deep-inspector-placeholder">
              <Network size={36} className="text-muted" />
              <h4>Select an entity to explore</h4>
              <p>Click on any record from the list to view its properties and connected graph edges.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExploreView;
