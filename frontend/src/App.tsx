import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  fetchConfig,
  fetchSchema,
  fetchGraph,
  askQuestion,
  seedDatabase,
} from './services/api';
import type {
  AppConfig,
  GraphSchema,
  GraphNode,
  GraphEdge,
  QuestionResponse,
} from './types';
import { Sidebar, MainTab } from './components/Sidebar';
import { BrainChat } from './components/BrainChat';
import { GraphCanvas } from './components/GraphCanvas';
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
  const [selectedProject, setSelectedProject] = useState<string | null>('proj-titan');

  // Main Tabs: 'chat' (Assistant) | 'flow' (Booklet Directory + n8n Cube Canvas)
  const [activeTab, setActiveTab] = useState<MainTab>('chat');

  // Brain Q&A State
  const [isLoadingAnswer, setIsLoadingAnswer] = useState(false);
  const [currentResponse, setCurrentResponse] = useState<QuestionResponse | null>(null);
  const [highlightNodes, setHighlightNodes] = useState<string[]>([]);
  const [highlightEdges, setHighlightEdges] = useState<string[]>([]);

  // Flashcard Modal State (full-card modal, opened explicitly via Expand/Card actions)
  const [flashcardNodeId, setFlashcardNodeId] = useState<string | null>(null);

  // Graph canvas selection state (drives the compact NodeInspector on-canvas)
  const [graphSelectedId, setGraphSelectedId] = useState<string | null>(null);

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

  // Initial load: trigger primary question
  useEffect(() => {
    loadGraphData(selectedProject);
    handleAskQuestion('Why is Project Titan delayed?');
  }, []);

  const handleAskQuestion = async (query: string) => {
    setIsLoadingAnswer(true);
    try {
      const response = await askQuestion(query, selectedProject || undefined);
      setCurrentResponse(response);
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
    if (projectId) {
      const projName =
        projectId === 'proj-titan'
          ? 'Project Titan'
          : projectId === 'proj-mercury'
          ? 'Project Mercury'
          : 'Project Apollo';
      handleAskQuestion(`Why is ${projName} delayed?`);
    } else {
      setHighlightNodes([]);
      setHighlightEdges([]);
    }
  };

  const handleClearHighlight = () => {
    setHighlightNodes([]);
    setHighlightEdges([]);
    setFlashcardNodeId(null);
    setGraphSelectedId(null);
  };

  // Database View record handlers (CLIENT-SIDE ONLY).
  // The backend exposes no node CRUD API, so these update local state only
  // and are discarded on reload, project switch, or re-seed.
  const handleUpdateNode = (updatedNode: GraphNode) => {
    setNodes((prev) => prev.map((n) => (n.id === updatedNode.id ? updatedNode : n)));
  };

  const handleAddNode = (newNode: GraphNode) => {
    setNodes((prev) => [...prev, newNode]);
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    // Prune edges referencing the deleted node so the graph canvas stays consistent
    setEdges((prev) => prev.filter((e) => e.src !== nodeId && e.dst !== nodeId));
    if (flashcardNodeId === nodeId) setFlashcardNodeId(null);
    if (graphSelectedId === nodeId) setGraphSelectedId(null);
  };

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

  // Directory Index → Graph: switch tab and focus/highlight the entity
  const handleInspectInGraph = (nodeId: string) => {
    setFlashcardNodeId(null);
    setGraphSelectedId(nodeId);
    setHighlightNodes([nodeId]);
    setHighlightEdges([]);
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
            <div className="db-client-only-notice">
              <AlertTriangle size={13} />
              <span>
                <strong>Directory</strong> (left) is a read-only browse of loaded graph records.{' '}
                <strong>Records table</strong> edits are session-only — stored in browser memory and{' '}
                <strong>not written to FalkorDB</strong>. Changes reset on reload, project switch, or
                re-seed.
              </span>
            </div>
            <div className="database-workspace">
              <DirectoryIndex
                nodes={nodes}
                selectedNodeId={graphSelectedId}
                onOpenDetails={(nodeId) => setFlashcardNodeId(nodeId)}
                onInspectInGraph={handleInspectInGraph}
              />
              <DatabaseView
                nodes={nodes}
                onUpdateNode={handleUpdateNode}
                onAddNode={handleAddNode}
                onDeleteNode={handleDeleteNode}
                onOpenFlashcard={(nodeId) => setFlashcardNodeId(nodeId)}
              />
            </div>
          </div>
        )}

        {activeTab === 'flow' && (
          <GraphCanvas
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
