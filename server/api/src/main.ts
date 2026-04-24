import Fastify from 'fastify';
import { config } from './config.js';
import { authHook } from './auth.js';
import { graphStore } from './graphStore.js';
import { runSql, parseVertices, parseEdges } from './spacetimeClient.js';
import { healthRoutes } from './routes/health.js';
import { vertexRoutes } from './routes/vertices.js';
import { neighborRoutes } from './routes/neighbors.js';
import { searchRoutes } from './routes/search.js';
import { contextRoutes } from './routes/context.js';

const fastify = Fastify({
  logger: true,
});

// Custom JSON serializer that handles BigInt
fastify.setReplySerializer((payload, statusCode) => {
  return JSON.stringify(payload, (_key, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  });
});

// Auth hook for all routes except health
fastify.addHook('onRequest', async (request, reply) => {
  if (request.url === '/health') return;
  await authHook(request, reply);
});

// Register routes
await fastify.register(healthRoutes);
await fastify.register(vertexRoutes);
await fastify.register(neighborRoutes);
await fastify.register(searchRoutes);
await fastify.register(contextRoutes);

// --- SpacetimeDB polling sync ---

async function syncGraph() {
  try {
    const vertexResults = await runSql('SELECT * FROM kg_vertex');
    const edgeResults = await runSql('SELECT * FROM kg_edge');

    const vertices = parseVertices(vertexResults);
    const edges = parseEdges(edgeResults);

    // Rebuild indexes from scratch (simplest approach for polling)
    // For large graphs, we should do delta updates, but for now full rebuild is fine
    graphStore.clear();
    for (const v of vertices) graphStore.insertVertex(v);
    for (const e of edges) graphStore.insertEdge(e);

    if (!graphStore.isReady()) {
      graphStore.setReady(true);
      fastify.log.info(
        `Graph warmed: ${graphStore.getStats().vertexCount} vertices, ${graphStore.getStats().edgeCount} edges`
      );
    }
  } catch (err) {
    fastify.log.error(`Graph sync failed: ${err}`);
  }
}

// Initial sync
await syncGraph();

// Periodic refresh every 2 seconds
const syncInterval = setInterval(syncGraph, 2000);

// Graceful shutdown
process.on('SIGINT', () => {
  clearInterval(syncInterval);
  fastify.close();
  process.exit(0);
});
process.on('SIGTERM', () => {
  clearInterval(syncInterval);
  fastify.close();
  process.exit(0);
});

// --- Start ---

try {
  await fastify.listen({ port: config.port, host: '0.0.0.0' });
  fastify.log.info(`API Gateway listening on http://0.0.0.0:${config.port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
