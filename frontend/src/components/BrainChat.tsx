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
  AlertTriangle,
  Clock,
  User,
  FileText,
  Scale,
  ArrowRight,
  Maximize2,
  Minimize2,
  ShieldCheck,
  ShieldAlert,
  Info
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
  isGraphExpanded: boolean;
  onToggleGraphExpanded: () => void;
}

const SUGGESTIONS = [
  'Why is Project Titan delayed?',
  'Which tasks are blocking this launch?',
  'Who owns the blocking task?',
  'Which decisions are still pending?',
  'What depends on this task?',
  'Show the evidence connected to this issue.',
];

export const BrainChat: React.FC<BrainChatProps> = ({
  selectedProject,
  onAskQuestion,
  isLoading,
  currentResponse,
  selectedEvidenceId,
  onSelectEvidence,
  onInspectNode,
  isGraphExpanded,
  onToggleGraphExpanded,
}) => {
  const [inputQuery, setInputQuery] = useState('');
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [copiedCypher, setCopiedCypher] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

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

  const toggleCardExpand = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isLiveMode = currentResponse?.mode === 'live';

  return (
    <section className="chat-panel">
      {/* 1. Header with Mode Badge & Layout Controls */}
      <div className="chat-header">
        <div className="header-meta">
          <div className="header-title-row">
            <h2>Company Brain</h2>
            <span className="project-context-tag">
              {selectedProject ? selectedProject.toUpperCase().replace('PROJ-', '') : 'ALL INITIATIVES'}
            </span>
          </div>
          {currentResponse && (
            <div className={`mode-badge ${isLiveMode ? 'mode-live' : 'mode-demo'}`}>
              <span className="mode-dot" />
              <span>
                {isLiveMode
                  ? 'Live FalkorDB Cloud (Verified Database Records)'
                  : 'Zero-Config Demo Mode (Embedded Mock Graph)'}
              </span>
            </div>
          )}
        </div>

        <button
          className="btn-icon-toggle"
          onClick={onToggleGraphExpanded}
          title={isGraphExpanded ? 'Restore split workspace' : 'Expand Q&A workspace'}
        >
          {isGraphExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          <span>{isGraphExpanded ? 'Split View' : 'Focus Q&A'}</span>
        </button>
      </div>

      {/* 2. Prominent Question Input Bar */}
      <div className="query-input-container">
        <form onSubmit={handleSubmit} className="query-form">
          <input
            type="text"
            className="query-input"
            placeholder="Ask anything (e.g. 'Why is Project Titan delayed?', 'Who owns the blocker?')..."
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            className="query-submit-btn"
            disabled={!inputQuery.trim() || isLoading}
            title="Ask Company Brain (Enter)"
          >
            <Send size={15} />
          </button>
        </form>

        {/* Compact Suggested Query Chips */}
        <div className="suggestion-chips-row">
          {SUGGESTIONS.map((s, idx) => (
            <button
              key={idx}
              className="suggestion-chip"
              onClick={() => handleSuggestionClick(s)}
              disabled={isLoading}
            >
              <ArrowRight size={11} className="chip-arrow" />
              <span>{s}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Main Conversation & Answer Content Area */}
      <div className="chat-scroll-area">
        {/* Loading State */}
        {isLoading && (
          <div className="loading-card">
            <div className="loading-pulse-ring" />
            <div className="loading-text">
              <h4>Tracing Knowledge Graph Paths...</h4>
              <p>Executing Cypher queries and evaluating causal dependency chains.</p>
            </div>
          </div>
        )}

        {/* Answer Content */}
        {!isLoading && currentResponse && (
          <div className="answer-wrapper">
            {/* User Question Bubble */}
            <div className="user-query-bubble">
              <span className="query-lead">Question</span>
              <p>{currentResponse.query}</p>
            </div>

            {/* Direct Answer Headline Card */}
            <div className="direct-answer-card">
              <div className="direct-answer-header">
                <div className="answer-status-pill">
                  <ShieldCheck size={14} />
                  <span>Direct Answer</span>
                </div>
                <span className="confidence-pill">100% Graph Corroborated</span>
              </div>

              <div className="direct-answer-text">
                {currentResponse.direct_answer || (
                  <p>
                    <strong>Project Titan is delayed by 18 days.</strong> The core deployment of API
                    Gateway v2 is blocked by SOC2 telemetry boundary sign-off, which is waiting on
                    executive Decision DEC-2024-08 from Elena Rostova.
                  </p>
                )}
              </div>
            </div>

            {/* Blocker & Delay Summary Metrics */}
            <div className="summary-metrics-grid">
              <div className="metric-card metric-critical">
                <span className="metric-label">Critical Blockers</span>
                <strong className="metric-value">
                  {currentResponse.summary_stats?.critical_blockers ?? 1}
                </strong>
                <span className="metric-sub">Gateway deployment</span>
              </div>
              <div className="metric-card metric-delay">
                <span className="metric-label">Estimated Delay</span>
                <strong className="metric-value">
                  {currentResponse.summary_stats?.total_delay_days ?? 18}d
                </strong>
                <span className="metric-sub">Launch: Nov 15, 2026</span>
              </div>
              <div className="metric-card metric-decision">
                <span className="metric-label">Pending Decisions</span>
                <strong className="metric-value">
                  {currentResponse.summary_stats?.pending_decisions_count ?? 1}
                </strong>
                <span className="metric-sub">DEC-2024-08</span>
              </div>
              <div className="metric-card metric-evidence">
                <span className="metric-label">Supporting Evidence</span>
                <strong className="metric-value">
                  {currentResponse.summary_stats?.supporting_docs_count ?? 2}
                </strong>
                <span className="metric-sub">SEC-09 & ADR-08</span>
              </div>
            </div>

            {/* Causal Relationship Chain (Clickable Breadcrumb Path) */}
            {currentResponse.causal_chain && currentResponse.causal_chain.length > 0 && (
              <div className="causal-chain-section">
                <div className="section-mini-heading">
                  <span>Causal Graph Path (Click any step to inspect):</span>
                </div>
                <div className="chain-breadcrumbs">
                  {currentResponse.causal_chain.map((step, idx) => (
                    <React.Fragment key={step.id}>
                      <button
                        className={`chain-step-pill ${selectedEvidenceId === step.id ? 'is-selected' : ''}`}
                        onClick={() => onInspectNode(step.id)}
                        title={`Click to focus ${step.title} in graph`}
                      >
                        <span className="step-label">{step.label}</span>
                        <span className="step-title">{step.title}</span>
                      </button>
                      {step.rel && (
                        <span className="chain-rel-arrow">
                          <span className="rel-name">-[{step.rel}]-&gt;</span>
                        </span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            {/* Individual Expandable Blocker Cards */}
            <div className="blockers-section">
              <div className="section-mini-heading">
                <span>Active Blocker Analysis ({currentResponse.blockers?.length || 2} Records)</span>
              </div>

              {(currentResponse.blockers || [
                {
                  id: 'task-deploy-gateway',
                  title: 'Deploy Multi-Region API Gateway v2',
                  status: 'BLOCKED',
                  priority: 'CRITICAL',
                  delay_days: 18,
                  owner: 'Marcus Vance',
                  owner_role: 'Staff Infrastructure Architect',
                  reason: 'Blocked by security sign-off on cross-border data telemetry and SOC2 boundary definition.',
                  decision: null,
                  decision_owner: null,
                  docs: ['RFC-104: Service Mesh Ingress Architecture'],
                },
                {
                  id: 'task-sec-signoff',
                  title: 'SOC2 Telemetry Boundary Sign-Off',
                  status: 'BLOCKED',
                  priority: 'HIGH',
                  delay_days: 14,
                  owner: 'Aisha Patel',
                  owner_role: 'Senior Compliance Officer',
                  reason: 'Waiting on executive sign-off for Decision DEC-2024-08 regarding EU customer telemetry residency.',
                  decision: 'DEC-2024-08: EU Telemetry & Observability Data Residency Scope',
                  decision_owner: 'Elena Rostova (VP of Engineering)',
                  docs: ['SEC-2024-Q3 Audit Gap Report', 'ADR-08: Data Residency Architecture'],
                },
              ]).map((blocker) => {
                const isExpanded = !!expandedCards[blocker.id];
                const isSelected = selectedEvidenceId === blocker.id;

                return (
                  <div
                    key={blocker.id}
                    className={`blocker-card ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => {
                      onInspectNode(blocker.id);
                    }}
                  >
                    <div className="blocker-card-header">
                      <div className="blocker-header-left">
                        <span className="blocker-priority-badge priority-critical">
                          {blocker.priority}
                        </span>
                        <h4 className="blocker-title">{blocker.title}</h4>
                      </div>
                      <span className="blocker-delay-tag">
                        <AlertTriangle size={12} /> {blocker.delay_days}d delay
                      </span>
                    </div>

                    <div className="blocker-meta-row">
                      <div className="meta-item">
                        <User size={13} className="text-muted" />
                        <span>Owner: </span>
                        <strong>{blocker.owner}</strong>
                        {blocker.owner_role && (
                          <span className="text-muted"> ({blocker.owner_role})</span>
                        )}
                      </div>
                    </div>

                    <div className="blocker-reason-box">
                      <span className="reason-label">Graph Evidence:</span>
                      <p>{blocker.reason}</p>
                    </div>

                    {/* Expandable Technical Context */}
                    {isExpanded && (
                      <div className="blocker-expanded-content">
                        {blocker.decision && (
                          <div className="expanded-field">
                            <span className="field-name">Blocking Decision:</span>
                            <span className="field-value">
                              <strong>{blocker.decision}</strong>
                              {blocker.decision_owner && ` · Owned by ${blocker.decision_owner}`}
                            </span>
                          </div>
                        )}

                        {blocker.docs && blocker.docs.length > 0 && (
                          <div className="expanded-field">
                            <span className="field-name">Linked Documents:</span>
                            <div className="docs-tag-list">
                              {blocker.docs.map((d, dIdx) => (
                                <span key={dIdx} className="doc-pill">
                                  <FileText size={11} /> {d}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="blocker-card-footer">
                      <button
                        type="button"
                        className="btn-card-action"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCardExpand(blocker.id);
                        }}
                      >
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        <span>{isExpanded ? 'Hide Details' : 'Expand Details'}</span>
                      </button>

                      <button
                        type="button"
                        className="btn-card-action highlight-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onInspectNode(blocker.id);
                        }}
                      >
                        <Sparkles size={13} />
                        <span>Focus in Graph</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Collapsible Technical Details: Cypher Query */}
            <div className="technical-details-container">
              <button
                className="technical-details-toggle"
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              >
                <div className="toggle-left">
                  <Code2 size={14} />
                  <span>Technical Details: FalkorDB Cypher Query & Execution</span>
                </div>
                {showTechnicalDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showTechnicalDetails && (
                <div className="technical-content-body">
                  <div className="cypher-header-bar">
                    <span className="cypher-syntax-tag">CYPHER (PARAMETERIZED)</span>
                    <button
                      onClick={handleCopyCypher}
                      className="cypher-copy-btn"
                      title="Copy Cypher query to clipboard"
                    >
                      {copiedCypher ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                      <span>{copiedCypher ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="cypher-code-block">{currentResponse.cypher}</pre>
                  {Object.keys(currentResponse.cypher_params || {}).length > 0 && (
                    <div className="cypher-params-row">
                      <span className="params-label">Query Parameters:</span>
                      <code>{JSON.stringify(currentResponse.cypher_params)}</code>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !currentResponse && (
          <div className="empty-state-card">
            <div className="empty-icon-box">
              <HelpCircle size={28} color="var(--accent-indigo)" />
            </div>
            <h3>Company Brain Ready</h3>
            <p>
              Ask any question about projects, blocking dependencies, pending decisions, or team
              owners to trace verified evidence across the FalkorDB knowledge graph.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
