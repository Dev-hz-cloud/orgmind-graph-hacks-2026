import React, { useState, useEffect, useCallback } from 'react';
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
  EvidenceItem,
} from './types';
import { Sidebar, ActiveView } from './components/Sidebar';
import { BrainChat } from './components/BrainChat';
import { GraphCanvas } from './components/GraphCanvas';
import { ExploreView } from './components/ExploreView';
import { NodeInspector } from './components/NodeInspector';
import { ConnectionModal } from './components/ConnectionModal';
import { CypherModal } from './components/CypherModal';

export const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [schema, setSchema] = useState<GraphSchema | null>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>('proj-titan');

  // Active view: 'chat' (Discord style) | 'graph' (n8n workflow style) | 'records' (catalog)
  const [activeView, setActiveView] = useState<ActiveView>('chat');

  // Brain Q&A State
  const [isLoadingAnswer, setIsLoadingAnswer] = useState(false);
  const [currentResponse, setCurrentResponse] = useState<QuestionResponse | null>(null);
  const [highlightNodes, setHighlightNodes] = useState<string[]>([]);
  const [highlightEdges, setHighlightEdges] = useState<string[]>([]);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);

  // Inspector & Modals State
  const [inspectNodeId, setInspectNodeId] = useState<string | null>(null);
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

  // Initial load
  useEffect(() => {
    loadGraphData(selectedProject);
    handleAskQuestion('Why is Project Titan delayed?');
  }, []);

  const handleAskQuestion = async (query: string) => {
    setIsLoadingAnswer(true);
    setSelectedEvidenceId(null);
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

  const handleSelectEvidence = (item: EvidenceItem) => {
    setSelectedEvidenceId(item.entity_id);
    setHighlightNodes([item.entity_id]);
    setInspectNodeId(item.entity_id);
  };

  const handleClearHighlight = () => {
    setHighlightNodes([]);
    setHighlightEdges([]);
    setSelectedEvidenceId(null);
    setInspectNodeId(null);
  };

  const handleOpenGraphView = (targetNodeId?: string) => {
    if (targetNodeId) {
      setInspectNodeId(targetNodeId);
      setHighlightNodes([targetNodeId]);
      setSelectedEvidenceId(targetNodeId);
    }
    setActiveView('graph');
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

  return (
    <div className="discord-app-layout">
      {/* 1. Left Discord-Style Channel Sidebar */}
      <Sidebar
        config={config}
        schema={schema}
        activeView={activeView}
        onSelectView={setActiveView}
        selectedProject={selectedProject}
        onSelectProject={handleSelectProject}
        onQuickAsk={handleAskQuestion}
        onOpenCypher={() => setIsCypherModalOpen(true)}
        onOpenSettings={() => setIsConnectionModalOpen(true)}
        onSeedData={handleSeedData}
        isSeeding={isSeeding}
      />

      {/* 2. Main Workspace (Clean, Uncluttered View) */}
      <main className="discord-main-viewport">
        {activeView === 'chat' && (
          <BrainChat
            selectedProject={selectedProject}
            onAskQuestion={handleAskQuestion}
            isLoading={isLoadingAnswer}
            currentResponse={currentResponse}
            selectedEvidenceId={selectedEvidenceId}
            onSelectEvidence={handleSelectEvidence}
            onInspectNode={(nodeId) => {
              setInspectNodeId(nodeId);
              setHighlightNodes([nodeId]);
            }}
            onOpenGraphView={handleOpenGraphView}
            onClearHighlight={handleClearHighlight}
          />
        )}

        {activeView === 'graph' && (
          <GraphCanvas
            nodes={nodes}
            edges={edges}
            highlightNodes={highlightNodes}
            highlightEdges={highlightEdges}
            selectedNodeId={inspectNodeId}
            onSelectNode={(nodeId) => setInspectNodeId(nodeId)}
            onClearHighlight={handleClearHighlight}
            selectedProject={selectedProject}
            onBackToChat={() => setActiveView('chat')}
          />
        )}

        {activeView === 'records' && (
          <ExploreView
            nodes={nodes}
            edges={edges}
            onSelectEntityInInvestigate={(entityId, projectId) => {
              if (projectId) setSelectedProject(projectId);
              handleOpenGraphView(entityId);
            }}
            onAskAboutEntity={(entityTitle) => {
              setActiveView('chat');
              handleAskQuestion(`What is connected to "${entityTitle}"?`);
            }}
          />
        )}
      </main>

      {/* Floating Contextual Node Inspector Drawer */}
      <NodeInspector
        nodeId={inspectNodeId}
        nodes={nodes}
        edges={edges}
        onClose={() => setInspectNodeId(null)}
        onSelectNode={(nodeId) => {
          setInspectNodeId(nodeId);
          setHighlightNodes([nodeId]);
        }}
        onAskAboutNode={(title) => {
          setActiveView('chat');
          handleAskQuestion(`Explain how "${title}" impacts project delays`);
        }}
      />

      {/* FalkorDB Connection Settings Modal */}
      <ConnectionModal
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
