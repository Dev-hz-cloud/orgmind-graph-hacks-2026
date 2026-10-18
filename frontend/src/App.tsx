import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchConfig,
  fetchSchema,
  fetchGraph,
  askQuestion,
  seedDatabase,
  createRecord,
  updateRecord,
  deleteRecord,
} from './services/api';
import type {
  AppConfig,
  GraphSchema,
  GraphNode,
  GraphEdge,
  QuestionResponse,
  NodeLabel,
} from './types';
import { FocusRequest, nextFocusNonce } from './shared/dimensions';
import { Sidebar, MainTab } from './components/Sidebar';
import { BrainChat } from './components/BrainChat';
import { GraphExplorer } from './components/GraphExplorer';
import { DatabaseView } from './components/DatabaseView';
import { DirectoryIndex } from './components/DirectoryIndex';
import { FlashcardModal } from './components/FlashcardModal';
import { ConnectionModal } from './components/ConnectionModal';
import { CypherModal } from './components/CypherModal';

export const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [schema, setSchema] = useState<GraphSchema | null>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  // Main Tabs: 'chat' (Assistant) | 'flow' (Booklet Directory + n8n Cube Canvas)
  const [activeTab, setActiveTab] = useState<MainTab>('chat');

  // Brain Q&A State
  const [sessionId, setSessionId] = useState<string>(() => {
    const saved = localStorage.getItem('orgmind_session_id');
    if (saved) return saved;
    const newId = `sess-${Math.random().toString(36).substring(2, 10)}`;
    localStorage.setItem('orgmind_session_id', newId);
    return newId;
  });
  const [isLoadingAnswer, setIsLoadingAnswer] = useState(false);
  const [currentResponse, setCurrentResponse] = useState<QuestionResponse | null>(null);
  const [highlightNodes, setHighlightNodes] = useState<string[]>([]);
  const [highlightEdges, setHighlightEdges] = useState<string[]>([]);

  // Flashcard Modal State (full-card modal, opened explicitly via Expand/Card actions)
  const [flashcardNodeId, setFlashcardNodeId] = useState<string | null>(null);

  // Graph canvas selection state (drives the compact NodeInspector on-canvas)
  const [graphSelectedId, setGraphSelectedId] = useState<string | null>(null);

  // Out-of-canvas focus requests (Directory Index → cube/graph)
  const [focusTarget, setFocusTarget] = useState<FocusRequest | null>(null);

  // Tools Modals
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [isCypherModalOpen, setIsCypherModalOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Load telemetry and graph data
  const loadGraphData = useCallback(async (projectFilter?: string | null) => {
    try {
      const graphData = await fetchGraph(projectFilter || undefined);
      setNodes(graphData.nodes);
      setEdges(graphData.edges);

      const [cfg, scm] = await Promise.all([fetchConfig(), fetchSchema()]);
      setConfig(cfg);
      setSchema(scm);
    } catch (err) {
      console.error('Error loading graph telemetry:', err);
    }
  }, []);

  // Initial load: fetch whatever records actually exist. No project is assumed
  // and no question is fabricated on startup.
  useEffect(() => {
    loadGraphData(selectedProject);
  }, []);

  const handleAskQuestion = async (query: string) => {
    setIsLoadingAnswer(true);
    try {
      const response = await askQuestion(query, selectedProject || undefined, sessionId);
      setCurrentResponse(response);
      if (response.session_id && response.session_id !== sessionId) {
        setSessionId(response.session_id);
        localStorage.setItem('orgmind_session_id', response.session_id);
      }
      setHighlightNodes(response.highlight_nodes);
      setHighlightEdges(response.highlight_edges);
    } catch (err: any) {
      console.error('Failed to answer question:', err);
      setCurrentResponse({
        query,
        cypher: 'MATCH (n) RETURN n',
        cypher_params: {},
        answer: `### Query Failed\n\n${err.message}`,
        evidence: [],
        highlight_nodes: [],
        highlight_edges: [],
        confidence: 0,
        mode: config?.mode || 'demo',
      });
    } finally {
      setIsLoadingAnswer(false);
    }
  };

  const handleSelectProject = (projectId: string | null) => {
    setSelectedProject(projectId);
    loadGraphData(projectId);
    setHighlightNodes([]);
    setHighlightEdges([]);
  };

  const handleClearHighlight = () => {
    setHighlightNodes([]);
    setHighlightEdges([]);
    setFlashcardNodeId(null);
    setGraphSelectedId(null);
  };

  // Database View record handlers — persist through the backend record API and
  // reload the graph from the source of truth after a confirmed write.
  const handleCreateRecord = async (label: NodeLabel, properties: Record<string, any>) => {
    const result = await createRecord(label, properties);
    if (result.success) {
      await loadGraphData(selectedProject);
    }
    return result;
  };

  const handleUpdateRecord = async (
    nodeId: string,
    label: NodeLabel,
    properties: Record<string, any>
  ) => {
    const result = await updateRecord(nodeId, label, properties);
    if (result.success) {
      await loadGraphData(selectedProject);
    }
    return result;
  };

  const handleDeleteRecord = async (nodeId: string) => {
    const result = await deleteRecord(nodeId);
    if (result.success) {
      await loadGraphData(selectedProject);
      if (flashcardNodeId === nodeId) setFlashcardNodeId(null);
      if (graphSelectedId === nodeId) setGraphSelectedId(null);
    }
    return result;
  };

  // Project choices are read from actual Project records, never hardcoded.
  const projects = useMemo(
    () =>
      nodes
        .filter((n) => n.label === 'Project')
        .map((n) => ({
          id: n.id,
          name: (n.properties?.name as string) || (n.properties?.title as string) || n.id,
        })),
    [nodes]
  );

  const writesEnabled =
    config?.mode === 'live' &&
    config?.is_connected === true &&
    config?.allow_live_writes === true;
  const writesDisabledReason = !config
    ? null
    : config.mode === 'demo'
    ? 'Writes are disabled in Demo Mode. Connect to a live FalkorDB graph to add, edit, or delete records.'
    : !config.is_connected
    ? 'Writes are disabled because the database is not connected. Reconnect to a live FalkorDB graph to make changes.'
    : !config.allow_live_writes
    ? 'Writes to the live graph are disabled. Set ORGMIND_ALLOW_LIVE_WRITES=true on the backend and restart it to enable adding, editing, or deleting records.'
    : null;

  const handleSeedData = async () => {
    setIsSeeding(true);
    try {
      await seedDatabase();
      await loadGraphData(selectedProject);
      alert('NovaTech Logistics demo graph successfully seeded with Cypher MERGE!');
    } catch (err: any) {
      alert(`Seeding failed: ${err.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  // Directory Index → Graph: switch tab and focus/highlight the entity.
  // The focus target also tells the cube explorer to fly to that entity's
  // dimension, so the hand-off lands somewhere visible.
  const handleInspectInGraph = (nodeId: string) => {
    setFlashcardNodeId(null);
    setGraphSelectedId(nodeId);
    setHighlightNodes([nodeId]);
    setHighlightEdges([]);
    setFocusTarget({ nodeId, nonce: nextFocusNonce() });
    setActiveTab('flow');
  };

  return (
    <div className="scratch-app-layout">
      {/* 1. Left Discord-Box Icon Rail */}
      <Sidebar
        config={config}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenCypher={() => setIsCypherModalOpen(true)}
        onOpenSettings={() => setIsConnectionModalOpen(true)}
        onSeedData={handleSeedData}
        isSeeding={isSeeding}
      />

      {/* 2. Main Workspace Body */}
      <main className="scratch-main-viewport">
        {activeTab === 'chat' && (
          <BrainChat
            selectedProject={selectedProject}
            projects={projects}
            onSelectProject={handleSelectProject}
            onAskQuestion={handleAskQuestion}
            isLoading={isLoadingAnswer}
            currentResponse={currentResponse}
            onOpenFlashcard={(nodeId) => setFlashcardNodeId(nodeId)}
            onOpenFlowView={() => setActiveTab('flow')}
          />
        )}

        {activeTab === 'database' && (
          <div className="database-tab-shell">
            <div className="database-workspace">
              <DirectoryIndex
                nodes={nodes}
                selectedNodeId={graphSelectedId}
                onOpenDetails={(nodeId) => setFlashcardNodeId(nodeId)}
                onInspectInGraph={handleInspectInGraph}
              />
              <DatabaseView
                nodes={nodes}
                writable={writesEnabled}
                writesDisabledReason={writesDisabledReason}
                onCreateRecord={handleCreateRecord}
                onUpdateRecord={handleUpdateRecord}
                onDeleteRecord={handleDeleteRecord}
                onOpenFlashcard={(nodeId) => setFlashcardNodeId(nodeId)}
              />
            </div>
          </div>
        )}

        {activeTab === 'flow' && (
          <GraphExplorer
            nodes={nodes}
            edges={edges}
            highlightNodes={highlightNodes}
            highlightEdges={highlightEdges}
            selectedNodeId={graphSelectedId}
            onSelectNode={(nodeId) => setGraphSelectedId(nodeId)}
            onClearHighlight={handleClearHighlight}
            selectedProject={selectedProject}
            onBackToChat={() => setActiveTab('chat')}
            onOpenFlashcard={(nodeId) => setFlashcardNodeId(nodeId)}
            evidence={currentResponse?.evidence}
            externalFocus={focusTarget}
            onAskAboutNode={(title) => {
              setActiveTab('chat');
              handleAskQuestion(`Explain how "${title}" impacts project delays`);
            }}
          />
        )}
      </main>

      {/* Interactive Expandable Flashcard Modal */}
      <FlashcardModal
        nodeId={flashcardNodeId}
        nodes={nodes}
        edges={edges}
        onClose={() => setFlashcardNodeId(null)}
        onSelectNode={(nodeId) => setFlashcardNodeId(nodeId)}
        onAskAboutNode={(title) => {
          setActiveTab('chat');
          handleAskQuestion(`Explain how "${title}" impacts project delays`);
        }}
      />

      {/* FalkorDB Connection Settings Modal */}
      <ConnectionModal
        key={config ? `cfg-${config.falkordb_graph}-${config.mode}` : 'cfg-pending'}
        isOpen={isConnectionModalOpen}
        onClose={() => setIsConnectionModalOpen(false)}
        config={config}
        onConnectionUpdated={() => loadGraphData(selectedProject)}
      />

      {/* Direct Cypher Console Modal */}
      <CypherModal
        isOpen={isCypherModalOpen}
        onClose={() => setIsCypherModalOpen(false)}
      />
    </div>
  );
};

export default App;
