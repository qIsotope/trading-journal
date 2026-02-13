import type { FastifyReply, FastifyRequest } from 'fastify';
import { getCurrentUser } from '../services/authService';

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: {
      id: string;
      email: string | null;
    };
  }
}

function extractBearerToken(request: FastifyRequest) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const token = extractBearerToken(request);
  if (!token) {
    return reply.status(401).send({ error: 'Missing Bearer token' });
  }

  try {
    request.authUser = await getCurrentUser(token);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    return reply.status(401).send({ error: message });
  }
}
