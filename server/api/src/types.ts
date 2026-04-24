// Shared types for the API Gateway

export interface KgVertex {
  id: bigint;
  tenantId: bigint;
  entityType: { tag: string };
  sourceTable: string;
  sourceId: bigint;
  properties: string;
  vectorEmbedding: number[] | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface KgEdge {
  id: bigint;
  tenantId: bigint;
  sourceVertexId: bigint;
  targetVertexId: bigint;
  relationType: { tag: string };
  properties: string;
  weight: number | undefined;
  createdAt: Date;
}

export interface GraphContext {
  target: KgVertex;
  container: KgVertex | null;
  neighbors: Array<{ vertex: KgVertex; edges: KgEdge[]; distance: number }>;
  memories: KgVertex[];
  documents: KgVertex[];
  similar: KgVertex[];
  formatted: string;
}

export interface ApiResponse<T> {
  data: T;
  meta: {
    queryMs: number;
    cachedAt: string;
  };
}
