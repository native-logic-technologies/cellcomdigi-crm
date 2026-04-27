import Database, { type Database as DatabaseType, type Statement } from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = process.env.ARCHIVE_DATA_DIR || '/workspace/cellcomcrm/data';
const DB_PATH = join(DATA_DIR, 'archive.db');
export const FILES_DIR = join(DATA_DIR, 'files');
export const EMBEDDINGS_DIR = join(DATA_DIR, 'embeddings');

mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(FILES_DIR, { recursive: true });
mkdirSync(EMBEDDINGS_DIR, { recursive: true });

export const db: DatabaseType = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -16000'); // 16MB page cache

// Messages — primary offload target (fastest-growing table)
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY,
    tenant_id INTEGER NOT NULL,
    conversation_id INTEGER NOT NULL,
    sender TEXT NOT NULL,
    sender_id INTEGER,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_messages_tenant ON messages(tenant_id, created_at DESC);
`);

// Activities — append-only log, grows forever
db.exec(`
  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY,
    tenant_id INTEGER NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_activities_entity ON activities(entity_type, entity_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_activities_tenant ON activities(tenant_id, created_at DESC);
`);

// Memory content — offloaded from memory_collections
db.exec(`
  CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY,
    tenant_id INTEGER NOT NULL,
    collection_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_memories_collection ON memories(collection_id);
`);

// Archive metadata — tracks what has been archived from SpacetimeDB
db.exec(`
  CREATE TABLE IF NOT EXISTS archive_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    table_name TEXT NOT NULL,
    row_id INTEGER NOT NULL,
    archived_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_archive_log_unique ON archive_log(tenant_id, table_name, row_id);
`);

// Document metadata (content stored on filesystem)
db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY,
    tenant_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    summary TEXT,
    keywords TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);



// ---- Prepared statements for hot paths ----

export const insertMessage: Statement = db.prepare(`
  INSERT OR REPLACE INTO messages (id, tenant_id, conversation_id, sender, sender_id, body, created_at)
  VALUES (@id, @tenant_id, @conversation_id, @sender, @sender_id, @body, @created_at)
`);

export const getMessagesByConversation: Statement = db.prepare(`
  SELECT * FROM messages
  WHERE conversation_id = @conversation_id
  ORDER BY created_at DESC
  LIMIT @limit OFFSET @offset
`);

export const countMessagesByConversation: Statement = db.prepare(`
  SELECT COUNT(*) as count FROM messages WHERE conversation_id = @conversation_id
`);

export const deleteMessage: Statement = db.prepare(`
  DELETE FROM messages WHERE id = @id AND tenant_id = @tenant_id
`);

export const insertActivity: Statement = db.prepare(`
  INSERT OR REPLACE INTO activities (id, tenant_id, entity_type, entity_id, action, description, created_at)
  VALUES (@id, @tenant_id, @entity_type, @entity_id, @action, @description, @created_at)
`);

export const getActivitiesByEntity: Statement = db.prepare(`
  SELECT * FROM activities
  WHERE entity_type = @entity_type AND entity_id = @entity_id
  ORDER BY created_at DESC
  LIMIT @limit OFFSET @offset
`);

export const insertMemory: Statement = db.prepare(`
  INSERT OR REPLACE INTO memories (id, tenant_id, collection_id, content, created_at)
  VALUES (@id, @tenant_id, @collection_id, @content, @created_at)
`);

export const getMemoryByCollection: Statement = db.prepare(`
  SELECT * FROM memories WHERE collection_id = @collection_id ORDER BY created_at DESC
`);

export const logArchive: Statement = db.prepare(`
  INSERT OR IGNORE INTO archive_log (tenant_id, table_name, row_id)
  VALUES (@tenant_id, @table_name, @row_id)
`);

export const isArchived: Statement = db.prepare(`
  SELECT 1 FROM archive_log WHERE tenant_id = @tenant_id AND table_name = @table_name AND row_id = @row_id
`);

export const getArchiveStats: Statement = db.prepare(`
  SELECT table_name, COUNT(*) as count FROM archive_log WHERE tenant_id = @tenant_id GROUP BY table_name
`);

export const insertDocumentMeta: Statement = db.prepare(`
  INSERT OR REPLACE INTO documents (id, tenant_id, title, file_type, file_size, summary, keywords, created_at, updated_at)
  VALUES (@id, @tenant_id, @title, @file_type, @file_size, @summary, @keywords, @created_at, @updated_at)
`);

export const getDocumentMeta: Statement = db.prepare(`
  SELECT * FROM documents WHERE id = @id AND tenant_id = @tenant_id
`);
