import type { FastifyInstance } from 'fastify';
import { graphStore } from '../graphStore.js';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (_request, reply) => {
    const stats = graphStore.getStats();
    reply.send({
      status: stats.ready ? 'ok' : 'warming',
      graphVertices: stats.vertexCount,
      graphEdges: stats.edgeCount,
      ready: stats.ready,
    });
  });
}
