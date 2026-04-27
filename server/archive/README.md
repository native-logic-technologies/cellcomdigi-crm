# CellCom CRM Archive Service

SSD-based archival layer that offloads append-only and large-text data from SpacetimeDB RAM to disk. Designed for 8–16GB VPS deployments where SpacetimeDB's fully in-memory + WAL architecture would eventually exhaust RAM.

## What Gets Offloaded

| Data Type | RAM (SpacetimeDB) | SSD (Archive) | Notes |
|-----------|-------------------|---------------|-------|
| **Message history** | Recent 7 days only | Full history (SQLite) | Fastest-growing table |
| **Activities** | Recent 30 days | Full log (SQLite) | Append-only, grows forever |
| **Memory content** | Metadata only | Full text (SQLite) | AI-generated notes |
| **Document text** | Metadata only | Full content (filesystem) | Scraped/uploaded docs |
| **KG embeddings** | None | Float32 arrays (filesystem) | ~1.5–6KB per vertex |

## Architecture

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│   React Client  │◄──────────────────►│  SpacetimeDB    │  RAM (~350MB now)
│                 │                    │  (in-memory)    │
│  • Inbox reads  │     HTTP 3002      │  • Hot data     │
│    merged from  │◄──────────────────►│  • Recent msgs  │
│    both sources │                    │  • Metadata     │
└─────────────────┘                    └─────────────────┘
         │                                      ▲
         │ HTTP 3002                            │ reducer calls
         ▼                                      │
┌─────────────────┐                    ┌─────────────────┐
│ Archive Service │                    │  WASM Module    │
│   (Node.js)     │                    │  (reducers)     │
│                 │                    │                 │
│  SQLite DB      │                    │  archiveMessages│
│  Filesystem     │                    │  pruneOldActivities
│  • messages     │                    │  deleteMessagesBatch
│  • activities   │                    │                 │
│  • memories     │                    └─────────────────┘
│  • documents    │
│  • embeddings   │
└─────────────────┘
```

## Quick Start

```bash
cd /workspace/cellcomcrm/server/archive
npm install
npm run build
npm start
```

Service listens on `http://127.0.0.1:3002` by default.

## Systemd

```bash
cp cellcomcrm-archive.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable cellcomcrm-archive
systemctl start cellcomcrm-archive
systemctl status cellcomcrm-archive
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ARCHIVE_PORT` | `3002` | HTTP port |
| `ARCHIVE_HOST` | `0.0.0.0` | Bind address |
| `ARCHIVE_DATA_DIR` | `/workspace/cellcomcrm/data` | SQLite + files root |

## Client Integration

The Inbox component (`client/src/components/Inbox.tsx`) now:
1. Reads **recent messages** from SpacetimeDB subscription (real-time)
2. Reads **archived messages** from the archive API on conversation select
3. Merges both sources, deduplicating by message ID
4. Archives are indicated with a small green dot

## Manual Archival Workflow

To free RAM by moving old messages to SSD:

1. **Client archives messages** (calls archive API):
   ```ts
   import { archiveMessagesBatch } from './services/archiveApi';
   // Send old messages to archive API
   await archiveMessagesBatch(oldMessages);
   ```

2. **Client deletes from SpacetimeDB** (calls reducer):
   ```ts
   db.reducers.archiveMessages({ tenantId: 1n, daysOld: 7 });
   // or
   db.reducers.deleteMessagesBatch({ tenantId: 1n, messageIds: [...] });
   ```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health + message count |
| POST | `/messages` | Store single message |
| POST | `/messages/batch` | Batch store messages |
| GET | `/messages/:conversation_id` | List messages (oldest first) |
| GET | `/messages/:conversation_id/count` | Count messages |
| DELETE | `/messages/:id` | Delete message |
| POST | `/activities/batch` | Batch archive activities |
| GET | `/activities/:entity_type/:entity_id` | List activities |
| POST | `/memories` | Store memory content |
| GET | `/memories/:collection_id` | List memories |
| POST | `/documents/:id` | Store document content |
| GET | `/documents/:id` | Retrieve document |
| DELETE | `/documents/:id` | Delete document |
| POST | `/embeddings/:vertex_id` | Store embedding vector |
| GET | `/embeddings/:vertex_id` | Retrieve embedding |
| DELETE | `/embeddings/:vertex_id` | Delete embedding |
| GET | `/archive/stats` | Archive statistics |

## Disk Usage Estimates

| Scenario | Messages | Activities | Documents | Embeddings | Total SSD |
|----------|----------|------------|-----------|------------|-----------|
| Small SME (1yr) | ~50K | ~20K | 100 | 1K | ~200MB |
| Mid-size (1yr) | ~200K | ~80K | 500 | 5K | ~800MB |
| Large (1yr) | ~1M | ~400K | 2K | 20K | ~4GB |
| Enterprise (1yr) | ~5M | ~2M | 10K | 100K | ~20GB |

With 96GB SSD, you have headroom for 3–5 years of enterprise data.

## Future: Auto-Archival Worker

A background Node.js worker can subscribe to SpacetimeDB and automatically archive + delete messages older than N days. This requires the `spacetimedb` client SDK in Node.js. Skeleton:

```ts
// worker.ts — connect via WebSocket, subscribe to messages,
// archive old ones to SQLite, call deleteMessagesBatch reducer
```

For now, archival is client-triggered or manual via the reducers.

## Monitoring

```bash
# Archive service health
curl -s http://localhost:3002/health | jq

# Archive stats
curl -s 'http://localhost:3002/archive/stats?tenant_id=1' | jq

# Disk usage
du -sh /workspace/cellcomcrm/data/
du -sh /workspace/cellcomcrm/data/archive.db
```
