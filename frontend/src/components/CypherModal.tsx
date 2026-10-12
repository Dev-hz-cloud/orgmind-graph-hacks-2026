import React, { useState } from 'react';
import {
  X,
  Terminal,
  Play,
  RotateCcw,
  Check,
  AlertCircle
} from 'lucide-react';
import { executeCypher } from '../services/api';

interface CypherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESETS = [
  { label: 'All Projects', cypher: 'MATCH (p:Project) RETURN p' },
  { label: 'Blocked Tasks', cypher: 'MATCH (t:Task {status: "BLOCKED"}) RETURN t' },
  { label: 'Pending Decisions', cypher: 'MATCH (d:Decision {status: "PENDING"}) RETURN d' },
  { label: 'Blocker Relationships', cypher: 'MATCH (a)-[r:BLOCKED_BY]->(b) RETURN a, r, b' },
  { label: 'Decisions & Documents', cypher: 'MATCH (d:Decision)-[r:REFERENCES]->(doc:Document) RETURN d, doc' },
];

export const CypherModal: React.FC<CypherModalProps> = ({ isOpen, onClose }) => {
  const [cypherQuery, setCypherQuery] = useState('MATCH (t:Task {status: "BLOCKED"}) RETURN t');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<any | null>(null);

  if (!isOpen) return null;

  // Clear stale results on close so reopening starts fresh
  const handleClose = () => {
    setResult(null);
    onClose();
  };

  const handleRun = async () => {
    setIsRunning(true);
    setResult(null);
    try {
      const res = await executeCypher(cypherQuery);
      setResult(res);
    } catch (err: any) {
      setResult({ success: false, error: err.message });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: 720 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Terminal size={20} color="var(--accent-indigo)" />
            <h3>Direct Cypher Query Explorer</h3>
          </div>
          <button className="close-btn" onClick={handleClose}>
            <X size={18} />
          </button>
        </div>

        {/* Presets */}
        <div style={{ marginBottom: 12 }}>
          <div className="section-label" style={{ paddingLeft: 0, marginBottom: 6 }}>
            <span>Preset Cypher Queries</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {PRESETS.map((p, idx) => (
              <button
                key={idx}
                className="btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                onClick={() => setCypherQuery(p.cypher)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Query Input */}
        <div className="form-group">
          <label>Cypher Statement</label>
          <textarea
            className="form-input"
            rows={4}
            value={cypherQuery}
            onChange={(e) => setCypherQuery(e.target.value)}
            style={{
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              color: '#A5B4FC',
              background: '#07090F',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Action Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem' }}
            onClick={handleRun}
            disabled={isRunning || !cypherQuery.trim()}
          >
            <Play size={13} />
            {isRunning ? 'Executing...' : 'Execute Query'}
          </button>
        </div>

        {/* Results Box */}
        {result && (
          <div>
            <div className="section-label" style={{ paddingLeft: 0, marginBottom: 6 }}>
              <span>Query Execution Output ({result.mode?.toUpperCase()} Mode)</span>
            </div>
            {result.success ? (
              <div
                style={{
                  background: '#05070A',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  padding: 12,
                  maxHeight: 280,
                  overflowY: 'auto',
                }}
              >
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                  Returned {result.row_count ?? 0} rows.
                </div>
                <pre
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    color: '#86EFAC',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {JSON.stringify(result.rows || result, null, 2)}
                </pre>
              </div>
            ) : (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#FCA5A5',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <AlertCircle size={16} />
                <span>{result.error || 'Query failed'}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
