import React, { useState, useMemo } from 'react';
import {
  Database,
  Plus,
  Search,
  Edit2,
  Trash2,
  ExternalLink,
  FolderGit2,
  Clock,
  User,
  Users,
  Scale,
  FileText,
  Check,
  X,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { GraphNode, NodeLabel } from '../types';

interface DatabaseViewProps {
  nodes: GraphNode[];
  onUpdateNode: (updatedNode: GraphNode) => void;
  onAddNode: (newNode: GraphNode) => void;
  onDeleteNode: (nodeId: string) => void;
  onOpenFlashcard: (nodeId: string) => void;
}

const CATEGORY_TABS: Array<{ label: NodeLabel; title: string; icon: React.FC<{ size: number; color?: string }> }> = [
  { label: 'Project', title: 'Projects', icon: FolderGit2 },
  { label: 'Team', title: 'Teams', icon: Users },
  { label: 'Person', title: 'People', icon: User },
  { label: 'Task', title: 'Tasks', icon: Clock },
  { label: 'Decision', title: 'Decisions', icon: Scale },
  { label: 'Document', title: 'Documents', icon: FileText },
];

export const DatabaseView: React.FC<DatabaseViewProps> = ({
  nodes,
  onUpdateNode,
  onAddNode,
  onDeleteNode,
  onOpenFlashcard,
}) => {
  const [activeCategory, setActiveCategory] = useState<NodeLabel>('Project');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Edit State
  const [editingNode, setEditingNode] = useState<GraphNode | null>(null);
  const [editFormData, setEditFormData] = useState<Record<string, any>>({});

  // Session feedback banner (client-side changes only — not persisted to FalkorDB)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    window.setTimeout(() => setFeedback(null), 3500);
  };

  // Add Record State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newRecordLabel, setNewRecordLabel] = useState<NodeLabel>('Task');
  const [newRecordData, setNewRecordData] = useState({
    title: '',
    status: 'ON_TRACK',
    delay_days: 0,
    role: '',
    team: '',
    priority: 'HIGH',
    summary: '',
  });

  // Filtered nodes for the active category
  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      if (n.label !== activeCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const title = (n.properties.name || n.properties.title || n.id).toLowerCase();
        const desc = (n.properties.description || n.properties.summary || n.properties.role || '').toLowerCase();
        return title.includes(q) || desc.includes(q) || n.id.toLowerCase().includes(q);
      }
      return true;
    });
  }, [nodes, activeCategory, searchQuery]);

  // Handle Edit Click
  const handleStartEdit = (node: GraphNode) => {
    setEditingNode(node);
    setEditFormData({ ...node.properties });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNode) return;

    const title = (editFormData.name || editFormData.title || '').trim();
    if (!title) {
      showFeedback('error', 'Title / Name cannot be empty.');
      return;
    }
    if (Number(editFormData.delay_days) < 0 || Number.isNaN(Number(editFormData.delay_days))) {
      showFeedback('error', 'Delay days must be zero or a positive number.');
      return;
    }

    const updatedNode: GraphNode = {
      ...editingNode,
      properties: {
        ...editingNode.properties,
        ...editFormData,
        name: title,
        title,
      },
    };

    onUpdateNode(updatedNode);
    setEditingNode(null);
    showFeedback('success', `Updated “${title}” (session only — not written to FalkorDB).`);
  };

  // Handle Add Record
  const handleCreateRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecordData.title.trim()) {
      showFeedback('error', 'Name / Title is required to create a record.');
      return;
    }
    if (Number(newRecordData.delay_days) < 0 || Number.isNaN(Number(newRecordData.delay_days))) {
      showFeedback('error', 'Delay days must be zero or a positive number.');
      return;
    }

    const title = newRecordData.title.trim();
    const prefix = newRecordLabel.toLowerCase();
    const newId = `${prefix}-${Date.now().toString().slice(-5)}`;

    const properties: Record<string, any> = {
      id: newId,
      name: title,
      title,
      status: newRecordData.status,
      delay_days: Number(newRecordData.delay_days) || 0,
    };

    if (newRecordLabel === 'Person') {
      properties.role = newRecordData.role || 'Engineer';
      properties.team = newRecordData.team || 'Platform Architecture';
    } else if (newRecordLabel === 'Task') {
      properties.priority = newRecordData.priority;
      properties.blocker_reason = newRecordData.summary;
    } else if (newRecordLabel === 'Decision' || newRecordLabel === 'Document') {
      properties.summary = newRecordData.summary;
    }

    const newNode: GraphNode = {
      id: newId,
      label: newRecordLabel,
      properties,
    };

    onAddNode(newNode);
    setIsAddModalOpen(false);
    showFeedback(
      'success',
      `Created ${newRecordLabel} “${title}” (session only — not written to FalkorDB).`
    );
    setNewRecordData({
      title: '',
      status: 'ON_TRACK',
      delay_days: 0,
      role: '',
      team: '',
      priority: 'HIGH',
      summary: '',
    });
  };

  return (
    <div className="database-gui-container">
      {/* Session feedback banner */}
      {feedback && (
        <div className={`db-feedback-banner ${feedback.type}`} role="status">
          {feedback.message}
        </div>
      )}
      {/* 1. Database Header */}
      <header className="database-header">
        <div className="header-info">
          <div className="title-row">
            <Database size={18} className="text-pink" />
            <h2 className="title-text">Company Knowledge Database</h2>
            <span className="total-badge">{nodes.length} records</span>
          </div>
          <p className="subtitle-text">
            Simple GUI to browse, search, and edit live graph records across all organizational entities.
          </p>
        </div>

        <div className="header-actions">
          <div className="db-search-box">
            <Search size={14} className="text-muted" />
            <input
              type="text"
              placeholder={`Search ${activeCategory.toLowerCase()}s...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="db-search-input"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="search-clear-btn">
                ×
              </button>
            )}
          </div>

          <button className="btn-add-record" onClick={() => setIsAddModalOpen(true)}>
            <Plus size={15} />
            <span>Add Record</span>
          </button>
        </div>
      </header>

      {/* 2. Category Tabs */}
      <div className="db-category-tabs-bar">
        {CATEGORY_TABS.map((cat) => {
          const Icon = cat.icon;
          const count = nodes.filter((n) => n.label === cat.label).length;
          const isActive = activeCategory === cat.label;

          return (
            <button
              key={cat.label}
              className={`db-category-tab ${isActive ? 'is-active' : ''}`}
              onClick={() => setActiveCategory(cat.label)}
            >
              <Icon size={14} />
              <span>{cat.title}</span>
              <span className="cat-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Human-Readable Database Table / Cards */}
      <div className="db-table-scroll-area">
        <table className="db-records-table">
          <thead>
            <tr>
              <th>ID & Name</th>
              <th>Status</th>
              {activeCategory === 'Task' && <th>Priority</th>}
              {activeCategory === 'Task' && <th>Delay Impact</th>}
              {activeCategory === 'Person' && <th>Role & Department</th>}
              {activeCategory === 'Project' && <th>Progress & Target</th>}
              {activeCategory === 'Decision' && <th>Owner & Impact</th>}
              {activeCategory === 'Document' && <th>Document Type</th>}
              <th>Summary / Details</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredNodes.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center empty-cell">
                  No {activeCategory.toLowerCase()} records match your filter.
                </td>
              </tr>
            ) : (
              filteredNodes.map((node) => {
                const props = node.properties || {};
                const title = props.name || props.title || node.id;
                const status = props.status;
                const delay = props.delay_days;
                const isBlocked = status === 'BLOCKED' || status === 'DELAYED';

                return (
                  <tr key={node.id} className="db-record-row">
                    {/* ID & Name */}
                    <td>
                      <div className="name-cell">
                        <strong className="record-title">{title}</strong>
                        <span className="record-id-mono">{node.id}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td>
                      {status ? (
                        <span
                          className={`db-status-pill ${
                            isBlocked ? 'status-red' : status === 'APPROVED' || status === 'ON_TRACK' ? 'status-green' : 'status-yellow'
                          }`}
                        >
                          {status}
                        </span>
                      ) : (
                        <span className="text-dim">—</span>
                      )}
                    </td>

                    {/* Task Priority & Delay */}
                    {activeCategory === 'Task' && (
                      <td>
                        <span className="priority-tag">{props.priority || 'MEDIUM'}</span>
                      </td>
                    )}
                    {activeCategory === 'Task' && (
                      <td>
                        {delay ? <span className="delay-text">{delay} days</span> : <span className="text-green">0d</span>}
                      </td>
                    )}

                    {/* Person Role */}
                    {activeCategory === 'Person' && (
                      <td>
                        <span className="role-text">{props.role || 'Team Member'}</span>
                        {props.team && <span className="team-sub"> · {props.team}</span>}
                      </td>
                    )}

                    {/* Project Progress */}
                    {activeCategory === 'Project' && (
                      <td>
                        <span>{props.progress || 0}% complete</span>
                        <span className="text-dim"> (Due {props.target_date || 'Q4'})</span>
                      </td>
                    )}

                    {/* Decision Impact */}
                    {activeCategory === 'Decision' && (
                      <td>
                        <span className="impact-text">{props.impact || 'Architecture Governance'}</span>
                      </td>
                    )}

                    {/* Document Type */}
                    {activeCategory === 'Document' && (
                      <td>
                        <span className="doc-type-pill">{props.type || 'Specification'}</span>
                      </td>
                    )}

                    {/* Summary / Reason */}
                    <td>
                      <p className="summary-cell-text">
                        {props.blocker_reason || props.summary || props.description || props.email || '—'}
                      </p>
                    </td>

                    {/* Actions */}
                    <td className="text-right">
                      <div className="actions-cell">
                        <button
                          className="btn-db-action edit"
                          onClick={() => handleStartEdit(node)}
                          title="Edit this record"
                        >
                          <Edit2 size={13} />
                          <span>Edit</span>
                        </button>
                        <button
                          className="btn-db-action card"
                          onClick={() => onOpenFlashcard(node.id)}
                          title="Open detailed flashcard"
                        >
                          <ExternalLink size={13} />
                          <span>Card</span>
                        </button>
                        <button
                          className="btn-db-action delete"
                          onClick={() => {
                            if (window.confirm(`Delete record "${title}" (${node.id})? This only affects the current session.`)) {
                              onDeleteNode(node.id);
                              showFeedback('success', `Deleted “${title}” (session only — graph refreshed).`);
                            }
                          }}
                          title="Delete record"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Edit Record Modal */}
      {editingNode && (
        <div className="db-modal-overlay" onClick={() => setEditingNode(null)}>
          <div className="db-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top">
              <div className="modal-title-wrap">
                <Edit2 size={16} className="text-pink" />
                <h3>Edit {editingNode.label}: {editingNode.properties.name || editingNode.id}</h3>
              </div>
              <button className="btn-close-modal" onClick={() => setEditingNode(null)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="db-edit-form">
              <div className="form-fields-grid">
                <div className="form-field">
                  <label>Title / Name</label>
                  <input
                    type="text"
                    value={editFormData.name || editFormData.title || ''}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        name: e.target.value,
                        title: e.target.value,
                      })
                    }
                    className="db-form-input"
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Status</label>
                  <select
                    value={editFormData.status || 'ON_TRACK'}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    className="db-form-input"
                  >
                    <option value="ON_TRACK">ON_TRACK</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="BLOCKED">BLOCKED</option>
                    <option value="DELAYED">DELAYED</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="PENDING">PENDING</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>Delay Days (Impact)</label>
                  <input
                    type="number"
                    value={editFormData.delay_days || 0}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, delay_days: Number(e.target.value) })
                    }
                    className="db-form-input"
                  />
                </div>

                {editingNode.label === 'Person' && (
                  <>
                    <div className="form-field">
                      <label>Job Role</label>
                      <input
                        type="text"
                        value={editFormData.role || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                        className="db-form-input"
                      />
                    </div>
                    <div className="form-field">
                      <label>Department / Team</label>
                      <input
                        type="text"
                        value={editFormData.team || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, team: e.target.value })}
                        className="db-form-input"
                      />
                    </div>
                  </>
                )}

                {editingNode.label === 'Task' && (
                  <div className="form-field">
                    <label>Priority</label>
                    <select
                      value={editFormData.priority || 'HIGH'}
                      onChange={(e) => setEditFormData({ ...editFormData, priority: e.target.value })}
                      className="db-form-input"
                    >
                      <option value="CRITICAL">CRITICAL</option>
                      <option value="HIGH">HIGH</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="LOW">LOW</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="form-field full-width">
                <label>Summary / Blocker Context</label>
                <textarea
                  rows={3}
                  value={
                    editFormData.blocker_reason ||
                    editFormData.summary ||
                    editFormData.description ||
                    ''
                  }
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      blocker_reason: e.target.value,
                      summary: e.target.value,
                      description: e.target.value,
                    })
                  }
                  className="db-form-input"
                />
              </div>

              <div className="modal-actions-row">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setEditingNode(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-save">
                  <Check size={14} />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Add Record Modal */}
      {isAddModalOpen && (
        <div className="db-modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="db-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top">
              <div className="modal-title-wrap">
                <Plus size={16} className="text-pink" />
                <h3>Create New Record</h3>
              </div>
              <button className="btn-close-modal" onClick={() => setIsAddModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateRecord} className="db-edit-form">
              <div className="form-fields-grid">
                <div className="form-field">
                  <label>Record Type</label>
                  <select
                    value={newRecordLabel}
                    onChange={(e) => setNewRecordLabel(e.target.value as NodeLabel)}
                    className="db-form-input"
                  >
                    <option value="Project">Project</option>
                    <option value="Task">Task</option>
                    <option value="Person">Person</option>
                    <option value="Decision">Decision</option>
                    <option value="Document">Document</option>
                    <option value="Team">Team</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>Name / Title</label>
                  <input
                    type="text"
                    value={newRecordData.title}
                    onChange={(e) => setNewRecordData({ ...newRecordData, title: e.target.value })}
                    placeholder="e.g. Deploy Edge Gateway"
                    className="db-form-input"
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Status</label>
                  <select
                    value={newRecordData.status}
                    onChange={(e) => setNewRecordData({ ...newRecordData, status: e.target.value })}
                    className="db-form-input"
                  >
                    <option value="ON_TRACK">ON_TRACK</option>
                    <option value="BLOCKED">BLOCKED</option>
                    <option value="DELAYED">DELAYED</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="PENDING">PENDING</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>Delay Days</label>
                  <input
                    type="number"
                    value={newRecordData.delay_days}
                    onChange={(e) =>
                      setNewRecordData({ ...newRecordData, delay_days: Number(e.target.value) })
                    }
                    className="db-form-input"
                  />
                </div>

                {newRecordLabel === 'Person' && (
                  <>
                    <div className="form-field">
                      <label>Job Role</label>
                      <input
                        type="text"
                        value={newRecordData.role}
                        onChange={(e) => setNewRecordData({ ...newRecordData, role: e.target.value })}
                        placeholder="e.g. Staff Security Architect"
                        className="db-form-input"
                      />
                    </div>
                    <div className="form-field">
                      <label>Department / Team</label>
                      <input
                        type="text"
                        value={newRecordData.team}
                        onChange={(e) => setNewRecordData({ ...newRecordData, team: e.target.value })}
                        placeholder="e.g. Infrastructure Security"
                        className="db-form-input"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="form-field full-width">
                <label>Description / Blocker Summary</label>
                <textarea
                  rows={3}
                  value={newRecordData.summary}
                  onChange={(e) => setNewRecordData({ ...newRecordData, summary: e.target.value })}
                  placeholder="Explain context, requirements, or dependencies..."
                  className="db-form-input"
                />
              </div>

              <div className="modal-actions-row">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-save">
                  <Plus size={14} />
                  <span>Create Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseView;
