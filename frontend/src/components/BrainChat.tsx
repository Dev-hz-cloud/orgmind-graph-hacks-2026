import React, { useState } from 'react';
import {
  Send,
  Zap,
  RotateCcw,
  Code2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  User,
  FileText,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  MessageSquare,
  Sparkles,
  HelpCircle
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
  onOpenGraphView: (targetNodeId?: string) => void;
  onClearHighlight: () => void;
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
  onOpenGraphView,
  onClearHighlight,
}) => {
  const [inputQuery, setInputQuery] = useState('');
  const [showCypher, setShowCypher] = useState(false);
  const [copiedCypher, setCopiedCypher] = useState(false);

  const channelName = selectedProject
    ? selectedProject.replace('proj-', '')
    : 'all-initiatives';

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

  const isLiveMode = currentResponse?.mode === 'live';

  return (
    <div className="discord-chat-workspace">
      {/* 1. Discord Channel Top Bar */}
      <div className="discord-top-bar">
        <div className="discord-channel-title-wrap">
          <span className="discord-top-hash">#</span>
          <h2 className="discord-top-channel-name">{channelName}</h2>
          <span className="discord-top-divider" />
          <span className="discord-top-topic">
            Root cause investigation & evidence tracing through FalkorDB
          </span>
        </div>

        <div className="discord-top-actions">
          {/* Prominent n8n Workflow Graph Button */}
          <button
            className="btn-discord-n8n"
            onClick={() => onOpenGraphView()}
            title="Open full interactive workflow canvas (n8n design)"
          >
            <Zap size={14} />
            <span>View Flow Graph</span>
          </button>

          <button
            className="btn-discord-action"
            onClick={onClearHighlight}
            title="Reset highlight and node selection"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* 2. Discord Message Feed */}
      <div className="discord-message-feed">
        {/* Welcome Intro Message */}
        <div className="discord-welcome-card">
          <div className="welcome-hash-circle">
            <span className="welcome-hash">#</span>
          </div>
          <h3 className="welcome-title">Welcome to #{channelName}!</h3>
          <p className="welcome-desc">
            This is the start of your OrgMind investigation channel for{' '}
            <strong>{channelName}</strong>. Ask any question below to trace real graph evidence, or
            click <strong>"View Flow Graph"</strong> above to see the n8n-style workflow canvas.
          </p>
        </div>

        {/* Loading Indicator */}
        {isLoading && (
          <div className="discord-message-row bot-row loading-row">
            <div className="discord-avatar bot-avatar">
              <Sparkles size={18} color="#FFFFFF" />
            </div>
            <div className="discord-message-content">
              <div className="discord-message-author-line">
                <span className="discord-bot-name">OrgMind</span>
                <span className="discord-bot-tag">BOT</span>
                <span className="discord-timestamp">Just now</span>
              </div>
              <div className="discord-loading-bubble">
                <span className="loading-dot" />
                <span className="loading-dot" />
                <span className="loading-dot" />
                <span className="loading-status-text">
                  Executing Cypher queries and traversing dependency paths in FalkorDB...
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Conversation Answer */}
        {!isLoading && currentResponse && (
          <>
            {/* User Message */}
            <div className="discord-message-row user-row">
              <div className="discord-avatar user-avatar">
                <span>You</span>
              </div>
              <div className="discord-message-content">
                <div className="discord-message-author-line">
                  <span className="discord-author-name">You</span>
                  <span className="discord-timestamp">Today at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="discord-message-text">{currentResponse.query}</div>
              </div>
            </div>

            {/* Bot Response Message with Discord Embed */}
            <div className="discord-message-row bot-row">
              <div className="discord-avatar bot-avatar">
                <Sparkles size={18} color="#FFFFFF" />
              </div>
              <div className="discord-message-content">
                <div className="discord-message-author-line">
                  <span className="discord-bot-name">OrgMind</span>
                  <span className="discord-bot-tag">BOT</span>
                  <span className="discord-timestamp">Today at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className={`discord-mode-pill ${isLiveMode ? 'mode-live' : 'mode-demo'}`}>
                    {isLiveMode ? 'Live FalkorDB' : 'Demo Mode'}
                  </span>
                </div>

                {/* Primary Discord Embed: Direct Answer & Stats */}
                <div className="discord-embed-card">
                  <div className="embed-header-row">
                    <div className="embed-title-badge">
                      <ShieldCheck size={14} color="#10B981" />
                      <span>Executive Summary</span>
                    </div>
                    <span className="embed-verified-tag">100% Graph Corroborated</span>
                  </div>

                  <div className="embed-direct-answer">
                    {currentResponse.direct_answer ? (
                      <p>{currentResponse.direct_answer}</p>
                    ) : (
                      <div
                        dangerouslySetInnerHTML={{
                          __html: currentResponse.answer
                            .replace(/^### (.*$)/gim, '<strong>$1</strong>')
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            .replace(/\n\n/g, '<br/><br/>'),
                        }}
                      />
                    )}
                  </div>

                  {/* Summary Metric Badges */}
                  {currentResponse.summary_stats && (
                    <div className="embed-metrics-row">
                      <div className="embed-metric-pill metric-red">
                        <span className="metric-label">Critical Blockers:</span>
                        <strong className="metric-val">{currentResponse.summary_stats.critical_blockers}</strong>
                      </div>
                      <div className="embed-metric-pill metric-amber">
                        <span className="metric-label">Estimated Delay:</span>
                        <strong className="metric-val">{currentResponse.summary_stats.total_delay_days}d</strong>
                      </div>
                      <div className="embed-metric-pill metric-purple">
                        <span className="metric-label">Pending Decisions:</span>
                        <strong className="metric-val">{currentResponse.summary_stats.pending_decisions_count}</strong>
                      </div>
                      <div className="embed-metric-pill metric-cyan">
                        <span className="metric-label">Evidence Docs:</span>
                        <strong className="metric-val">{currentResponse.summary_stats.supporting_docs_count}</strong>
                      </div>
                    </div>
                  )}

                  {/* Causal Flow Chain (n8n Node Breadcrumbs) */}
                  {currentResponse.causal_chain && currentResponse.causal_chain.length > 0 && (
                    <div className="embed-causal-flow">
                      <div className="causal-flow-title">
                        <span>Causal Dependency Chain</span>
                        <button
                          className="btn-flow-link"
                          onClick={() => onOpenGraphView(currentResponse.causal_chain?.[0]?.id)}
                        >
                          <Zap size={11} />
                          <span>Open in Flow Graph ↗</span>
                        </button>
                      </div>

                      <div className="n8n-chain-nodes">
                        {currentResponse.causal_chain.map((step, idx) => (
                          <React.Fragment key={step.id}>
                            <div
                              className={`n8n-chain-step ${
                                selectedEvidenceId === step.id ? 'is-selected' : ''
                              }`}
                              onClick={() => onInspectNode(step.id)}
                              title={`Inspect ${step.title}`}
                            >
                              <span className="step-tag">{step.label}</span>
                              <span className="step-name">{step.title}</span>
                            </div>
                            {step.rel && (
                              <div className="n8n-chain-arrow">
                                <span>-[{step.rel}]-&gt;</span>
                              </div>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Blocker Cards */}
                  {currentResponse.blockers && currentResponse.blockers.length > 0 && (
                    <div className="embed-blockers-list">
                      <div className="blockers-list-heading">
                        <AlertTriangle size={13} color="#EF4444" />
                        <span>Active Blocking Records ({currentResponse.blockers.length})</span>
                      </div>

                      {currentResponse.blockers.map((b) => (
                        <div key={b.id} className="discord-blocker-subcard">
                          <div className="subcard-header">
                            <div className="subcard-title-wrap">
                              <span className="priority-pill">{b.priority}</span>
                              <h4 className="subcard-title">{b.title}</h4>
                            </div>
                            <span className="delay-badge">{b.delay_days}d delay</span>
                          </div>

                          <div className="subcard-meta">
                            <User size={12} className="text-muted" />
                            <span>Owner: </span>
                            <strong>{b.owner}</strong>
                            {b.owner_role && <span className="text-muted"> ({b.owner_role})</span>}
                          </div>

                          <div className="subcard-reason">
                            <span className="reason-tag">Evidence:</span>
                            <p>{b.reason}</p>
                          </div>

                          {b.decision && (
                            <div className="subcard-extra">
                              <span className="extra-key">Blocking Decision:</span>
                              <span className="extra-val">{b.decision}</span>
                            </div>
                          )}

                          <div className="subcard-actions">
                            <button
                              className="btn-subcard-inspect"
                              onClick={() => onInspectNode(b.id)}
                            >
                              <span>Inspect Properties</span>
                            </button>
                            <button
                              className="btn-subcard-graph"
                              onClick={() => onOpenGraphView(b.id)}
                            >
                              <Zap size={12} />
                              <span>Focus in Graph ↗</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Collapsible Cypher Query Accordion */}
                  <div className="embed-cypher-accordion">
                    <button
                      className="cypher-accordion-btn"
                      onClick={() => setShowCypher(!showCypher)}
                    >
                      <div className="accordion-left">
                        <Code2 size={13} />
                        <span>Underlying FalkorDB Cypher Query</span>
                      </div>
                      {showCypher ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>

                    {showCypher && (
                      <div className="cypher-accordion-body">
                        <div className="cypher-code-header">
                          <span>CYPHER</span>
                          <button className="btn-copy-code" onClick={handleCopyCypher}>
                            {copiedCypher ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                            <span>{copiedCypher ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                        <pre className="cypher-code-block">{currentResponse.cypher}</pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 3. Discord Bottom Chat Input Bar */}
      <div className="discord-input-container">
        {/* Suggestion Chips */}
        <div className="discord-suggestion-row">
          {SUGGESTIONS.map((s, idx) => (
            <button
              key={idx}
              className="discord-suggest-pill"
              onClick={() => handleSuggestionClick(s)}
              disabled={isLoading}
            >
              <span>{s}</span>
            </button>
          ))}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="discord-input-box">
          <input
            type="text"
            className="discord-text-input"
            placeholder={`Message #${channelName} (or ask why delayed)...`}
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            className="discord-send-btn"
            disabled={!inputQuery.trim() || isLoading}
            title="Send query (Enter)"
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default BrainChat;
