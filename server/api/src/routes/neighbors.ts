import type { FastifyInstance } from 'fastify';
import { graphStore } from '../graphStore.js';
import type { ApiResponse } from '../types.js';

export async function neighborRoutes(fastify: FastifyInstance) {
  fastify.get('/v1/graph/vertices/:id/neighbors', async (request, reply) => {
    const start = performance.now();
    const { id } = request.params as { id: string };
    const query = request.query as Record<string, string>;

    const vertexId = BigInt(id);
    const depth = query.depth ? Math.min(Number(query.depth), 3) : 1;
    const direction = query.direction as 'out' | 'in' | 'both' | undefined;
    const relationType = query.relation_type;

    const vertex = graphStore.getVertex(vertexId);
    if (!vertex) {
      reply.status(404).send({ error: 'Vertex not found' });
      return;
    }

    const neighbors = graphStore.getNeighbors(vertexId, { depth, direction, relationType });

    const response: ApiResponse<typeof neighbors> = {
      data: neighbors,
      meta: {
        queryMs: performance.now() - start,
        cachedAt: new Date().toISOString(),
      },
    };
    reply.send(response);
  });
}
