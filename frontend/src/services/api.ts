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

export async function askQuestion(query: string, projectContext?: string): Promise<QuestionResponse> {
  const res = await fetch(`${BASE_URL}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, project_context: projectContext }),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Query failed with status ${res.status}`);
  }
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
