import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  getCurrentUser,
  loginByEmailPassword,
  logoutAuthSession,
  refreshAuthSession,
  registerByEmailPassword,
} from '../services/authService';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const RefreshSchema = z.object({
  refresh_token: z.string().min(1),
});

const LogoutSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
});

function getBearerToken(request: FastifyRequest) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/api/auth/register', async (request, reply) => {
    try {
      const { email, password } = RegisterSchema.parse(request.body);
      const session = await registerByEmailPassword(email, password);
      return reply.status(201).send(session);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.status(500).send({ error: message });
    }
  });

  fastify.post('/api/auth/login', async (request, reply) => {
    try {
      const { email, password } = LoginSchema.parse(request.body);
      const session = await loginByEmailPassword(email, password);
      return session;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.status(401).send({ error: message });
    }
  });

  fastify.post('/api/auth/refresh', async (request, reply) => {
    try {
      const { refresh_token } = RefreshSchema.parse(request.body);
      const session = await refreshAuthSession(refresh_token);
      return session;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.status(401).send({ error: message });
    }
  });

  fastify.post('/api/auth/logout', async (request, reply) => {
    try {
      const { access_token, refresh_token } = LogoutSchema.parse(request.body);
      await logoutAuthSession(access_token, refresh_token);

      return { success: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.status(401).send({ error: message });
    }
  });

  fastify.get('/api/auth/me', async (request, reply) => {
    try {
      const token = getBearerToken(request);
      if (!token) {
        return reply.status(401).send({ error: 'Missing Bearer token' });
      }
      return await getCurrentUser(token);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.status(401).send({ error: message });
    }
  });
}
