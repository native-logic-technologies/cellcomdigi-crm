import type { FastifyInstance } from 'fastify';
import { graphStore } from '../graphStore.js';
import type { ApiResponse } from '../types.js';

export async function vertexRoutes(fastify: FastifyInstance) {
  fastify.get('/v1/graph/vertices', async (request, reply) => {
    const start = performance.now();
    const query = request.query as Record<string, string>;

    const tenantId = query.tenant_id ? BigInt(query.tenant_id) : undefined;
    const entityType = query.entity_type;
    const sourceTable = query.source_table;
    const limit = query.limit ? Number(query.limit) : undefined;
    const offset = query.offset ? Number(query.offset) : undefined;

    const vertices = graphStore.getVertices({ tenantId, entityType, sourceTable, limit, offset });

    const response: ApiResponse<typeof vertices> = {
      data: vertices,
      meta: {
        queryMs: performance.now() - start,
        cachedAt: new Date().toISOString(),
      },
    };
    reply.send(response);
  });

  fastify.get('/v1/graph/vertices/:id', async (request, reply) => {
    const start = performance.now();
    const { id } = request.params as { id: string };
    const vertex = graphStore.getVertex(BigInt(id));

    if (!vertex) {
      reply.status(404).send({ error: 'Vertex not found' });
      return;
    }

    const response: ApiResponse<typeof vertex> = {
      data: vertex,
      meta: {
        queryMs: performance.now() - start,
        cachedAt: new Date().toISOString(),
      },
    };
    reply.send(response);
  });
}
