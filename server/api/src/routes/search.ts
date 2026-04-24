import type { FastifyInstance } from 'fastify';
import { graphStore } from '../graphStore.js';
import type { ApiResponse, KgVertex } from '../types.js';

function parseProperties(v: KgVertex): Record<string, any> {
  try {
    return JSON.parse(v.properties);
  } catch {
    return {};
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function searchRoutes(fastify: FastifyInstance) {
  fastify.post('/v1/graph/search', async (request, reply) => {
    const start = performance.now();
    const body = request.body as {
      tenant_id: string;
      query?: string;
      embedding?: number[];
      entity_type?: string;
      limit?: number;
    };

    const tenantId = BigInt(body.tenant_id);
    const limit = body.limit || 10;
    const queryText = body.query?.toLowerCase() || '';
    const queryEmbedding = body.embedding;
    const entityType = body.entity_type;

    const candidates = graphStore.getVertices({ tenantId, entityType });
    const scored: Array<{ vertex: KgVertex; score: number }> = [];

    for (const v of candidates) {
      let score = 0;
      const props = parseProperties(v);

      // Keyword scoring
      if (queryText) {
        const text = (
          (props.title || '') +
          ' ' +
          (props.summary || '') +
          ' ' +
          (props.content_text || '') +
          ' ' +
          (props.keywords?.join(' ') || '')
        ).toLowerCase();
        const words = queryText.split(/\s+/);
        for (const w of words) {
          if (text.includes(w)) score += 1;
        }
      }

      // Semantic scoring
      if (queryEmbedding && v.vectorEmbedding && v.vectorEmbedding.length > 0) {
        const sim = cosineSimilarity(queryEmbedding, v.vectorEmbedding);
        score += sim * 2; // weight semantic higher
      }

      if (score > 0 || (!queryText && !queryEmbedding)) {
        scored.push({ vertex: v, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, limit);

    const response: ApiResponse<typeof results> = {
      data: results,
      meta: {
        queryMs: performance.now() - start,
        cachedAt: new Date().toISOString(),
      },
    };
    reply.send(response);
  });
}
