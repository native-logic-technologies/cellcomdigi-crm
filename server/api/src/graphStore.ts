import type { KgVertex, KgEdge } from './types.js';

class GraphStore {
  private verticesById = new Map<bigint, KgVertex>();
  private edgesById = new Map<bigint, KgEdge>();

  // Indexes
  private verticesByTenant = new Map<bigint, Map<string, KgVertex[]>>();
  private verticesBySource = new Map<string, Map<bigint, KgVertex>>(); // sourceTable -> sourceId -> vertex
  private adjacencyOut = new Map<bigint, KgEdge[]>();
  private adjacencyIn = new Map<bigint, KgEdge[]>();

  private ready = false;
  private vertexCount = 0;
  private edgeCount = 0;

  // ---- Vertex operations ----

  insertVertex(v: KgVertex) {
    this.verticesById.set(v.id, v);
    this.vertexCount++;

    // tenant -> entity_type -> vertices
    let tenantMap = this.verticesByTenant.get(v.tenantId);
    if (!tenantMap) {
      tenantMap = new Map();
      this.verticesByTenant.set(v.tenantId, tenantMap);
    }
    let typeList = tenantMap.get(v.entityType.tag);
    if (!typeList) {
      typeList = [];
      tenantMap.set(v.entityType.tag, typeList);
    }
    typeList.push(v);

    // source_table -> source_id -> vertex
    let sourceMap = this.verticesBySource.get(v.sourceTable);
    if (!sourceMap) {
      sourceMap = new Map();
      this.verticesBySource.set(v.sourceTable, sourceMap);
    }
    sourceMap.set(v.sourceId, v);
  }

  updateVertex(v: KgVertex) {
    const existing = this.verticesById.get(v.id);
    if (!existing) {
      this.insertVertex(v);
      return;
    }
    this.deleteVertex(v.id);
    this.insertVertex(v);
  }

  deleteVertex(id: bigint) {
    const v = this.verticesById.get(id);
    if (!v) return;
    this.verticesById.delete(id);
    this.vertexCount--;

    // Remove from tenant index
    const tenantMap = this.verticesByTenant.get(v.tenantId);
    if (tenantMap) {
      const typeList = tenantMap.get(v.entityType.tag);
      if (typeList) {
        const idx = typeList.findIndex((x) => x.id === id);
        if (idx >= 0) typeList.splice(idx, 1);
      }
    }

    // Remove from source index
    const sourceMap = this.verticesBySource.get(v.sourceTable);
    if (sourceMap) {
      sourceMap.delete(v.sourceId);
    }
  }

  // ---- Edge operations ----

  insertEdge(e: KgEdge) {
    this.edgesById.set(e.id, e);
    this.edgeCount++;

    const outList = this.adjacencyOut.get(e.sourceVertexId) || [];
    outList.push(e);
    this.adjacencyOut.set(e.sourceVertexId, outList);

    const inList = this.adjacencyIn.get(e.targetVertexId) || [];
    inList.push(e);
    this.adjacencyIn.set(e.targetVertexId, inList);
  }

  updateEdge(e: KgEdge) {
    const existing = this.edgesById.get(e.id);
    if (!existing) {
      this.insertEdge(e);
      return;
    }
    this.deleteEdge(e.id);
    this.insertEdge(e);
  }

  deleteEdge(id: bigint) {
    const e = this.edgesById.get(id);
    if (!e) return;
    this.edgesById.delete(id);
    this.edgeCount--;

    const outList = this.adjacencyOut.get(e.sourceVertexId);
    if (outList) {
      const idx = outList.findIndex((x) => x.id === id);
      if (idx >= 0) outList.splice(idx, 1);
    }

    const inList = this.adjacencyIn.get(e.targetVertexId);
    if (inList) {
      const idx = inList.findIndex((x) => x.id === id);
      if (idx >= 0) inList.splice(idx, 1);
    }
  }

  // ---- Queries ----

  getVertex(id: bigint): KgVertex | undefined {
    return this.verticesById.get(id);
  }

  getVertices(opts: {
    tenantId?: bigint;
    entityType?: string;
    sourceTable?: string;
    limit?: number;
    offset?: number;
  }): KgVertex[] {
    let results: KgVertex[];

    if (opts.tenantId !== undefined && opts.entityType !== undefined) {
      const tenantMap = this.verticesByTenant.get(opts.tenantId);
      results = tenantMap?.get(opts.entityType) || [];
    } else if (opts.tenantId !== undefined) {
      const tenantMap = this.verticesByTenant.get(opts.tenantId);
      results = tenantMap ? Array.from(tenantMap.values()).flat() : [];
    } else if (opts.sourceTable !== undefined) {
      const sourceMap = this.verticesBySource.get(opts.sourceTable);
      results = sourceMap ? Array.from(sourceMap.values()) : [];
    } else {
      results = Array.from(this.verticesById.values());
    }

    if (opts.limit !== undefined) {
      const offset = opts.offset || 0;
      results = results.slice(offset, offset + opts.limit);
    }

    return results;
  }

  getVertexBySource(tenantId: bigint, sourceTable: string, sourceId: bigint): KgVertex | undefined {
    const sourceMap = this.verticesBySource.get(sourceTable);
    const v = sourceMap?.get(sourceId);
    if (v && v.tenantId === tenantId) return v;
    return undefined;
  }

  getNeighbors(
    vertexId: bigint,
    opts: {
      depth?: number;
      direction?: 'out' | 'in' | 'both';
      relationType?: string;
    } = {}
  ): Array<{ vertex: KgVertex; edge: KgEdge; direction: 'out' | 'in' }> {
    const depth = Math.min(opts.depth || 1, 3);
    const relationFilter = opts.relationType;
    const dir = opts.direction || 'both';

    const results: Array<{ vertex: KgVertex; edge: KgEdge; direction: 'out' | 'in' }> = [];
    const visited = new Set<bigint>();
    visited.add(vertexId);

    let frontier = new Set<bigint>([vertexId]);

    for (let d = 0; d < depth; d++) {
      const nextFrontier = new Set<bigint>();
      for (const currentId of frontier) {
        const edges: Array<{ edge: KgEdge; direction: 'out' | 'in' }> = [];

        if (dir === 'out' || dir === 'both') {
          const outEdges = this.adjacencyOut.get(currentId) || [];
          for (const e of outEdges) edges.push({ edge: e, direction: 'out' });
        }
        if (dir === 'in' || dir === 'both') {
          const inEdges = this.adjacencyIn.get(currentId) || [];
          for (const e of inEdges) edges.push({ edge: e, direction: 'in' });
        }

        for (const { edge, direction } of edges) {
          if (relationFilter && edge.relationType.tag !== relationFilter) continue;

          const neighborId = direction === 'out' ? edge.targetVertexId : edge.sourceVertexId;
          if (visited.has(neighborId)) continue;
          visited.add(neighborId);

          const neighbor = this.verticesById.get(neighborId);
          if (!neighbor) continue;

          results.push({ vertex: neighbor, edge, direction });
          nextFrontier.add(neighborId);
        }
      }
      frontier = nextFrontier;
    }

    return results;
  }

  // ---- Bulk operations ----

  clear() {
    this.verticesById.clear();
    this.edgesById.clear();
    this.verticesByTenant.clear();
    this.verticesBySource.clear();
    this.adjacencyOut.clear();
    this.adjacencyIn.clear();
    this.vertexCount = 0;
    this.edgeCount = 0;
  }

  // ---- Status ----

  setReady(ready: boolean) {
    this.ready = ready;
  }

  isReady() {
    return this.ready;
  }

  getStats() {
    return {
      vertexCount: this.vertexCount,
      edgeCount: this.edgeCount,
      ready: this.ready,
    };
  }
}

export const graphStore = new GraphStore();
