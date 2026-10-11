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
  direct_answer?: string;
  summary_stats?: {
    total_delay_days: number;
    critical_blockers: number;
    blocked_tasks_count: number;
    pending_decisions_count: number;
    supporting_docs_count: number;
  };
  causal_chain?: Array<{
    id: string;
    title: string;
    label: string;
    rel?: string;
  }>;
  blockers?: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    delay_days: number;
    owner: string;
    owner_role: string;
    reason: string;
    decision?: string | null;
    decision_owner?: string | null;
    docs: string[];
  }>;
  missing_facts?: string[];
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
