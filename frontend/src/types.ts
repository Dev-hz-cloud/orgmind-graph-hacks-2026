export type NodeLabel = 'Project' | 'Person' | 'Task' | 'Decision' | 'Document' | 'Team';

export interface GraphNode {
  id: string;
  label: NodeLabel;
  properties: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  src: string;
  dst: string;
  rel: string;
  properties?: Record<string, any>;
}

export interface EvidenceItem {
  id: string;
  type: string;
  entity_id: string;
  label: string;
  title: string;
  summary: string;
  properties: Record<string, any>;
}

export interface QuestionResponse {
  query: string;
  cypher: string;
  cypher_params: Record<string, any>;
  answer: string;
  evidence: EvidenceItem[];
  highlight_nodes: string[];
  highlight_edges: string[];
  confidence: number;
  mode: 'live' | 'demo';
}

export interface GraphSchema {
  labels: Record<string, number>;
  relationships: Record<string, number>;
  total_nodes: number;
  total_edges: number;
  mode: string;
  graph_name: string;
  is_connected: boolean;
}

export interface AppConfig {
  falkordb_host: string;
  falkordb_port: number;
  falkordb_username: string;
  falkordb_password_set: boolean;
  falkordb_graph: string;
  falkordb_ssl: boolean;
  mode: 'live' | 'demo';
  is_connected: boolean;
  last_error: string | null;
}
