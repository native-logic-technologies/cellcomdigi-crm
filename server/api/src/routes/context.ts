import type { FastifyInstance } from 'fastify';
import { graphStore } from '../graphStore.js';
import type { ApiResponse, KgVertex, KgEdge, GraphContext } from '../types.js';

function parseProperties(v: KgVertex): Record<string, any> {
  try {
    return JSON.parse(v.properties);
  } catch {
    return {};
  }
}

function formatVertex(v: KgVertex, indent = ''): string {
  const props = parseProperties(v);
  const lines: string[] = [];
  lines.push(`${indent}[${v.entityType.tag}] ${props.title || v.sourceTable + '#' + v.sourceId}`);
  if (props.summary) lines.push(`${indent}  Summary: ${props.summary}`);
  if (props.extracted_facts?.length) {
    for (const fact of props.extracted_facts) {
      lines.push(`${indent}  • ${fact}`);
    }
  }
  if (props.content_text && props.content_text.length > 50) {
    lines.push(
      `${indent}  Content: ${props.content_text.slice(0, 200)}${props.content_text.length > 200 ? '...' : ''}`
    );
  }
  return lines.join('\n');
}

function buildEntityContext(
  sourceTable: string,
  sourceId: bigint,
  tenantId: bigint
): GraphContext {
  const vertex = graphStore.getVertexBySource(tenantId, sourceTable, sourceId);

  if (!vertex) {
    return {
      target: null as any,
      container: null,
      neighbors: [],
      memories: [],
      documents: [],
      similar: [],
      formatted: `${sourceTable} #${sourceId} not found in knowledge graph.`,
    };
  }

  // Find container (AutoContact / AutoCompany / AutoDeal)
  const neighbors = graphStore.getNeighbors(vertex.id, { depth: 1, direction: 'both' });
  const neighborVertices = new Map<bigint, { vertex: KgVertex; edges: KgEdge[] }>();

  for (const n of neighbors) {
    const existing = neighborVertices.get(n.vertex.id);
    if (existing) {
      existing.edges.push(n.edge);
    } else {
      neighborVertices.set(n.vertex.id, { vertex: n.vertex, edges: [n.edge] });
    }
  }

  const container = Array.from(neighborVertices.values()).find(
    (n) =>
      n.vertex.entityType.tag === 'Container' &&
      n.edges.some((e) => e.relationType.tag === 'ContainedIn')
  )?.vertex || null;

  const memories: KgVertex[] = [];
  const documents: KgVertex[] = [];
  const similar: KgVertex[] = [];

  for (const { vertex: v, edges } of neighborVertices.values()) {
    if (v.entityType.tag === 'Memory') memories.push(v);
    if (v.entityType.tag === 'Document') documents.push(v);
    if (edges.some((e) => e.relationType.tag === 'SimilarTo')) similar.push(v);
  }

  // Format as structured Markdown
  const lines: string[] = [];
  lines.push(`# ${sourceTable.charAt(0).toUpperCase() + sourceTable.slice(1)} Intelligence: ${parseProperties(vertex).title || '#' + sourceId}`);
  lines.push('');
  lines.push(formatVertex(vertex));
  lines.push('');

  if (container) {
    lines.push(`## Intelligence Container`);
    lines.push(formatVertex(container, '> '));
    lines.push('');
  }

  const companyNeighbor = Array.from(neighborVertices.values()).find(
    (n) => n.vertex.entityType.tag === 'Company'
  );
  if (companyNeighbor) {
    lines.push(`## Company`);
    lines.push(formatVertex(companyNeighbor.vertex, '> '));
    lines.push('');
  }

  const dealNeighbors = Array.from(neighborVertices.values()).filter(
    (n) => n.vertex.entityType.tag === 'Deal'
  );
  if (dealNeighbors.length) {
    lines.push(`## Active Deals (${dealNeighbors.length})`);
    for (const d of dealNeighbors.slice(0, 5)) {
      lines.push(formatVertex(d.vertex, '> '));
    }
    lines.push('');
  }

  const activityNeighbors = Array.from(neighborVertices.values()).filter(
    (n) => n.vertex.entityType.tag === 'Activity'
  );
  if (activityNeighbors.length) {
    lines.push(`## Recent Activities (${activityNeighbors.length})`);
    for (const a of activityNeighbors.slice(0, 5)) {
      lines.push(formatVertex(a.vertex, '> '));
    }
    lines.push('');
  }

  const messageNeighbors = Array.from(neighborVertices.values()).filter(
    (n) => n.vertex.entityType.tag === 'Message'
  );
  if (messageNeighbors.length) {
    lines.push(`## Recent Messages (${messageNeighbors.length})`);
    for (const m of messageNeighbors.slice(0, 5)) {
      lines.push(formatVertex(m.vertex, '> '));
    }
    lines.push('');
  }

  if (memories.length) {
    lines.push(`## Memories & Insights (${memories.length})`);
    for (const m of memories.slice(0, 5)) {
      lines.push(formatVertex(m, '> '));
    }
    lines.push('');
  }

  if (documents.length) {
    lines.push(`## Documents (${documents.length})`);
    for (const d of documents.slice(0, 3)) {
      lines.push(formatVertex(d, '> '));
    }
    lines.push('');
  }

  return {
    target: vertex,
    container,
    neighbors: Array.from(neighborVertices.values()).map(({ vertex, edges }) => ({
      vertex,
      edges,
      distance: 1,
    })),
    memories,
    documents,
    similar,
    formatted: lines.join('\n'),
  };
}

export async function contextRoutes(fastify: FastifyInstance) {
  fastify.get('/v1/graph/context/:entityType/:sourceId', async (request, reply) => {
    const start = performance.now();
    const { entityType, sourceId } = request.params as { entityType: string; sourceId: string };
    const query = request.query as { tenant_id?: string };

    const tenantId = query.tenant_id ? BigInt(query.tenant_id) : 1n;
    // Map entity type to source table name
    const entityToTable: Record<string, string> = {
      Contact: 'contacts',
      Company: 'companies',
      Deal: 'deals',
      Message: 'messages',
      Invoice: 'invoices',
      Product: 'products',
      User: 'users',
      WorkflowRun: 'workflow_executions',
      Payment: 'payments',
      Activity: 'activities',
      Conversation: 'conversations',
      Document: 'documents',
      Memory: 'memories',
      Container: 'memory_collections',
      ContentFragment: 'documents',
      SocialPost: 'social_posts',
      SocialCampaign: 'social_campaigns',
      Workflow: 'workflows',
      PipelineStage: 'pipeline_stages',
      InvoiceItem: 'invoice_items',
    };
    const sourceTable = entityToTable[entityType];
    if (!sourceTable) {
      reply.status(400).send({ error: `Unknown entity type: ${entityType}` });
      return;
    }

    const context = buildEntityContext(sourceTable, BigInt(sourceId), tenantId);

    if (!context.target) {
      reply.status(404).send({ error: context.formatted });
      return;
    }

    const response: ApiResponse<GraphContext> = {
      data: context,
      meta: {
        queryMs: performance.now() - start,
        cachedAt: new Date().toISOString(),
      },
    };
    reply.send(response);
  });
}
