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
  Loader2
} from 'lucide-react';
import { GraphNode, NodeLabel } from '../types';
import type { RecordMutationResult } from '../services/api';

interface DatabaseViewProps {
  nodes: GraphNode[];
  writable: boolean;
  writesDisabledReason?: string | null;
  onCreateRecord: (label: NodeLabel, properties: Record<string, any>) => Promise<RecordMutationResult>;
  onUpdateRecord: (nodeId: string, label: NodeLabel, properties: Record<string, any>) => Promise<RecordMutationResult>;
  onDeleteRecord: (nodeId: string) => Promise<RecordMutationResult>;
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

interface RecordFormState {
  name: string;
  status: string;
  delay_days: number;
  role: string;
  team: string;
  department: string;
  lead_name: string;
  priority: string;
  summary: string;
  type: string;
  url: string;
  progress: number;
  target_date: string;
  impact: string;
  rationale: string;
}

const EMPTY_FORM: RecordFormState = {
  name: '',
  status: 'ON_TRACK',
  delay_days: 0,
  role: '',
  team: '',
  department: '',
  lead_name: '',
  priority: 'HIGH',
  summary: '',
  type: '',
  url: '',
  progress: 0,
  target_date: '',
  impact: '',
  rationale: '',
};

function formFromNode(node: GraphNode): RecordFormState {
  const p = node.properties || {};
  return {
    ...EMPTY_FORM,
    name: p.name || p.title || '',
    status: p.status || 'ON_TRACK',
    delay_days: Number(p.delay_days) || 0,
    role: p.role || '',
    team: p.team || '',
    department: p.department || '',
    lead_name: p.lead_name || '',
    priority: p.priority || 'HIGH',
    summary: p.blocker_reason || p.summary || p.description || '',
    type: p.type || '',
    url: p.url || '',
    progress: Number(p.progress) || 0,
    target_date: p.target_date || '',
    impact: p.impact || '',
    rationale: p.rationale || '',
  };
}

/**
 * Build the exact allowlisted property payload the backend accepts for a label.
 * Anything not listed here is rejected by the server-side schema, so we only
 * ever send fields that belong to the selected record type.
 */
function buildProperties(label: NodeLabel, form: RecordFormState): Record<string, any> {
  const title = form.name.trim();
  const props: Record<string, any> = { name: title, title };
  if (form.status) props.status = form.status;

  switch (label) {
    case 'Project':
      props.delay_days = Number(form.delay_days) || 0;
      props.progress = Number(form.progress) || 0;
      if (form.target_date.trim()) props.target_date = form.target_date.trim();
      if (form.summary.trim()) props.description = form.summary.trim();
      break;
    case 'Task':
      props.delay_days = Number(form.delay_days) || 0;
      props.priority = form.priority;
      if (form.summary.trim()) props.blocker_reason = form.summary.trim();
      break;
    case 'Person':
      if (form.role.trim()) props.role = form.role.trim();
      if (form.team.trim()) props.team = form.team.trim();
      break;
    case 'Team':
      if (form.department.trim()) props.department = form.department.trim();
      if (form.lead_name.trim()) props.lead_name = form.lead_name.trim();
      if (form.summary.trim()) props.description = form.summary.trim();
      break;
    case 'Decision':
      if (form.summary.trim()) props.summary = form.summary.trim();
      if (form.impact.trim()) props.impact = form.impact.trim();
      if (form.rationale.trim()) props.rationale = form.rationale.trim();
      break;
    case 'Document':
      if (form.summary.trim()) props.summary = form.summary.trim();
      if (form.type.trim()) props.type = form.type.trim();
      if (form.url.trim()) props.url = form.url.trim();
      break;
  }
  return props;
}

export const DatabaseView: React.FC<DatabaseViewProps> = ({
  nodes,
  writable,
  writesDisabledReason,
  onCreateRecord,
  onUpdateRecord,
  onDeleteRecord,
  onOpenFlashcard,
}) => {
  const [activeCategory, setActiveCategory] = useState<NodeLabel>('Project');
  const [searchQuery, setSearchQuery] = useState('');

  // Edit State
  const [editingNode, setEditingNode] = useState<GraphNode | null>(null);
  const [editFormData, setEditFormData] = useState<RecordFormState>({ ...EMPTY_FORM });

  // Add Record State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newRecordLabel, setNewRecordLabel] = useState<NodeLabel>('Task');
  const [newRecordData, setNewRecordData] = useState<RecordFormState>({ ...EMPTY_FORM });

  // Feedback + in-flight state
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [busyNodeId, setBusyNodeId] = useState<string | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    window.setTimeout(() => setFeedback(null), 4500);
  };

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

  const validateForm = (form: RecordFormState): string | null => {
    if (!form.name.trim()) return 'Title / Name cannot be empty.';
    if (Number(form.delay_days) < 0 || Number.isNaN(Number(form.delay_days))) {
      return 'Delay days must be zero or a positive number.';
    }
    return null;
  };

  // Handle Edit Click
  const handleStartEdit = (node: GraphNode) => {
    setEditingNode(node);
    setEditFormData(formFromNode(node));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNode || isSaving) return;

    const invalid = validateForm(editFormData);
    if (invalid) {
      showFeedback('error', invalid);
      return;
    }

    setIsSaving(true);
    try {
      const result = await onUpdateRecord(
        editingNode.id,
        editingNode.label,
        buildProperties(editingNode.label, editFormData)
      );
      if (result.success) {
        setEditingNode(null);
        showFeedback('success', `Saved “${editFormData.name.trim()}” to the database.`);
      } else {
        showFeedback('error', result.error || 'The database did not confirm the update.');
      }
    } catch (err: any) {
      showFeedback('error', err?.message || 'The database did not confirm the update.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Add Record
  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const invalid = validateForm(newRecordData);
    if (invalid) {
      showFeedback('error', invalid);
      return;
    }

    setIsSaving(true);
    try {
      const result = await onCreateRecord(
        newRecordLabel,
        buildProperties(newRecordLabel, newRecordData)
      );
      if (result.success) {
        setIsAddModalOpen(false);
        showFeedback('success', `Created ${newRecordLabel} “${newRecordData.name.trim()}” in the database.`);
        setNewRecordData({ ...EMPTY_FORM });
      } else {
        showFeedback('error', result.error || 'The database did not confirm the new record.');
      }
    } catch (err: any) {
      showFeedback('error', err?.message || 'The database did not confirm the new record.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (node: GraphNode) => {
    const title = node.properties.name || node.properties.title || node.id;
    if (!window.confirm(`Delete record "${title}" (${node.id}) from the database? This also removes its relationships.`)) {
      return;
    }
    setBusyNodeId(node.id);
    try {
      const result = await onDeleteRecord(node.id);
      if (result.success) {
        showFeedback('success', `Deleted “${title}” from the database.`);
      } else {
        showFeedback('error', result.error || 'The database did not confirm the deletion.');
      }
    } catch (err: any) {
      showFeedback('error', err?.message || 'The database did not confirm the deletion.');
    } finally {
      setBusyNodeId(null);
    }
  };

  const writeBlocked = !writable;

  return (
    <div className="database-gui-container">
      {/* Feedback banner — only shown after a confirmed or failed database write */}
      {feedback && (
        <div className={`db-feedback-banner ${feedback.type}`} role="status">
          {feedback.message}
        </div>
      )}
      {/* 1. Database Header */}
      <header className="database-header">
        <div className="header-info">
          <div className="title-row">
            <Database size={18} className="text-strong" />
            <h2 className="title-text">Company Knowledge Database</h2>
            <span className="total-badge">{nodes.length} records</span>
          </div>
          <p className="subtitle-text">
            Browse, search, and edit live graph records. Writes go to the connected FalkorDB graph.
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

          <button
            className="btn-add-record"
            onClick={() => setIsAddModalOpen(true)}
            disabled={writeBlocked}
            title={writeBlocked ? writesDisabledReason || 'Writes are disabled' : 'Add a record'}
          >
            <Plus size={15} />
            <span>Add Record</span>
          </button>
        </div>
      </header>

      {/* Write-disabled notice (demo mode or disconnected) */}
      {writeBlocked && (
        <div className="db-client-only-notice">
          <AlertTriangle size={13} />
          <span>
            {writesDisabledReason ||
              'Record writes are disabled because the database is not connected. Connect to a live FalkorDB graph to add, edit, or delete records.'}
          </span>
        </div>
      )}

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
                const isBusy = busyNodeId === node.id;

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
                        <span className="text-dim"> (Due {props.target_date || 'n/a'})</span>
                      </td>
                    )}

                    {/* Decision Impact */}
                    {activeCategory === 'Decision' && (
                      <td>
                        <span className="impact-text">{props.impact || 'No impact recorded'}</span>
                      </td>
                    )}

                    {/* Document Type */}
                    {activeCategory === 'Document' && (
                      <td>
                        <span className="doc-type-pill">{props.type || 'Document'}</span>
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
                          disabled={writeBlocked}
                          title={writeBlocked ? writesDisabledReason || 'Writes are disabled' : 'Edit this record'}
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
                          onClick={() => handleDelete(node)}
                          disabled={writeBlocked || isBusy}
                          title={writeBlocked ? writesDisabledReason || 'Writes are disabled' : 'Delete record'}
                        >
                          {isBusy ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />}
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
        <div className="db-modal-overlay" onClick={() => !isSaving && setEditingNode(null)}>
          <div className="db-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top">
              <div className="modal-title-wrap">
                <Edit2 size={16} className="text-strong" />
                <h3>Edit {editingNode.label}: {editingNode.properties.name || editingNode.id}</h3>
              </div>
              <button className="btn-close-modal" onClick={() => setEditingNode(null)} disabled={isSaving}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="db-edit-form">
              <RecordFields label={editingNode.label} form={editFormData} onChange={setEditFormData} />

              <div className="modal-actions-row">
                <button type="button" className="btn-cancel" onClick={() => setEditingNode(null)} disabled={isSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn-save" disabled={isSaving}>
                  {isSaving ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                  <span>{isSaving ? 'Saving…' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Add Record Modal */}
      {isAddModalOpen && (
        <div className="db-modal-overlay" onClick={() => !isSaving && setIsAddModalOpen(false)}>
          <div className="db-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top">
              <div className="modal-title-wrap">
                <Plus size={16} className="text-strong" />
                <h3>Create New Record</h3>
              </div>
              <button className="btn-close-modal" onClick={() => setIsAddModalOpen(false)} disabled={isSaving}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateRecord} className="db-edit-form">
              <div className="form-fields-grid">
                <div className="form-field">
                  <label>Record Type</label>
                  <select
                    value={newRecordLabel}
                    onChange={(e) => {
                      setNewRecordLabel(e.target.value as NodeLabel);
                      setNewRecordData({ ...EMPTY_FORM });
                    }}
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
              </div>

              <RecordFields label={newRecordLabel} form={newRecordData} onChange={setNewRecordData} />

              <div className="modal-actions-row">
                <button type="button" className="btn-cancel" onClick={() => setIsAddModalOpen(false)} disabled={isSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn-save" disabled={isSaving}>
                  {isSaving ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
                  <span>{isSaving ? 'Creating…' : 'Create Record'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

interface RecordFieldsProps {
  label: NodeLabel;
  form: RecordFormState;
  onChange: (form: RecordFormState) => void;
}

const RecordFields: React.FC<RecordFieldsProps> = ({ label, form, onChange }) => {
  const set = (patch: Partial<RecordFormState>) => onChange({ ...form, ...patch });

  return (
    <>
      <div className="form-fields-grid">
        <div className="form-field">
          <label>Title / Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            className="db-form-input"
            required
          />
        </div>

        <div className="form-field">
          <label>Status</label>
          <select
            value={form.status}
            onChange={(e) => set({ status: e.target.value })}
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

        {(label === 'Task' || label === 'Project') && (
          <div className="form-field">
            <label>Delay Days (Impact)</label>
            <input
              type="number"
              value={form.delay_days}
              onChange={(e) => set({ delay_days: Number(e.target.value) })}
              className="db-form-input"
            />
          </div>
        )}

        {label === 'Project' && (
          <>
            <div className="form-field">
              <label>Progress (%)</label>
              <input
                type="number"
                value={form.progress}
                onChange={(e) => set({ progress: Number(e.target.value) })}
                className="db-form-input"
              />
            </div>
            <div className="form-field">
              <label>Target Date</label>
              <input
                type="text"
                value={form.target_date}
                onChange={(e) => set({ target_date: e.target.value })}
                placeholder="e.g. 2026-11-15"
                className="db-form-input"
              />
            </div>
          </>
        )}

        {label === 'Person' && (
          <>
            <div className="form-field">
              <label>Job Role</label>
              <input
                type="text"
                value={form.role}
                onChange={(e) => set({ role: e.target.value })}
                className="db-form-input"
              />
            </div>
            <div className="form-field">
              <label>Department / Team</label>
              <input
                type="text"
                value={form.team}
                onChange={(e) => set({ team: e.target.value })}
                className="db-form-input"
              />
            </div>
          </>
        )}

        {label === 'Team' && (
          <>
            <div className="form-field">
              <label>Department</label>
              <input
                type="text"
                value={form.department}
                onChange={(e) => set({ department: e.target.value })}
                className="db-form-input"
              />
            </div>
            <div className="form-field">
              <label>Lead Name</label>
              <input
                type="text"
                value={form.lead_name}
                onChange={(e) => set({ lead_name: e.target.value })}
                className="db-form-input"
              />
            </div>
          </>
        )}

        {label === 'Task' && (
          <div className="form-field">
            <label>Priority</label>
            <select
              value={form.priority}
              onChange={(e) => set({ priority: e.target.value })}
              className="db-form-input"
            >
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>
        )}

        {label === 'Document' && (
          <>
            <div className="form-field">
              <label>Document Type</label>
              <input
                type="text"
                value={form.type}
                onChange={(e) => set({ type: e.target.value })}
                placeholder="e.g. ADR, RFC, Policy"
                className="db-form-input"
              />
            </div>
            <div className="form-field">
              <label>URL</label>
              <input
                type="text"
                value={form.url}
                onChange={(e) => set({ url: e.target.value })}
                className="db-form-input"
              />
            </div>
          </>
        )}

        {label === 'Decision' && (
          <>
            <div className="form-field">
              <label>Impact</label>
              <input
                type="text"
                value={form.impact}
                onChange={(e) => set({ impact: e.target.value })}
                className="db-form-input"
              />
            </div>
            <div className="form-field">
              <label>Rationale</label>
              <input
                type="text"
                value={form.rationale}
                onChange={(e) => set({ rationale: e.target.value })}
                className="db-form-input"
              />
            </div>
          </>
        )}
      </div>

      <div className="form-field full-width">
        <label>
          {label === 'Task'
            ? 'Blocker Context'
            : label === 'Project'
            ? 'Description'
            : 'Summary / Details'}
        </label>
        <textarea
          rows={3}
          value={form.summary}
          onChange={(e) => set({ summary: e.target.value })}
          className="db-form-input"
        />
      </div>
    </>
  );
};

export default DatabaseView;
