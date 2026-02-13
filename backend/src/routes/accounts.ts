import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/authMiddleware';
import {
  createAccount,
  deactivateAccount,
  getAccountById,
  getAccounts,
  getStatsByAccountId,
  syncAccountWithMt5,
  updateAccount,
} from '../services/accountsService';

const AccountSchema = z.object({
  mt5_login: z.string(),
  mt5_server: z.string(),
  mt5_password: z.string(),
  account_name: z.string().optional(),
});

const AccountUpdateSchema = AccountSchema.partial().omit({ mt5_login: true });

export async function accountsRoutes(fastify: FastifyInstance) {
  // GET all accounts
  fastify.get('/api/accounts', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.authUser?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const accounts = await getAccounts(userId);

      return { accounts };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      reply.status(500).send({ error: message });
    }
  });

  // GET single account
  fastify.get('/api/accounts/:id', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const userId = request.authUser?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const account = await getAccountById(id, userId);

      if (!account) {
        return reply.status(404).send({ error: 'Account not found' });
      }

      return account;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      reply.status(500).send({ error: message });
    }
  });

  // POST create account
  fastify.post('/api/accounts', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const validatedData = AccountSchema.parse(request.body);
      const userId = request.authUser?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const account = await createAccount({ ...validatedData, user_id: userId });

      reply.status(201).send(account);
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400).send({ error: 'Validation error', details: error.errors });
      } else if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        reply.status(409).send({ error: 'Account with this login already exists' });
      } else {
        const message = error instanceof Error ? error.message : 'Unknown error';
        reply.status(500).send({ error: message });
      }
    }
  });

  // PUT update account
  fastify.put('/api/accounts/:id', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const validatedData = AccountUpdateSchema.parse(request.body);
      const userId = request.authUser?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const result = await updateAccount(id, userId, validatedData);

      if (!result.exists) {
        return reply.status(404).send({ error: 'Account not found' });
      }

      if (!result.changed) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      return result.updated;
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400).send({ error: 'Validation error', details: error.errors });
      } else {
        const message = error instanceof Error ? error.message : 'Unknown error';
        reply.status(500).send({ error: message });
      }
    }
  });

  // DELETE account (soft delete)
  fastify.delete('/api/accounts/:id', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const userId = request.authUser?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const deleted = await deactivateAccount(id, userId);
      if (!deleted) {
        return reply.status(404).send({ error: 'Account not found' });
      }

      return { success: true, message: 'Account deactivated' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      reply.status(500).send({ error: message });
    }
  });

  // POST sync account from MT5
  fastify.post('/api/accounts/:id/sync', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { resync_notion } = request.query as { resync_notion?: string };
      const userId = request.authUser?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const result = await syncAccountWithMt5({
        id,
        userId,
        resyncNotion: resync_notion === '1',
        logger: fastify.log,
      });

      if (!result.found) {
        return reply.status(404).send({ error: 'Account not found' });
      }

      return result.result;
    } catch (error) {
      fastify.log.error(error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      reply.status(500).send({ error: message });
    }
  });

  // GET account statistics
  fastify.get('/api/accounts/:id/stats', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const userId = request.authUser?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const stats = await getStatsByAccountId(id, userId);

      return stats;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      reply.status(500).send({ error: message });
    }
  });
}
