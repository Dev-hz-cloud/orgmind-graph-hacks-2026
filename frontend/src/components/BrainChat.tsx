import React, { useState } from 'react';
import {
  Send,
  Sparkles,
  HelpCircle,
  Code2,
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  Layers,
  ArrowRight
} from 'lucide-react';
import { QuestionResponse, EvidenceItem } from '../types';

interface BrainChatProps {
  selectedProject: string | null;
  onAskQuestion: (query: string) => Promise<void>;
  isLoading: boolean;
  currentResponse: QuestionResponse | null;
  selectedEvidenceId: string | null;
  onSelectEvidence: (item: EvidenceItem) => void;
  onInspectNode: (nodeId: string) => void;
}

const SUGGESTIONS = [
  'Why is Project Titan delayed?',
  'Which tasks are blocking this launch?',
  'Who owns the blocking task?',
  'Which decisions are still pending?',
  'What depends on this task?',
  'Show the evidence connected to this issue.',
];

const LABEL_BADGE_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  Project: { bg: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', border: 'rgba(56, 189, 248, 0.3)' },
  Task: { bg: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', border: 'rgba(245, 158, 11, 0.3)' },
  Person: { bg: 'rgba(52, 211, 153, 0.15)', color: '#34D399', border: 'rgba(52, 211, 153, 0.3)' },
  Decision: { bg: 'rgba(167, 139, 250, 0.15)', color: '#A78BFA', border: 'rgba(167, 139, 250, 0.3)' },
  Document: { bg: 'rgba(34, 211, 238, 0.15)', color: '#22D3EE', border: 'rgba(34, 211, 238, 0.3)' },
  Team: { bg: 'rgba(251, 113, 133, 0.15)', color: '#FB7185', border: 'rgba(251, 113, 133, 0.3)' },
};

export const BrainChat: React.FC<BrainChatProps> = ({
  selectedProject,
  onAskQuestion,
  isLoading,
  currentResponse,
  selectedEvidenceId,
  onSelectEvidence,
  onInspectNode,
}) => {
  const [inputQuery, setInputQuery] = useState('');
  const [showCypher, setShowCypher] = useState(false);
  const [copiedCypher, setCopiedCypher] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || isLoading) return;
    onAskQuestion(inputQuery);
  };

  const handleSuggestionClick = (query: string) => {
    setInputQuery(query);
    onAskQuestion(query);
  };

  const handleCopyCypher = () => {
    if (currentResponse?.cypher) {
      navigator.clipboard.writeText(currentResponse.cypher);
      setCopiedCypher(true);
      setTimeout(() => setCopiedCypher(false), 2000);
    }
  };

  const renderMarkdownFormatted = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('### ')) {
        return <h3 key={idx} style={{ marginTop: 12, marginBottom: 6, color: '#FFFFFF', fontSize: '1.02rem', fontWeight: 600 }}>{line.replace('### ', '')}</h3>;
      }
      if (line.startsWith('> ')) {
        return (
          <blockquote key={idx}>
            {line.replace('> ', '')}
          </blockquote>
        );
      }
      if (line.startsWith('- ')) {
        const content = line.replace('- ', '');
        return (
          <li key={idx} style={{ marginBottom: 5 }}>
            <span dangerouslySetInnerHTML={{ __html: formatInline(content) }} />
          </li>
        );
      }
      if (line.match(/^\d+\.\s/)) {
        return (
          <div key={idx} style={{ marginBottom: 6, paddingLeft: 12, borderLeft: '2px solid rgba(99, 102, 241, 0.3)' }}>
            <span dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
          </div>
        );
      }
      if (!line.trim()) {
        return <div key={idx} style={{ height: 8 }} />;
      }
      return (
        <p key={idx} style={{ marginBottom: 8 }} dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
      );
    });
  };

  const formatInline = (str: string) => {
    return str
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background: rgba(255,255,255,0.08); padding: 2px 5px; border-radius: 4px; font-family: monospace; font-size: 0.8em; color: #A5B4FC;">$1</code>');
  };

  return (
    <section className="center-panel">
      {/* Panel Header */}
      <div className="panel-header">
        <div className="header-title-block">
          <h2>Company Brain Q&A</h2>
          <span>
            {selectedProject ? `Context: ${selectedProject}` : 'All projects context'} · Evidence-First Reasoning
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <Sparkles size={14} color="var(--accent-indigo)" />
          <span>FalkorDB Graph Engine</span>
        </div>
      </div>

      {/* Chat / Answer Feed */}
      <div className="chat-history">
        {/* Suggested Queries */}
        <div>
          <div className="section-label" style={{ paddingLeft: 0, marginBottom: 8 }}>
            <span>Verified Graph Queries</span>
            <HelpCircle size={13} />
          </div>
          <div className="prompt-suggestions">
            {SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                className="prompt-pill"
                onClick={() => handleSuggestionClick(s)}
                disabled={isLoading}
              >
                <ArrowRight size={12} color="var(--accent-indigo)" />
                <span>{s}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div
            style={{
              padding: 24,
              background: 'var(--bg-surface-2)',
              borderRadius: 12,
              border: '1px solid rgba(99, 102, 241, 0.3)',
              textAlign: 'center',
              boxShadow: 'var(--glow-indigo)',
            }}
          >
            <div style={{ display: 'inline-flex', padding: 12, borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)', marginBottom: 12 }}>
              <Layers size={24} className="animate-spin" color="var(--accent-indigo)" />
            </div>
            <h4 style={{ fontSize: '0.9rem', color: '#FFFFFF', marginBottom: 4 }}>
              Querying FalkorDB Knowledge Graph...
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Executing parameterized Cypher traversal and resolving evidence chains.
            </p>
          </div>
        )}

        {/* Answer Output */}
        {!isLoading && currentResponse && (
          <div className="answer-container">
            <div className="answer-header">
              <span className="answer-badge">
                <FileCheck2 size={14} /> Evidence-Backed Answer ({currentResponse.mode.toUpperCase()})
              </span>
              <button
                className="btn-secondary"
                style={{ padding: '3px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 4 }}
                onClick={() => setShowCypher(!showCypher)}
              >
                <Code2 size={12} />
                <span>{showCypher ? 'Hide Cypher' : 'View Cypher Query'}</span>
                {showCypher ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>

            {/* Collapsible Cypher Query Display */}
            {showCypher && (
              <div className="cypher-box">
                <div className="cypher-header">
                  <span>CYPHER QUERY (FALKORDB)</span>
                  <button
                    onClick={handleCopyCypher}
                    style={{ background: 'transparent', border: 'none', color: '#A5B4FC', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem' }}
                  >
                    {copiedCypher ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                    {copiedCypher ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="cypher-content">{currentResponse.cypher}</div>
              </div>
            )}

            {/* Answer Body */}
            <div className="answer-body" style={{ marginTop: 12 }}>
              {renderMarkdownFormatted(currentResponse.answer)}
            </div>

            {/* Evidence Cards */}
            {currentResponse.evidence.length > 0 && (
              <div className="evidence-section">
                <div className="evidence-title">
                  <span>Supporting Records & Graph Nodes ({currentResponse.evidence.length})</span>
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                  Click an evidence record to highlight its exact path in the graph canvas:
                </p>
                <div>
                  {currentResponse.evidence.map((ev) => {
                    const badge = LABEL_BADGE_STYLES[ev.label] || LABEL_BADGE_STYLES.Project;
                    const isSelected = selectedEvidenceId === ev.entity_id;
                    return (
                      <div
                        key={ev.id}
                        className={`evidence-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => onSelectEvidence(ev)}
                      >
                        <div className="evidence-card-header">
                          <span
                            className="evidence-label-badge"
                            style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}
                          >
                            {ev.label}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onInspectNode(ev.entity_id);
                            }}
                            style={{ background: 'transparent', border: 'none', color: 'var(--accent-indigo)', fontSize: '0.7rem', cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            Inspect Properties
                          </button>
                        </div>
                        <div className="evidence-card-title">{ev.title}</div>
                        <div className="evidence-card-summary">{ev.summary}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Query Input Bar */}
      <form className="chat-input-bar" onSubmit={handleSubmit}>
        <div className="input-wrapper">
          <input
            type="text"
            className="chat-input"
            placeholder="Ask anything (e.g. 'Why is Project Titan delayed?')..."
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            disabled={isLoading}
          />
          <button type="submit" className="send-button" disabled={!inputQuery.trim() || isLoading}>
            <Send size={15} />
          </button>
        </div>
      </form>
    </section>
  );
};
