import { useTable, useReducer } from 'spacetimedb/react';
import { tables, reducers } from '../generated';
import type { EntityType } from '../generated/types';

export function useVertices(tenantId?: bigint, entityTypeFilter?: EntityType) {
  const [rows, isReady] = useTable(tables.kg_vertex);

  const filtered = rows.filter((v) => {
    if (tenantId !== undefined && v.tenantId !== tenantId) return false;
    if (entityTypeFilter !== undefined && v.entityType.tag !== entityTypeFilter.tag)
      return false;
    return true;
  });

  return { vertices: filtered, isReady };
}

export function useEdges(tenantId?: bigint, vertexId?: bigint, direction?: 'out' | 'in' | 'both') {
  const [rows, isReady] = useTable(tables.kg_edge);

  const filtered = rows.filter((e) => {
    if (tenantId !== undefined && e.tenantId !== tenantId) return false;
    if (vertexId !== undefined) {
      const matches =
        direction === 'out'
          ? e.sourceVertexId === vertexId
          : direction === 'in'
            ? e.targetVertexId === vertexId
            : e.sourceVertexId === vertexId || e.targetVertexId === vertexId;
      if (!matches) return false;
    }
    return true;
  });

  return { edges: filtered, isReady };
}

export function useKgReducers() {
  const createVertex = useReducer(reducers.createVertex);
  const updateVertex = useReducer(reducers.updateVertex);
  const deleteVertex = useReducer(reducers.deleteVertex);
  const createEdge = useReducer(reducers.createEdge);
  const updateEdge = useReducer(reducers.updateEdge);
  const deleteEdge = useReducer(reducers.deleteEdge);
  const mergeVertices = useReducer(reducers.mergeVertices);
  const addTenantMember = useReducer(reducers.addTenantMember);

  return {
    createVertex,
    updateVertex,
    deleteVertex,
    createEdge,
    updateEdge,
    deleteEdge,
    mergeVertices,
    addTenantMember,
  };
}
