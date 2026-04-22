/**
 * CellCom CRM — Knowledge Graph SpacetimeDB Module (TypeScript)
 *
 * Tables:
 *   - kg_vertex    : Entities (Contacts, Companies, Deals, etc.)
 *   - kg_edge      : Relationships between entities
 *   - tenant_member: Identity → tenant_id mapping for simple auth
 *
 * Notes on type mappings:
 *   - JSON properties are stored as strings because t.json() is not
 *     available in spacetimedb 2.1 TS modules. Client code should
 *     JSON.stringify / JSON.parse at the boundaries.
 *   - vector_embedding has no fixed-length constraint at the DB layer
 *     (384 dims expected by convention).
 */

import { schema, table, t } from 'spacetimedb/server';

// ---------------------------------------------------------------------------
// Shared enum types
// ---------------------------------------------------------------------------

const entityType = t.enum('EntityType', [
  'Contact',
  'Company',
  'Deal',
  'Message',
  'Invoice',
  'Product',
  'User',
  'WorkflowRun',
]);

const relationType = t.enum('RelationType', [
  'BelongsTo',
  'CommunicatedWith',
  'Purchased',
  'WorksAt',
  'Triggered',
  'RelatedTo',
  'Paid',
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

const kgVertex = table(
  {
    name: 'kg_vertex',
    public: true,
    indexes: [
      {
        accessor: 'tenant_entity',
        algorithm: 'btree',
        columns: ['tenant_id', 'entity_type'],
      },
      {
        accessor: 'tenant_source',
        algorithm: 'btree',
        columns: ['tenant_id', 'source_table', 'source_id'],
      },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    tenant_id: t.u64().index('btree'),
    entity_type: entityType,
    source_table: t.string().index('btree'),
    source_id: t.u64().index('btree'),
    properties: t.string(), // JSON as string
    vector_embedding: t.option(t.array(t.f32())),
    created_at: t.timestamp(),
    updated_at: t.timestamp(),
  }
);

const kgEdge = table(
  {
    name: 'kg_edge',
    public: true,
    indexes: [
      {
        accessor: 'tenant_source_rel',
        algorithm: 'btree',
        columns: ['tenant_id', 'source_vertex_id', 'relation_type'],
      },
      {
        accessor: 'tenant_target_rel',
        algorithm: 'btree',
        columns: ['tenant_id', 'target_vertex_id', 'relation_type'],
      },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    tenant_id: t.u64().index('btree'),
    source_vertex_id: t.u64().index('btree'),
    target_vertex_id: t.u64().index('btree'),
    relation_type: relationType,
    properties: t.string(), // JSON as string
    weight: t.option(t.f32()),
    created_at: t.timestamp(),
  }
);

const tenantMember = table(
  { name: 'tenant_member', public: true },
  {
    identity: t.identity().primaryKey(),
    tenant_id: t.u64().index('btree'),
  }
);

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const spacetimedb = schema({
  kg_vertex: kgVertex,
  kg_edge: kgEdge,
  tenant_member: tenantMember,
});

export default spacetimedb;

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

function requireTenant(ctx: any, tenantId: bigint): void {
  const member = ctx.db.tenant_member.identity.find(ctx.sender);
  if (!member || member.tenant_id !== tenantId) {
    throw new Error('Unauthorized: identity is not a member of this tenant');
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export const init = spacetimedb.init(_ctx => {
  console.info('cellcomcrm kg module initialized');
});

export const onConnect = spacetimedb.clientConnected(_ctx => {
  // No-op
});

export const onDisconnect = spacetimedb.clientDisconnected(_ctx => {
  // No-op
});

// ---------------------------------------------------------------------------
// Vertex reducers
// ---------------------------------------------------------------------------

export const createVertex = spacetimedb.reducer(
  {
    tenant_id: t.u64(),
    entity_type: entityType,
    source_table: t.string(),
    source_id: t.u64(),
    properties: t.string(),
    vector_embedding: t.option(t.array(t.f32())),
  },
  (ctx, { tenant_id, entity_type, source_table, source_id, properties, vector_embedding }) => {
    requireTenant(ctx, tenant_id);

    ctx.db.kg_vertex.insert({
      id: 0n,
      tenant_id,
      entity_type,
      source_table,
      source_id,
      properties,
      vector_embedding,
      created_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });
  }
);

export const updateVertex = spacetimedb.reducer(
  {
    id: t.u64(),
    properties: t.string(),
    vector_embedding: t.option(t.array(t.f32())),
  },
  (ctx, { id, properties, vector_embedding }) => {
    const vertex = ctx.db.kg_vertex.id.find(id);
    if (!vertex) throw new Error('Vertex not found');
    requireTenant(ctx, vertex.tenant_id);

    ctx.db.kg_vertex.id.update({
      ...vertex,
      properties,
      vector_embedding,
      updated_at: ctx.timestamp,
    });
  }
);

export const deleteVertex = spacetimedb.reducer(
  { id: t.u64() },
  (ctx, { id }) => {
    const vertex = ctx.db.kg_vertex.id.find(id);
    if (!vertex) throw new Error('Vertex not found');
    requireTenant(ctx, vertex.tenant_id);

    // Cascade delete all connected edges
    const toDelete: bigint[] = [];
    for (const edge of ctx.db.kg_edge.iter()) {
      if (edge.source_vertex_id === id || edge.target_vertex_id === id) {
        toDelete.push(edge.id);
      }
    }
    for (const edgeId of toDelete) {
      ctx.db.kg_edge.id.delete(edgeId);
    }

    ctx.db.kg_vertex.id.delete(id);
  }
);

// ---------------------------------------------------------------------------
// Edge reducers
// ---------------------------------------------------------------------------

export const createEdge = spacetimedb.reducer(
  {
    tenant_id: t.u64(),
    source_vertex_id: t.u64(),
    target_vertex_id: t.u64(),
    relation_type: relationType,
    properties: t.string(),
    weight: t.option(t.f32()),
  },
  (ctx, { tenant_id, source_vertex_id, target_vertex_id, relation_type, properties, weight }) => {
    requireTenant(ctx, tenant_id);

    const src = ctx.db.kg_vertex.id.find(source_vertex_id);
    const tgt = ctx.db.kg_vertex.id.find(target_vertex_id);
    if (!src || !tgt) throw new Error('Source or target vertex not found');
    if (src.tenant_id !== tenant_id || tgt.tenant_id !== tenant_id) {
      throw new Error('Vertices do not belong to the specified tenant');
    }

    ctx.db.kg_edge.insert({
      id: 0n,
      tenant_id,
      source_vertex_id,
      target_vertex_id,
      relation_type,
      properties,
      weight,
      created_at: ctx.timestamp,
    });
  }
);

export const updateEdge = spacetimedb.reducer(
  {
    id: t.u64(),
    properties: t.string(),
    weight: t.option(t.f32()),
  },
  (ctx, { id, properties, weight }) => {
    const edge = ctx.db.kg_edge.id.find(id);
    if (!edge) throw new Error('Edge not found');
    requireTenant(ctx, edge.tenant_id);

    ctx.db.kg_edge.id.update({
      ...edge,
      properties,
      weight,
    });
  }
);

export const deleteEdge = spacetimedb.reducer(
  { id: t.u64() },
  (ctx, { id }) => {
    const edge = ctx.db.kg_edge.id.find(id);
    if (!edge) throw new Error('Edge not found');
    requireTenant(ctx, edge.tenant_id);

    ctx.db.kg_edge.id.delete(id);
  }
);

// ---------------------------------------------------------------------------
// Graph operations
// ---------------------------------------------------------------------------

export const mergeVertices = spacetimedb.reducer(
  {
    source_id: t.u64(),
    target_id: t.u64(),
  },
  (ctx, { source_id, target_id }) => {
    if (source_id === target_id) {
      throw new Error('Cannot merge a vertex into itself');
    }

    const source = ctx.db.kg_vertex.id.find(source_id);
    const target = ctx.db.kg_vertex.id.find(target_id);
    if (!source || !target) throw new Error('Vertex not found');
    requireTenant(ctx, source.tenant_id);
    if (source.tenant_id !== target.tenant_id) {
      throw new Error('Vertices belong to different tenants');
    }

    // Collect edges touching the source vertex
    const edgesToRewire = [];
    for (const edge of ctx.db.kg_edge.iter()) {
      if (edge.source_vertex_id === source_id || edge.target_vertex_id === source_id) {
        edgesToRewire.push(edge);
      }
    }

    for (const edge of edgesToRewire) {
      const newSource = edge.source_vertex_id === source_id ? target_id : edge.source_vertex_id;
      const newTarget = edge.target_vertex_id === source_id ? target_id : edge.target_vertex_id;

      if (newSource === newTarget) {
        // Would become a self-loop; delete instead
        ctx.db.kg_edge.id.delete(edge.id);
      } else {
        ctx.db.kg_edge.id.update({
          ...edge,
          source_vertex_id: newSource,
          target_vertex_id: newTarget,
        });
      }
    }

    ctx.db.kg_vertex.id.delete(source_id);
  }
);

export const findNeighbors = spacetimedb.reducer(
  {
    vertex_id: t.u64(),
    relation_type: t.option(relationType),
  },
  (ctx, { vertex_id, relation_type }) => {
    const vertex = ctx.db.kg_vertex.id.find(vertex_id);
    if (!vertex) throw new Error('Vertex not found');
    requireTenant(ctx, vertex.tenant_id);

    const neighbors: bigint[] = [];
    for (const edge of ctx.db.kg_edge.iter()) {
      const touchesVertex =
        edge.tenant_id === vertex.tenant_id &&
        (edge.source_vertex_id === vertex_id || edge.target_vertex_id === vertex_id);
      if (!touchesVertex) continue;
      if (relation_type !== undefined && edge.relation_type !== relation_type) continue;

      neighbors.push(
        edge.source_vertex_id === vertex_id ? edge.target_vertex_id : edge.source_vertex_id
      );
    }

    console.info(
      `Neighbors of vertex ${vertex_id} (relation ${relation_type}): ${JSON.stringify(neighbors)}`
    );
  }
);

export const bfsTraverse = spacetimedb.reducer(
  {
    start_vertex_id: t.u64(),
    max_depth: t.u32(),
    relation_type: t.option(relationType),
  },
  (ctx, { start_vertex_id, max_depth, relation_type }) => {
    const start = ctx.db.kg_vertex.id.find(start_vertex_id);
    if (!start) throw new Error('Start vertex not found');
    requireTenant(ctx, start.tenant_id);

    const visited = new Set<bigint>();
    const queue: [bigint, number][] = [[start_vertex_id, 0]];
    const results: [bigint, number][] = [];

    visited.add(start_vertex_id);

    while (queue.length > 0) {
      const [currentId, depth] = queue.shift()!;
      if (depth > max_depth) continue;
      results.push([currentId, depth]);

      for (const edge of ctx.db.kg_edge.iter()) {
        if (edge.tenant_id !== start.tenant_id) continue;
        if (relation_type !== undefined && edge.relation_type !== relation_type) continue;

        const isSource = edge.source_vertex_id === currentId;
        const isTarget = edge.target_vertex_id === currentId;
        if (!isSource && !isTarget) continue;

        const neighborId = isSource ? edge.target_vertex_id : edge.source_vertex_id;
        if (!visited.has(neighborId) && depth < max_depth) {
          visited.add(neighborId);
          queue.push([neighborId, depth + 1]);
        }
      }
    }

    console.info(
      `BFS from ${start_vertex_id} (depth ${max_depth}): ${JSON.stringify(results)}`
    );
  }
);

// ---------------------------------------------------------------------------
// Tenant membership admin
// ---------------------------------------------------------------------------

export const addTenantMember = spacetimedb.reducer(
  {
    identity: t.identity(),
    tenant_id: t.u64(),
  },
  (ctx, { identity, tenant_id }) => {
    // In a real deployment, gate this to an admin / module owner.
    ctx.db.tenant_member.insert({ identity, tenant_id });
  }
);
