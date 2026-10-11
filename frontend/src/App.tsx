import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchConfig,
  fetchSchema,
  fetchGraph,
  askQuestion,
} from './services/api';
import type {
  AppConfig,
  GraphSchema,
  GraphNode,
  GraphEdge,
  QuestionResponse,
  EvidenceItem,
} from './types';
import { Sidebar, WorkspaceTab } from './components/Sidebar';
import { BrainChat } from './components/BrainChat';
import { GraphCanvas } from './components/GraphCanvas';
import { ExploreView } from './components/ExploreView';
import { DataConnectionsView } from './components/DataConnectionsView';
import { NodeInspector } from './components/NodeInspector';
import { Columns2, LayoutPanelLeft, Maximize2 } from 'lucide-react';

export type WorkspaceLayoutMode = 'split' | 'chat-focus' | 'graph-focus';

export const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [schema, setSchema] = useState<GraphSchema | null>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>('proj-titan');

  // Workspace Area: 'investigate' | 'explore' | 'data'
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('investigate');

  // Investigate Layout mode: split (50/50), chat-focus (65/35), graph-focus (30/70)
  const [layoutMode, setLayoutMode] = useState<WorkspaceLayoutMode>('split');

  // Brain Q&A State
  const [isLoadingAnswer, setIsLoadingAnswer] = useState(false);
  const [currentResponse, setCurrentResponse] = useState<QuestionResponse | null>(null);
  const [highlightNodes, setHighlightNodes] = useState<string[]>([]);
  const [highlightEdges, setHighlightEdges] = useState<string[]>([]);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);

  // Inspector State
  const [inspectNodeId, setInspectNodeId] = useState<string | null>(null);

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
    // Auto-run primary hackathon track question on launch
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

  const toggleChatFocus = () => {
    setLayoutMode((prev) => (prev === 'chat-focus' ? 'split' : 'chat-focus'));
  };

  const handleSelectEntityInInvestigate = (entityId: string, projectId?: string) => {
    if (projectId && projectId !== selectedProject) {
      setSelectedProject(projectId);
      loadGraphData(projectId);
    }
    setActiveTab('investigate');
    setInspectNodeId(entityId);
    setHighlightNodes([entityId]);
    setSelectedEvidenceId(entityId);
  };

  const handleAskAboutEntity = (entityTitle: string) => {
    setActiveTab('investigate');
    handleAskQuestion(`What is connected to "${entityTitle}"?`);
  };

  return (
    <div className="app-container">
      {/* 1. Left Navigation Rail & Sidebar */}
      <Sidebar
        config={config}
        schema={schema}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        selectedProject={selectedProject}
        onSelectProject={handleSelectProject}
      />

      {/* 2. Primary Workspace Body */}
      <main className="main-content-viewport">
        {/* Workspace A: Investigate */}
        {activeTab === 'investigate' && (
          <div className={`workspace-split-container layout-${layoutMode}`}>
            {/* Top Layout Switcher Bar */}
            <div className="workspace-top-bar">
              <div className="workspace-path-indicator">
                <span className="text-muted">OrgMind</span>
                <span className="text-dim">/</span>
                <span className="path-active">
                  {selectedProject
                    ? selectedProject.toUpperCase().replace('PROJ-', 'PROJECT ')
                    : 'ALL INITIATIVES'}
                </span>
              </div>

              <div className="layout-switcher-group">
                <button
                  className={`layout-switch-btn ${layoutMode === 'split' ? 'is-active' : ''}`}
                  onClick={() => setLayoutMode('split')}
                  title="Split View (Balanced 50/50)"
                >
                  <Columns2 size={13} />
                  <span>Split View</span>
                </button>
                <button
                  className={`layout-switch-btn ${layoutMode === 'chat-focus' ? 'is-active' : ''}`}
                  onClick={() => setLayoutMode('chat-focus')}
                  title="Q&A Focus (Wide reading space)"
                >
                  <LayoutPanelLeft size={13} />
                  <span>Q&A Focus</span>
                </button>
                <button
                  className={`layout-switch-btn ${layoutMode === 'graph-focus' ? 'is-active' : ''}`}
                  onClick={() => setLayoutMode('graph-focus')}
                  title="Graph Focus (Wide canvas)"
                >
                  <Maximize2 size={13} />
                  <span>Graph Focus</span>
                </button>
              </div>
            </div>

            {/* Center Panel: Brain Q&A & Evidence */}
            <div className="panel-chat-container">
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
                isGraphExpanded={layoutMode === 'chat-focus'}
                onToggleGraphExpanded={toggleChatFocus}
              />
            </div>

            {/* Right Panel: Knowledge Graph Canvas */}
            <div className="panel-graph-container">
              <GraphCanvas
                nodes={nodes}
                edges={edges}
                highlightNodes={highlightNodes}
                highlightEdges={highlightEdges}
                selectedNodeId={inspectNodeId}
                onSelectNode={(nodeId) => setInspectNodeId(nodeId)}
                onClearHighlight={handleClearHighlight}
                selectedProject={selectedProject}
              />
            </div>
          </div>
        )}

        {/* Workspace B: Explore (Company Knowledge Catalog) */}
        {activeTab === 'explore' && (
          <ExploreView
            nodes={nodes}
            edges={edges}
            onSelectEntityInInvestigate={handleSelectEntityInInvestigate}
            onAskAboutEntity={handleAskAboutEntity}
          />
        )}

        {/* Workspace C: Data & Connections (FalkorDB & Cypher Console) */}
        {activeTab === 'data' && (
          <DataConnectionsView
            config={config}
            schema={schema}
            onRefreshData={() => loadGraphData(selectedProject)}
          />
        )}
      </main>

      {/* Contextual Node Inspector Drawer */}
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
          setActiveTab('investigate');
          handleAskQuestion(`Explain how "${title}" impacts project delays`);
        }}
      />
    </div>
  );
};

export default App;
