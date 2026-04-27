// Supermemory Query Engine
// All graph data lives in SpacetimeDB. This service performs client-side
// graph traversal over the local SpacetimeDB cache (already synced via WebSocket).

import { useMemo } from 'react';
import { useTable } from 'spacetimedb/react';
import { tables } from '../generated';
import type { KgVertex, KgEdge } from '../generated/types';
import { cosineSimilarity } from './embeddingService';

export interface GraphContext {
  target: KgVertex;
  container: KgVertex | null;
  neighbors: Array<{ vertex: KgVertex; edges: KgEdge[]; distance: number }>;
  memories: KgVertex[];
  documents: KgVertex[];
  similar: KgVertex[];
  formatted: string;
}

export interface ContextOptions {
  includeMemories?: boolean;
  includeDocuments?: boolean;
  includeSimilar?: boolean;
  includeConversationHistory?: boolean;
  includeDealStatus?: boolean;
  timeWindowDays?: number;
  maxNeighbors?: number;
}

function parseProperties(v: KgVertex): Record<string, any> {
  try {
    return JSON.parse(v.properties);
  } catch {
    return {};
  }
}

function recencyScore(timestamp: any | null): number {
  if (!timestamp) return 0.5;
  let ts: number;
  if (timestamp instanceof Date) {
    ts = timestamp.getTime();
  } else if (typeof timestamp.toDate === 'function') {
    ts = timestamp.toDate().getTime();
  } else if (typeof timestamp === 'number') {
    ts = timestamp;
  } else {
    return 0.5;
  }
  const daysAgo = (Date.now() - ts) / (1000 * 60 * 60 * 24);
  return Math.exp(-daysAgo / 30); // half-life of 30 days
}

function rankVertices(
  vertices: readonly KgVertex[],
  edges: readonly KgEdge[],
  sourceId: bigint,
  sourceTable: string
): Array<{ vertex: KgVertex; edges: KgEdge[]; score: number }> {
  const vertexMap = new Map<bigint, KgVertex>();
  for (const v of vertices) vertexMap.set(v.id, v);

  const source = vertices.find(v => v.sourceTable === sourceTable && v.sourceId === sourceId);
  if (!source) return [];

  const connected = new Map<bigint, KgEdge[]>();
  for (const e of edges) {
    if (e.sourceVertexId === source.id) {
      const arr = connected.get(e.targetVertexId) || [];
      arr.push(e);
      connected.set(e.targetVertexId, arr);
    } else if (e.targetVertexId === source.id) {
      const arr = connected.get(e.sourceVertexId) || [];
      arr.push(e);
      connected.set(e.sourceVertexId, arr);
    }
  }

  const scored = [];
  for (const [vertexId, edgeList] of connected.entries()) {
    const v = vertexMap.get(vertexId);
    if (!v) continue;
    const props = parseProperties(v);
    const importance = props.importance ?? 0.5;
    const recency = recencyScore(v.updatedAt ?? v.createdAt ?? null);
    const edgeBoost = edgeList.length * 0.1;
    const score = (importance * 0.4 + recency * 0.4 + edgeBoost * 0.2);
    scored.push({ vertex: v, edges: edgeList, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored;
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
    lines.push(`${indent}  Content: ${props.content_text.slice(0, 200)}${props.content_text.length > 200 ? '...' : ''}`);
  }
  return lines.join('\n');
}

export function buildContactContext(
  contactId: bigint,
  tenantId: bigint,
  vertices: readonly KgVertex[],
  edges: readonly KgEdge[],
  opts: ContextOptions = {}
): GraphContext {
  const options = {
    includeMemories: true,
    includeDocuments: true,
    includeSimilar: true,
    includeConversationHistory: true,
    includeDealStatus: true,
    timeWindowDays: 90,
    maxNeighbors: 20,
    ...opts,
  };

  const contactVertex = vertices.find(
    v => v.tenantId === tenantId && v.sourceTable === 'contacts' && v.sourceId === contactId
  );

  if (!contactVertex) {
    return {
      target: null as any,
      container: null,
      neighbors: [],
      memories: [],
      documents: [],
      similar: [],
      formatted: `Contact #${contactId} not found in knowledge graph.`,
    };
  }

  const container = vertices.find(
    v =>
      v.tenantId === tenantId &&
      v.entityType.tag === 'Container' &&
      v.sourceTable === 'memory_collections' &&
      parseProperties(v).raw?.collection_type === 'AutoContact' &&
      edges.some(
        e =>
          e.relationType.tag === 'ContainedIn' &&
          ((e.sourceVertexId === contactVertex.id && e.targetVertexId === v.id) ||
           (e.sourceVertexId === v.id && e.targetVertexId === contactVertex.id))
      )
  ) || null;

  const scored = rankVertices(vertices, edges, contactId, 'contacts');
  const filtered = scored.slice(0, options.maxNeighbors);

  const memories: KgVertex[] = [];
  const documents: KgVertex[] = [];
  const similar: KgVertex[] = [];

  for (const { vertex, edges: edgeList } of filtered) {
    if (vertex.entityType.tag === 'Memory' && options.includeMemories) memories.push(vertex);
    if (vertex.entityType.tag === 'Document' && options.includeDocuments) documents.push(vertex);
    if (edgeList.some(e => e.relationType.tag === 'SimilarTo') && options.includeSimilar) similar.push(vertex);
  }

  // Format as structured Markdown for AI
  const lines: string[] = [];
  lines.push(`# Contact Intelligence: ${parseProperties(contactVertex).title || 'Contact #' + contactId}`);
  lines.push('');
  lines.push(formatVertex(contactVertex));
  lines.push('');

  if (container) {
    lines.push(`## Intelligence Container`);
    lines.push(formatVertex(container, '> '));
    lines.push('');
  }

  const companyNeighbor = filtered.find(n => n.vertex.entityType.tag === 'Company');
  if (companyNeighbor) {
    lines.push(`## Company`);
    lines.push(formatVertex(companyNeighbor.vertex, '> '));
    lines.push('');
  }

  const dealNeighbors = filtered.filter(n => n.vertex.entityType.tag === 'Deal');
  if (dealNeighbors.length && options.includeDealStatus) {
    lines.push(`## Active Deals (${dealNeighbors.length})`);
    for (const d of dealNeighbors.slice(0, 5)) {
      lines.push(formatVertex(d.vertex, '> '));
    }
    lines.push('');
  }

  const activityNeighbors = filtered.filter(n => n.vertex.entityType.tag === 'Activity');
  if (activityNeighbors.length) {
    lines.push(`## Recent Activities (${activityNeighbors.length})`);
    for (const a of activityNeighbors.slice(0, 5)) {
      lines.push(formatVertex(a.vertex, '> '));
    }
    lines.push('');
  }

  if (options.includeConversationHistory) {
    const messageNeighbors = filtered.filter(n => n.vertex.entityType.tag === 'Message');
    if (messageNeighbors.length) {
      lines.push(`## Recent Messages (${messageNeighbors.length})`);
      for (const m of messageNeighbors.slice(0, 5)) {
        lines.push(formatVertex(m.vertex, '> '));
      }
      lines.push('');
    }
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

  const formatted = lines.join('\n');

  return {
    target: contactVertex,
    container,
    neighbors: filtered.map(({ vertex, edges: e, score }) => ({ vertex, edges: e, distance: 1 / score })),
    memories,
    documents,
    similar,
    formatted,
  };
}

export function buildCompanyContext(
  companyId: bigint,
  tenantId: bigint,
  vertices: readonly KgVertex[],
  edges: readonly KgEdge[],
  opts: ContextOptions = {}
): GraphContext {
  const options = { includeMemories: true, includeDocuments: true, includeSimilar: true, maxNeighbors: 20, ...opts };

  const companyVertex = vertices.find(
    v => v.tenantId === tenantId && v.sourceTable === 'companies' && v.sourceId === companyId
  );

  if (!companyVertex) {
    return {
      target: null as any,
      container: null,
      neighbors: [],
      memories: [],
      documents: [],
      similar: [],
      formatted: `Company #${companyId} not found in knowledge graph.`,
    };
  }

  const container = vertices.find(
    v =>
      v.tenantId === tenantId &&
      v.entityType.tag === 'Container' &&
      v.sourceTable === 'memory_collections' &&
      parseProperties(v).raw?.collection_type === 'AutoCompany' &&
      edges.some(
        e =>
          e.relationType.tag === 'ContainedIn' &&
          ((e.sourceVertexId === companyVertex.id && e.targetVertexId === v.id) ||
           (e.sourceVertexId === v.id && e.targetVertexId === companyVertex.id))
      )
  ) || null;

  const scored = rankVertices(vertices, edges, companyId, 'companies');
  const filtered = scored.slice(0, options.maxNeighbors);

  const memories = filtered.filter(n => n.vertex.entityType.tag === 'Memory').map(n => n.vertex);
  const documents = filtered.filter(n => n.vertex.entityType.tag === 'Document').map(n => n.vertex);

  const lines: string[] = [];
  lines.push(`# Account Intelligence: ${parseProperties(companyVertex).title || 'Company #' + companyId}`);
  lines.push('');
  lines.push(formatVertex(companyVertex));
  lines.push('');

  const contactNeighbors = filtered.filter(n => n.vertex.entityType.tag === 'Contact');
  if (contactNeighbors.length) {
    lines.push(`## Contacts (${contactNeighbors.length})`);
    for (const c of contactNeighbors.slice(0, 5)) {
      lines.push(formatVertex(c.vertex, '> '));
    }
    lines.push('');
  }

  const dealNeighbors = filtered.filter(n => n.vertex.entityType.tag === 'Deal');
  if (dealNeighbors.length) {
    lines.push(`## Deals (${dealNeighbors.length})`);
    for (const d of dealNeighbors.slice(0, 5)) {
      lines.push(formatVertex(d.vertex, '> '));
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
    target: companyVertex,
    container,
    neighbors: filtered.map(({ vertex, edges: e, score }) => ({ vertex, edges: e, distance: 1 / score })),
    memories,
    documents,
    similar: [],
    formatted: lines.join('\n'),
  };
}

export function semanticSearch(
  queryEmbedding: number[],
  tenantId: bigint,
  vertices: readonly KgVertex[],
  _edges: readonly KgEdge[],
  limit = 10
): Array<{ vertex: KgVertex; score: number }> {
  const candidates = vertices
    .filter(v => v.tenantId === tenantId && v.vectorEmbedding && v.vectorEmbedding.length > 0)
    .map(v => ({
      vertex: v,
      score: cosineSimilarity(queryEmbedding, v.vectorEmbedding!),
    }));

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, limit);
}

export function getContentRecommendations(
  topic: string,
  tenantId: bigint,
  vertices: readonly KgVertex[],
  _edges: readonly KgEdge[],
  limit = 5
): KgVertex[] {
  // Simple keyword-based recommendation until embeddings are populated
  const topicWords = topic.toLowerCase().split(/\s+/);
  const scored = vertices
    .filter(v => v.tenantId === tenantId)
    .map(v => {
      const props = parseProperties(v);
      const text = (props.title + ' ' + props.summary + ' ' + props.content_text + ' ' + (props.keywords?.join(' ') || '')).toLowerCase();
      let score = 0;
      for (const word of topicWords) {
        if (text.includes(word)) score += 1;
      }
      return { vertex: v, score };
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(s => s.vertex);
}

// React hook for convenience
export function useSupermemory(tenantId?: bigint) {
  const [vertexRows, verticesReady] = useTable(tables.kg_vertex);
  const [edgeRows, edgesReady] = useTable(tables.kg_edge);

  const vertices = useMemo(() => {
    if (tenantId === undefined) return vertexRows;
    return vertexRows.filter(v => v.tenantId === tenantId);
  }, [vertexRows, tenantId]);

  const edges = useMemo(() => {
    if (tenantId === undefined) return edgeRows;
    return edgeRows.filter(e => e.tenantId === tenantId);
  }, [edgeRows, tenantId]);

  return {
    vertices,
    edges,
    isReady: verticesReady && edgesReady,
    buildContactContext: (contactId: bigint, opts?: ContextOptions) =>
      buildContactContext(contactId, tenantId ?? 0n, vertices, edges, opts),
    buildCompanyContext: (companyId: bigint, opts?: ContextOptions) =>
      buildCompanyContext(companyId, tenantId ?? 0n, vertices, edges, opts),
    semanticSearch: (queryEmbedding: number[], limit = 10) =>
      semanticSearch(queryEmbedding, tenantId ?? 0n, vertices, edges, limit),
    getContentRecommendations: (topic: string, limit = 5) =>
      getContentRecommendations(topic, tenantId ?? 0n, vertices, edges, limit),
  };
}
