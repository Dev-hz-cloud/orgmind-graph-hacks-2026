import React, { useState, useMemo } from 'react';
import {
  Search,
  FolderGit2,
  Clock,
  User,
  Users,
  FileText,
  Scale,
  Network,
  ExternalLink,
} from 'lucide-react';
import { GraphNode, NodeLabel } from '../types';

interface DirectoryIndexProps {
  nodes: GraphNode[];
  selectedNodeId: string | null;
  /** Open the full details flashcard for an entity */
  onOpenDetails: (nodeId: string) => void;
  /** Switch to the Graph workspace and focus/highlight this entity */
  onInspectInGraph: (nodeId: string) => void;
}

const LABEL_ICONS: Record<NodeLabel, React.FC<{ size: number; color?: string }>> = {
  Project: FolderGit2,
  Task: Clock,
  Person: User,
  Decision: Scale,
  Document: FileText,
  Team: Users,
};

const FILTERS: Array<{ key: string; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'PROJECT', label: 'Projects' },
  { key: 'TASK', label: 'Tasks' },
  { key: 'PERSON', label: 'People' },
  { key: 'DECISION', label: 'Decisions' },
  { key: 'DOCUMENT', label: 'Documents' },
  { key: 'TEAM', label: 'Teams' },
];

export const DirectoryIndex: React.FC<DirectoryIndexProps> = ({
  nodes,
  selectedNodeId,
  onOpenDetails,
  onInspectInGraph,
}) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      if (filterType !== 'ALL' && n.label.toUpperCase() !== filterType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const title = (n.properties.name || n.properties.title || n.id).toLowerCase();
        const desc = (n.properties.summary || n.properties.description || '').toLowerCase();
        return title.includes(q) || desc.includes(q) || n.id.toLowerCase().includes(q);
      }
      return true;
    });
  }, [nodes, filterType, searchQuery]);

  return (
    <aside className="booklet-directory-panel db-directory-panel">
      <div className="directory-header">
        <div className="directory-title-row">
          <Search size={16} className="text-pink" />
          <h3 className="directory-title">Directory Index</h3>
          <span className="directory-count">
            {filteredNodes.length}/{nodes.length}
          </span>
        </div>
        <p className="directory-subtitle">
          Read-only browse of loaded graph records. Use a card's actions to open details or locate
          it in the Graph.
        </p>

        <div className="directory-search-box">
          <Search size={13} className="text-muted" />
          <input
            type="text"
            placeholder="Search entities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="directory-search-input"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="search-clear" title="Clear search">
              ×
            </button>
          )}
        </div>

        <div className="directory-categories-row">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`category-pill ${filterType === f.key ? 'is-active' : ''}`}
              onClick={() => setFilterType(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="directory-cards-list">
        {filteredNodes.length === 0 && (
          <div className="directory-empty-state">
            {nodes.length === 0
              ? 'No graph data loaded yet.'
              : 'No entities match your search or filter.'}
          </div>
        )}

        {filteredNodes.map((n) => {
          const isSelected = selectedNodeId === n.id;
          const Icon = LABEL_ICONS[n.label] || FolderGit2;
          const title = n.properties.name || n.properties.title || n.id;
          const status = n.properties.status;
          const delay = n.properties.delay_days;
          const isBlocked = status === 'BLOCKED' || status === 'DELAYED';

          return (
            <div
              key={n.id}
              className={`directory-item-card ${isSelected ? 'is-selected' : ''}`}
              onClick={() => onOpenDetails(n.id)}
              title={`Open details for ${title}`}
            >
              <div className="item-card-left">
                <div className="item-card-icon">
                  <Icon size={13} />
                </div>
                <div className="item-card-text">
                  <span className="item-card-title" title={title}>
                    {title}
                  </span>
                  <span className="item-card-meta">
                    {n.label}
                    {status ? ` · ${status}` : ''}
                    {n.properties.role ? ` · ${n.properties.role}` : ''}
                  </span>
                </div>
              </div>

              <div className="item-card-right">
                {isBlocked && (
                  <span className="item-card-delay">{delay ? `${delay}d` : 'Blocked'}</span>
                )}
                <button
                  className="btn-locate-graph"
                  onClick={(e) => {
                    e.stopPropagation();
                    onInspectInGraph(n.id);
                  }}
                  title="Locate this entity in the Graph workspace"
                >
                  <Network size={12} />
                </button>
                <button
                  className="btn-locate-graph"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDetails(n.id);
                  }}
                  title="Open full details card"
                >
                  <ExternalLink size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};

export default DirectoryIndex;
