import Fastify from 'fastify';
import { writeFileSync, readFileSync, existsSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  db,
  FILES_DIR,
  EMBEDDINGS_DIR,
  insertMessage,
  getMessagesByConversation,
  countMessagesByConversation,
  deleteMessage,
  insertActivity,
  getActivitiesByEntity,
  insertMemory,
  getMemoryByCollection,
  logArchive,
  isArchived,
  getArchiveStats,
  insertDocumentMeta,
  getDocumentMeta,
} from './db';

const PORT = parseInt(process.env.ARCHIVE_PORT || '3002', 10);
const HOST = process.env.ARCHIVE_HOST || '0.0.0.0';

const app = Fastify({ logger: { level: 'warn' } });

// ---- Health ----
app.get('/health', async () => {
  const stats = db.prepare("SELECT COUNT(*) as messages FROM messages").get() as { messages: number };
  return { status: 'ok', messages: stats.messages };
});

// ---- Messages ----

interface MessageBody {
  id: number;
  tenant_id: number;
  conversation_id: number;
  sender: string;
  sender_id?: number;
  body: string;
  created_at: number;
}

app.post<{ Body: MessageBody }>('/messages', async (req, reply) => {
  const b = req.body;
  insertMessage.run({
    id: b.id,
    tenant_id: b.tenant_id,
    conversation_id: b.conversation_id,
    sender: b.sender,
    sender_id: b.sender_id ?? null,
    body: b.body,
    created_at: b.created_at,
  });
  return { ok: true };
});

app.post<{ Body: { messages: MessageBody[] } }>('/messages/batch', async (req, reply) => {
  const batch = db.transaction((msgs: MessageBody[]) => {
    for (const b of msgs) {
      insertMessage.run({
        id: b.id,
        tenant_id: b.tenant_id,
        conversation_id: b.conversation_id,
        sender: b.sender,
        sender_id: b.sender_id ?? null,
        body: b.body,
        created_at: b.created_at,
      });
    }
  });
  batch(req.body.messages);
  return { ok: true, count: req.body.messages.length };
});

app.get<{
  Params: { conversation_id: string };
  Querystring: { limit?: string; offset?: string };
}>('/messages/:conversation_id', async (req, reply) => {
  const convId = parseInt(req.params.conversation_id, 10);
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 500);
  const offset = parseInt(req.query.offset || '0', 10);
  const rows = getMessagesByConversation.all({
    conversation_id: convId,
    limit,
    offset,
  }) as any[];
  return { messages: rows.reverse() }; // oldest first for chat UI
});

app.get<{
  Params: { conversation_id: string };
}>('/messages/:conversation_id/count', async (req) => {
  const convId = parseInt(req.params.conversation_id, 10);
  const row = countMessagesByConversation.get({ conversation_id: convId }) as { count: number };
  return { count: row.count };
});

app.delete<{
  Params: { id: string };
  Querystring: { tenant_id: string };
}>('/messages/:id', async (req) => {
  const id = parseInt(req.params.id, 10);
  const tenantId = parseInt(req.query.tenant_id, 10);
  deleteMessage.run({ id, tenant_id: tenantId });
  return { ok: true };
});

// ---- Activities ----

interface ActivityBody {
  id: number;
  tenant_id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  description?: string;
  created_at: number;
}

app.post<{ Body: { activities: ActivityBody[] } }>('/activities/batch', async (req) => {
  const batch = db.transaction((acts: ActivityBody[]) => {
    for (const b of acts) {
      insertActivity.run({
        id: b.id,
        tenant_id: b.tenant_id,
        entity_type: b.entity_type,
        entity_id: b.entity_id,
        action: b.action,
        description: b.description ?? null,
        created_at: b.created_at,
      });
    }
  });
  batch(req.body.activities);
  return { ok: true, count: req.body.activities.length };
});

app.get<{
  Params: { entity_type: string; entity_id: string };
  Querystring: { limit?: string; offset?: string };
}>('/activities/:entity_type/:entity_id', async (req) => {
  const entityId = parseInt(req.params.entity_id, 10);
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 500);
  const offset = parseInt(req.query.offset || '0', 10);
  const rows = getActivitiesByEntity.all({
    entity_type: req.params.entity_type,
    entity_id: entityId,
    limit,
    offset,
  }) as any[];
  return { activities: rows };
});

// ---- Memories ----

app.post<{
  Body: { id: number; tenant_id: number; collection_id: number; content: string; created_at: number };
}>('/memories', async (req) => {
  const b = req.body;
  insertMemory.run({
    id: b.id,
    tenant_id: b.tenant_id,
    collection_id: b.collection_id,
    content: b.content,
    created_at: b.created_at,
  });
  return { ok: true };
});

app.get<{ Params: { collection_id: string } }>('/memories/:collection_id', async (req) => {
  const cid = parseInt(req.params.collection_id, 10);
  const rows = getMemoryByCollection.all({ collection_id: cid }) as any[];
  return { memories: rows };
});

// ---- Documents (content on filesystem, metadata in SQLite) ----

app.post<{
  Params: { id: string };
  Body: { tenant_id: number; title: string; file_type?: string; content: string; summary?: string; keywords?: string };
}>('/documents/:id', async (req) => {
  const id = parseInt(req.params.id, 10);
  const b = req.body;
  const now = Date.now();
  const filePath = join(FILES_DIR, `${id}.txt`);
  writeFileSync(filePath, b.content, 'utf-8');
  insertDocumentMeta.run({
    id,
    tenant_id: b.tenant_id,
    title: b.title,
    file_type: b.file_type ?? null,
    file_size: Buffer.byteLength(b.content, 'utf-8'),
    summary: b.summary ?? null,
    keywords: b.keywords ?? null,
    created_at: now,
    updated_at: now,
  });
  return { ok: true, filePath };
});

app.get<{ Params: { id: string }; Querystring: { tenant_id: string } }>('/documents/:id', async (req, reply) => {
  const id = parseInt(req.params.id, 10);
  const tenantId = parseInt(req.query.tenant_id, 10);
  const meta = getDocumentMeta.get({ id, tenant_id: tenantId }) as any;
  if (!meta) return reply.code(404).send({ error: 'not found' });
  const filePath = join(FILES_DIR, `${id}.txt`);
  if (!existsSync(filePath)) return reply.code(404).send({ error: 'content missing' });
  const content = readFileSync(filePath, 'utf-8');
  return { ...meta, content };
});

app.delete<{ Params: { id: string }; Querystring: { tenant_id: string } }>('/documents/:id', async (req) => {
  const id = parseInt(req.params.id, 10);
  const tenantId = parseInt(req.query.tenant_id, 10);
  const filePath = join(FILES_DIR, `${id}.txt`);
  if (existsSync(filePath)) unlinkSync(filePath);
  db.prepare('DELETE FROM documents WHERE id = ? AND tenant_id = ?').run(id, tenantId);
  return { ok: true };
});

// ---- Embeddings (float32 arrays as binary files) ----

app.post<{
  Params: { vertex_id: string };
  Body: { tenant_id: number; vector: number[] };
}>('/embeddings/:vertex_id', async (req) => {
  const vertexId = parseInt(req.params.vertex_id, 10);
  const { tenant_id, vector } = req.body;
  const buf = Buffer.from(new Float32Array(vector).buffer);
  const filePath = join(EMBEDDINGS_DIR, `${vertexId}.bin`);
  writeFileSync(filePath, buf);
  db.prepare(`
    INSERT OR REPLACE INTO archive_log (tenant_id, table_name, row_id) VALUES (?, 'embeddings', ?)
  `).run(tenant_id, vertexId);
  return { ok: true, dimensions: vector.length, bytes: buf.length };
});

app.get<{ Params: { vertex_id: string } }>('/embeddings/:vertex_id', async (req, reply) => {
  const vertexId = parseInt(req.params.vertex_id, 10);
  const filePath = join(EMBEDDINGS_DIR, `${vertexId}.bin`);
  if (!existsSync(filePath)) return reply.code(404).send({ error: 'not found' });
  const buf = readFileSync(filePath);
  const floats = Array.from(new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4));
  return { vertex_id: vertexId, dimensions: floats.length, vector: floats };
});

app.delete<{ Params: { vertex_id: string } }>('/embeddings/:vertex_id', async (req) => {
  const vertexId = parseInt(req.params.vertex_id, 10);
  const filePath = join(EMBEDDINGS_DIR, `${vertexId}.bin`);
  if (existsSync(filePath)) unlinkSync(filePath);
  db.prepare("DELETE FROM archive_log WHERE table_name = 'embeddings' AND row_id = ?").run(vertexId);
  return { ok: true };
});

// ---- Archive log / stats ----

app.post<{
  Body: { tenant_id: number; table_name: string; row_ids: number[] };
}>('/archive/log', async (req) => {
  const { tenant_id, table_name, row_ids } = req.body;
  const batch = db.transaction((ids: number[]) => {
    for (const row_id of ids) {
      logArchive.run({ tenant_id, table_name, row_id });
    }
  });
  batch(row_ids);
  return { ok: true, count: row_ids.length };
});

app.get<{ Querystring: { tenant_id: string } }>('/archive/stats', async (req) => {
  const tenantId = parseInt(req.query.tenant_id, 10);
  const rows = getArchiveStats.all({ tenant_id: tenantId }) as any[];
  const msgCount = db.prepare('SELECT COUNT(*) as c FROM messages WHERE tenant_id = ?').get(tenantId) as { c: number };
  const actCount = db.prepare('SELECT COUNT(*) as c FROM activities WHERE tenant_id = ?').get(tenantId) as { c: number };
  const memCount = db.prepare('SELECT COUNT(*) as c FROM memories WHERE tenant_id = ?').get(tenantId) as { c: number };
  return {
    archive_log: rows,
    messages: msgCount.c,
    activities: actCount.c,
    memories: memCount.c,
  };
});

// ---- Start ----
app.listen({ port: PORT, host: HOST }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`📦 Archive service listening on http://${HOST}:${PORT}`);
  console.log(`   DB: ${join(process.env.ARCHIVE_DATA_DIR || '/workspace/cellcomcrm/data', 'archive.db')}`);
  console.log(`   Files: ${FILES_DIR}`);
  console.log(`   Embeddings: ${EMBEDDINGS_DIR}`);
});
