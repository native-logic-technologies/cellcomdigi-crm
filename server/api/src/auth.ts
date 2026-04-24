import type { FastifyRequest, FastifyReply } from 'fastify';
import { config } from './config.js';

export async function authHook(request: FastifyRequest, reply: FastifyReply) {
  const auth = request.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    reply.status(401).send({ error: 'Missing or invalid Authorization header. Use: Bearer <api_key>' });
    return;
  }
  const key = auth.slice(7).trim();
  if (!config.apiKeys.has(key)) {
    reply.status(401).send({ error: 'Invalid API key' });
    return;
  }
}
