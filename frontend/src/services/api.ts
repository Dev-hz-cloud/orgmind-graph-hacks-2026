import { AppConfig, GraphNode, GraphEdge, GraphSchema, QuestionResponse } from '../types';

const BASE_URL = '/api';

export async function fetchHealth() {
  const res = await fetch(`${BASE_URL}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
  return res.json();
}

export async function fetchConfig(): Promise<AppConfig> {
  const res = await fetch(`${BASE_URL}/config`);
  if (!res.ok) throw new Error(`Failed to fetch config: ${res.statusText}`);
  return res.json();
}

export async function fetchGraph(projectId?: string): Promise<{
  nodes: GraphNode[];
  edges: GraphEdge[];
  mode: 'live' | 'demo';
  graph_name: string;
  node_count: number;
  edge_count: number;
}> {
  const url = projectId ? `${BASE_URL}/graph?project_id=${encodeURIComponent(projectId)}` : `${BASE_URL}/graph`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch graph: ${res.statusText}`);
  return res.json();
}

export async function fetchSchema(): Promise<GraphSchema> {
  const res = await fetch(`${BASE_URL}/schema`);
  if (!res.ok) throw new Error(`Failed to fetch schema: ${res.statusText}`);
  return res.json();
}

export async function askQuestion(query: string, projectContext?: string, sessionId?: string): Promise<QuestionResponse> {
  const res = await fetch(`${BASE_URL}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, project_context: projectContext, session_id: sessionId }),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Query failed with status ${res.status}`);
  }
  return res.json();
}

export async function fetchChatHistory(sessionId: string): Promise<{
  session_id: string;
  messages: Array<{ id: string; role: string; content: string; evidence: any[]; created_at: number }>;
  facts: Array<{ id: string; fact_text: string; entity_ref?: string; created_at: number }>;
}> {
  const res = await fetch(`${BASE_URL}/chat/history?session_id=${encodeURIComponent(sessionId)}`);
  if (!res.ok) throw new Error(`Failed to fetch history: ${res.statusText}`);
  return res.json();
}

export async function clearChatHistory(sessionId: string): Promise<{ success: boolean; session_id: string }> {
  const res = await fetch(`${BASE_URL}/chat/clear?session_id=${encodeURIComponent(sessionId)}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to clear history: ${res.statusText}`);
  return res.json();
}

export async function testConnection(params: {
  host: string;
  port: number;
  username: string;
  password: string;
  ssl: boolean;
  graph_name: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  const res = await fetch(`${BASE_URL}/test-connection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Test failed: ${res.statusText}`);
  return res.json();
}

export async function connectDatabase(params: {
  host: string;
  port: number;
  username: string;
  password: string;
  ssl: boolean;
  graph_name: string;
}): Promise<{ success: boolean; message?: string; error?: string; mode?: string }> {
  const res = await fetch(`${BASE_URL}/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Connection request failed: ${res.statusText}`);
  return res.json();
}

export async function switchDemoMode(): Promise<{ success: boolean; message: string; mode: string }> {
  const res = await fetch(`${BASE_URL}/switch-demo`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Switch failed: ${res.statusText}`);
  return res.json();
}

export async function seedDatabase(): Promise<{
  success: boolean;
  mode: string;
  graph_name: string;
  statements_executed: number;
  nodes_seeded: number;
  edges_seeded: number;
}> {
  const res = await fetch(`${BASE_URL}/seed`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Seed failed: ${res.statusText}`);
  return res.json();
}

export async function executeCypher(cypher: string, params: Record<string, any> = {}): Promise<{
  success: boolean;
  columns?: string[];
  rows?: any[][];
  row_count?: number;
  error?: string;
  mode: string;
}> {
  const res = await fetch(`${BASE_URL}/cypher`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cypher, params }),
  });
  if (!res.ok) throw new Error(`Cypher execution failed: ${res.statusText}`);
  return res.json();
}

export interface RecordMutationResult {
  success: boolean;
  node?: GraphNode;
  deleted_id?: string;
  error?: string;
  error_code?: string;
  mode: string;
  graph_name?: string;
}

async function parseRecordError(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}));
  if (body && typeof body.detail === 'string') return body.detail;
  if (body && typeof body.error === 'string') return body.error;
  return `Request failed with status ${res.status}`;
}

export async function createRecord(label: string, properties: Record<string, any>): Promise<RecordMutationResult> {
  const res = await fetch(`${BASE_URL}/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label, properties }),
  });
  if (!res.ok) throw new Error(await parseRecordError(res));
  return res.json();
}

export async function updateRecord(nodeId: string, label: string, properties: Record<string, any>): Promise<RecordMutationResult> {
  const res = await fetch(`${BASE_URL}/records/${encodeURIComponent(nodeId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label, properties }),
  });
  if (!res.ok) throw new Error(await parseRecordError(res));
  return res.json();
}

export async function deleteRecord(nodeId: string): Promise<RecordMutationResult> {
  const res = await fetch(`${BASE_URL}/records/${encodeURIComponent(nodeId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await parseRecordError(res));
  return res.json();
}
