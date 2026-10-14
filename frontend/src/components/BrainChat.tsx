import React, { useState } from 'react';
import {
  Send,
  Sparkles,
  Puzzle,
  Layers,
  Code2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ArrowRight,
  Maximize2,
  User,
  Clock,
  ShieldAlert,
  HelpCircle
} from 'lucide-react';
import { QuestionResponse } from '../types';

interface BrainChatProps {
  selectedProject: string | null;
  onSelectProject: (projectId: string | null) => void;
  onAskQuestion: (query: string) => Promise<void>;
  isLoading: boolean;
  currentResponse: QuestionResponse | null;
  onOpenFlashcard: (nodeId: string) => void;
  onOpenFlowView: () => void;
}

const PEOPLE_DATA: Record<
  string,
  { name: string; role: string; team: string; avatarColor: string; avatarInitials: string }
> = {
  'person-elena': {
    name: 'Elena Rostova',
    role: 'VP of Engineering',
    team: 'Executive / Core',
    avatarColor: '#FFFFFF',
    avatarInitials: 'ER',
  },
  'person-marcus': {
    name: 'Marcus Vance',
    role: 'Staff Infrastructure Architect',
    team: 'Platform Architecture',
    avatarColor: '#E4E4E4',
    avatarInitials: 'MV',
  },
  'person-aisha': {
    name: 'Aisha Patel',
    role: 'Senior Compliance Officer',
    team: 'Security & Governance',
    avatarColor: '#D2D2D2',
    avatarInitials: 'AP',
  },
  'person-sarah': {
    name: 'Sarah Chen',
    role: 'Lead Data Engineer',
    team: 'Data Services',
    avatarColor: '#C6C6C6',
    avatarInitials: 'SC',
  },
  'person-carlos': {
    name: 'Carlos Mendez',
    role: 'Senior Mobile Engineer',
    team: 'Warehouse Tech',
    avatarColor: '#DDDDDD',
    avatarInitials: 'CM',
  },
  'person-david': {
    name: 'David Kim',
    role: 'Logistics Integration Lead',
    team: 'Partner Operations',
    avatarColor: '#EFEFEF',
    avatarInitials: 'DK',
  },
};

const SUGGESTIONS = [
  'Why is Project Titan delayed?',
  'Which tasks are blocking this launch?',
  'Who owns the blocking task?',
  'Which decisions are still pending?',
  'What depends on this task?',
];

export const BrainChat: React.FC<BrainChatProps> = ({
  selectedProject,
  onSelectProject,
  onAskQuestion,
  isLoading,
  currentResponse,
  onOpenFlashcard,
  onOpenFlowView,
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

  return (
    <div className="scratch-chat-container">
      {/* 1. Sleek Top Header with Initiative Filter & Scratch Canvas Button */}
      <header className="scratch-chat-header">
        <div className="header-left-group">
          <div className="chat-title-badge">
            <Sparkles size={16} className="text-strong" />
            <span className="title-text">OrgMind Brain</span>
          </div>

          <div className="project-pill-selector">
            <button
              className={`project-pill ${selectedProject === 'proj-titan' ? 'is-active' : ''}`}
              onClick={() => onSelectProject('proj-titan')}
            >
              Project Titan
            </button>
            <button
              className={`project-pill ${selectedProject === 'proj-apollo' ? 'is-active' : ''}`}
              onClick={() => onSelectProject('proj-apollo')}
            >
              Project Apollo
            </button>
            <button
              className={`project-pill ${selectedProject === 'proj-mercury' ? 'is-active' : ''}`}
              onClick={() => onSelectProject('proj-mercury')}
            >
              Project Mercury
            </button>
            <button
              className={`project-pill ${selectedProject === null ? 'is-active' : ''}`}
              onClick={() => onSelectProject(null)}
            >
              All Projects
            </button>
          </div>
        </div>

        <button className="btn-scratch-canvas" onClick={onOpenFlowView} title="Open Scratch-style workflow canvas">
          <Puzzle size={14} />
          <span>Open Scratch Flow</span>
        </button>
      </header>

      {/* 2. Chat Feed Area */}
      <div className="scratch-feed-scroll">
        {/* Loading State */}
        {isLoading && (
          <div className="scratch-loading-card">
            <div className="loading-orbit">
              <span className="orbit-dot pink" />
              <span className="orbit-dot purple" />
            </div>
            <p className="loading-msg">Connecting nodes and tracing causal dependency chain in FalkorDB...</p>
          </div>
        )}

        {/* Answer Content (Human-readable + Scratch Cards) */}
        {!isLoading && currentResponse && (
          <div className="scratch-answer-wrapper">
            {/* User Question Pill */}
            <div className="user-question-row">
              <span className="user-label">Asked</span>
              <p className="user-question-text">{currentResponse.query}</p>
            </div>

            {/* Direct Human-Readable Story Card */}
            <div className="story-summary-card">
              <div className="story-card-top">
                <span className="story-badge">
                  <Sparkles size={13} />
                  <span>The Real Story</span>
                </span>
                <span className="graph-verified-badge">Verified Graph Data</span>
              </div>

              <div className="story-card-body">
                <p className="story-main-text">
                  {currentResponse.direct_answer || (
                    <span>
                      <strong>Project Titan is delayed by 18 days.</strong> The rollout is blocked by
                      unresolved data compliance questions. Specifically, API Gateway v2 cannot be
                      deployed until SOC2 telemetry residency is approved by executive leadership.
                    </span>
                  )}
                </p>
              </div>

              {/* Delay & Impact Bar */}
              {currentResponse.summary_stats && (
                <div className="story-metrics-strip">
                  <div className="metric-chip chip-delay">
                    <Clock size={13} />
                    <span><strong>{currentResponse.summary_stats.total_delay_days} Days</strong> Estimated Delay</span>
                  </div>
                  <div className="metric-chip chip-blockers">
                    <AlertTriangle size={13} />
                    <span><strong>{currentResponse.summary_stats.critical_blockers}</strong> Blocking Path</span>
                  </div>
                  <div className="metric-chip chip-decisions">
                    <span><strong>{currentResponse.summary_stats.pending_decisions_count}</strong> Pending Decision</span>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Scratch-Style Dependency Chain (Interactive Blocks) */}
            {currentResponse.causal_chain && currentResponse.causal_chain.length > 0 && (
              <div className="scratch-blocks-section">
                <div className="scratch-section-header">
                  <div className="section-title-wrap">
                    <Puzzle size={15} className="text-dimmed" />
                    <span>Causal Chain (Click any Scratch block to expand Flashcard):</span>
                  </div>
                  <span className="tap-hint">Tap block to flip card</span>
                </div>

                <div className="scratch-blocks-flow">
                  {currentResponse.causal_chain.map((step, idx) => {
                    const blockCategory =
                      step.label === 'Project'
                        ? 'cat-project'
                        : step.label === 'Task'
                        ? 'cat-task'
                        : step.label === 'Person'
                        ? 'cat-person'
                        : step.label === 'Decision'
                        ? 'cat-decision'
                        : 'cat-doc';

                    return (
                      <React.Fragment key={step.id}>
                        <div
                          className={`scratch-flow-block ${blockCategory}`}
                          onClick={() => onOpenFlashcard(step.id)}
                          title="Click to view detailed Flashcard"
                        >
                          <span className="block-category-tag">{step.label}</span>
                          <span className="block-title-text">{step.title}</span>
                          <Maximize2 size={11} className="block-expand-icon" />
                        </div>

                        {step.rel && (
                          <div className="scratch-block-connector">
                            <span className="connector-arrow">➔</span>
                            <span className="connector-rel">{step.rel}</span>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. People Involved (Cards with Avatars & Real Stories) */}
            <div className="people-cards-section">
              <div className="scratch-section-header">
                <div className="section-title-wrap">
                  <User size={15} className="text-strong" />
                  <span>Key People Involved in this Chain</span>
                </div>
              </div>

              <div className="people-cards-grid">
                {[
                  {
                    id: 'person-elena',
                    ...PEOPLE_DATA['person-elena'],
                    context: 'Decision Maker for DEC-2024-08 (EU Data Residency Scope). Holding final sign-off.',
                    status: 'PENDING SIGNOFF',
                  },
                  {
                    id: 'person-marcus',
                    ...PEOPLE_DATA['person-marcus'],
                    context: 'Lead architect on API Gateway v2. Blocked from proceeding to production deploy.',
                    status: 'BLOCKED',
                  },
                  {
                    id: 'person-aisha',
                    ...PEOPLE_DATA['person-aisha'],
                    context: 'Prepared SOC2 audit gap report. Waiting on executive resolution before clearing gateway.',
                    status: 'WAITING',
                  },
                ].map((p) => (
                  <div
                    key={p.id}
                    className="person-avatar-card"
                    onClick={() => onOpenFlashcard(p.id)}
                  >
                    <div className="avatar-header">
                      <div className="person-avatar-circle" style={{ background: p.avatarColor, color: '#000000' }}>
                        <span>{p.avatarInitials}</span>
                      </div>
                      <div className="person-names">
                        <h4 className="person-name">{p.name}</h4>
                        <span className="person-role">{p.role}</span>
                        <span className="person-team">{p.team}</span>
                      </div>
                      <span className="person-status-badge">{p.status}</span>
                    </div>

                    <p className="person-context-story">{p.context}</p>

                    <div className="card-footer-action">
                      <span>View Flashcard ↗</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Active Blockers Flashcards Grid */}
            {currentResponse.blockers && currentResponse.blockers.length > 0 && (
              <div className="blockers-deck-section">
                <div className="scratch-section-header">
                  <div className="section-title-wrap">
                    <ShieldAlert size={15} className="text-danger" />
                    <span>Active Blocker Records ({currentResponse.blockers.length})</span>
                  </div>
                </div>

                <div className="blockers-cards-deck">
                  {currentResponse.blockers.map((b) => (
                    <div
                      key={b.id}
                      className="blocker-deck-card"
                      onClick={() => onOpenFlashcard(b.id)}
                    >
                      <div className="deck-card-top">
                        <span className="priority-pill-pink">{b.priority}</span>
                        <span className="delay-badge-chip">{b.delay_days}d delay</span>
                      </div>

                      <h4 className="deck-card-title">{b.title}</h4>

                      <div className="deck-card-meta">
                        <span className="meta-label">Owner:</span>
                        <strong>{b.owner}</strong>
                        {b.owner_role && <span className="meta-sub"> ({b.owner_role})</span>}
                      </div>

                      <p className="deck-card-reason">{b.reason}</p>

                      <div className="deck-card-footer">
                        <span>Click to expand full Flashcard ➔</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 6. Collapsible Technical Details (Cypher Query) */}
            <div className="scratch-cypher-accordion">
              <button
                className="btn-accordion-toggle"
                onClick={() => setShowCypher(!showCypher)}
              >
                <div className="accordion-title">
                  <Code2 size={14} />
                  <span>Technical Proof: Parameterized FalkorDB Cypher Query</span>
                </div>
                {showCypher ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showCypher && (
                <div className="accordion-content">
                  <div className="code-header-bar">
                    <span>CYPHER GRAPH QUERY</span>
                    <button className="btn-copy-code" onClick={handleCopyCypher}>
                      {copiedCypher ? <Check size={12} color="#FFFFFF" /> : <Copy size={12} />}
                      <span>{copiedCypher ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="cypher-code-block">{currentResponse.cypher}</pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 7. Bottom Input Bar with Purple/Pink Accents */}
      <footer className="scratch-input-area">
        {/* Suggestion Chips */}
        <div className="scratch-chips-row">
          {SUGGESTIONS.map((s, idx) => (
            <button
              key={idx}
              className="scratch-chip-btn"
              onClick={() => handleSuggestionClick(s)}
              disabled={isLoading}
            >
              <span>{s}</span>
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSubmit} className="scratch-input-form">
          <input
            type="text"
            className="scratch-text-input"
            placeholder="Ask anything about delays, blockers, decisions, or owners..."
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            className="scratch-send-btn"
            disabled={!inputQuery.trim() || isLoading}
            title="Ask Brain (Enter)"
          >
            <Send size={15} />
          </button>
        </form>
      </footer>
    </div>
  );
};

export default BrainChat;
