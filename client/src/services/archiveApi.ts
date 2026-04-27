/**
 * Archive API client — offloads message history, activities, and documents
 * from SpacetimeDB RAM to SSD (SQLite + filesystem).
 *
 * Architecture:
 *   - SpacetimeDB (RAM): recent messages (~last 7 days), metadata, hot data
 *   - Archive Service (SSD): full message history, old activities, documents, embeddings
 *
 * The archive service runs on port 3002 (configurable via VITE_ARCHIVE_URL).
 */

const ENV_URL = (import.meta as any).env?.VITE_ARCHIVE_URL;
// Use relative /archive path when served from production domain, else localhost:3002
const ARCHIVE_URL = ENV_URL || (typeof window !== 'undefined' && window.location.origin.includes('lariscrm.com')
  ? '/archive'
  : 'http://localhost:3002');

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ARCHIVE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Archive API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ---- Messages ----

export interface ArchiveMessage {
  id: number;
  tenant_id: number;
  conversation_id: number;
  sender: string;
  sender_id?: number;
  body: string;
  created_at: number;
}

export async function archiveMessage(msg: ArchiveMessage): Promise<{ ok: boolean }> {
  return api('/messages', { method: 'POST', body: JSON.stringify(msg) });
}

export async function archiveMessagesBatch(msgs: ArchiveMessage[]): Promise<{ ok: boolean; count: number }> {
  return api('/messages/batch', { method: 'POST', body: JSON.stringify({ messages: msgs }) });
}

export async function getArchivedMessages(
  conversationId: number,
  options?: { limit?: number; offset?: number }
): Promise<{ messages: ArchiveMessage[] }> {
  const q = new URLSearchParams();
  if (options?.limit) q.set('limit', String(options.limit));
  if (options?.offset) q.set('offset', String(options.offset));
  return api(`/messages/${conversationId}?${q}`);
}

export async function countArchivedMessages(conversationId: number): Promise<{ count: number }> {
  return api(`/messages/${conversationId}/count`);
}

export async function deleteArchivedMessage(id: number, tenantId: number): Promise<{ ok: boolean }> {
  return api(`/messages/${id}?tenant_id=${tenantId}`, { method: 'DELETE' });
}

// ---- Activities ----

export interface ArchiveActivity {
  id: number;
  tenant_id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  description?: string;
  created_at: number;
}

export async function archiveActivitiesBatch(acts: ArchiveActivity[]): Promise<{ ok: boolean; count: number }> {
  return api('/activities/batch', { method: 'POST', body: JSON.stringify({ activities: acts }) });
}

export async function getArchivedActivities(
  entityType: string,
  entityId: number,
  options?: { limit?: number; offset?: number }
): Promise<{ activities: ArchiveActivity[] }> {
  const q = new URLSearchParams();
  if (options?.limit) q.set('limit', String(options.limit));
  if (options?.offset) q.set('offset', String(options.offset));
  return api(`/activities/${entityType}/${entityId}?${q}`);
}

// ---- Memories ----

export async function archiveMemory(data: {
  id: number;
  tenant_id: number;
  collection_id: number;
  content: string;
  created_at: number;
}): Promise<{ ok: boolean }> {
  return api('/memories', { method: 'POST', body: JSON.stringify(data) });
}

export async function getArchivedMemories(collectionId: number): Promise<{ memories: any[] }> {
  return api(`/memories/${collectionId}`);
}

// ---- Documents (content on filesystem) ----

export async function archiveDocument(
  id: number,
  data: {
    tenant_id: number;
    title: string;
    file_type?: string;
    content: string;
    summary?: string;
    keywords?: string;
  }
): Promise<{ ok: boolean; filePath: string }> {
  return api(`/documents/${id}`, { method: 'POST', body: JSON.stringify(data) });
}

export async function getArchivedDocument(id: number, tenantId: number): Promise<any> {
  return api(`/documents/${id}?tenant_id=${tenantId}`);
}

export async function deleteArchivedDocument(id: number, tenantId: number): Promise<{ ok: boolean }> {
  return api(`/documents/${id}?tenant_id=${tenantId}`, { method: 'DELETE' });
}

// ---- Embeddings ----

export async function archiveEmbedding(
  vertexId: number,
  data: { tenant_id: number; vector: number[] }
): Promise<{ ok: boolean; dimensions: number; bytes: number }> {
  return api(`/embeddings/${vertexId}`, { method: 'POST', body: JSON.stringify(data) });
}

export async function getArchivedEmbedding(vertexId: number): Promise<{
  vertex_id: number;
  dimensions: number;
  vector: number[];
}> {
  return api(`/embeddings/${vertexId}`);
}

export async function deleteArchivedEmbedding(vertexId: number): Promise<{ ok: boolean }> {
  return api(`/embeddings/${vertexId}`, { method: 'DELETE' });
}

// ---- Archive log / stats ----

export async function logArchiveBatch(
  tenantId: number,
  tableName: string,
  rowIds: number[]
): Promise<{ ok: boolean; count: number }> {
  return api('/archive/log', {
    method: 'POST',
    body: JSON.stringify({ tenant_id: tenantId, table_name: tableName, row_ids: rowIds }),
  });
}

export async function getArchiveStats(tenantId: number): Promise<{
  archive_log: { table_name: string; count: number }[];
  messages: number;
  activities: number;
  memories: number;
}> {
  return api(`/archive/stats?tenant_id=${tenantId}`);
}

// ---- Health ----

export async function archiveHealth(): Promise<{ status: string; messages: number }> {
  return api('/health');
}
