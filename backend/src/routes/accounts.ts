import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../db/database';
import type { Account } from '../db/schema';
import { z } from 'zod';
import { encrypt, decrypt } from '../lib/crypto';

const AccountSchema = z.object({
  mt5_login: z.string(),
  mt5_server: z.string(),
  mt5_password: z.string(),
  account_name: z.string().optional(),
});

const AccountUpdateSchema = AccountSchema.partial().omit({ mt5_login: true });

interface MT5AccountInfo {
  login: number;
  server: string;
  balance: number;
  equity: number;
  margin: number;
  margin_free: number;
  profit: number;
  currency: string;
  leverage: number;
}

interface MT5Trade {
  deal_id: number;
  ticket: number;
  symbol: string;
  direction: string;
  volume: number;
  open_price: number;
  close_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  open_time: string;
  close_time: string;
  profit: number;
  commission: number;
  swap: number;
}

interface MT5SyncResponse {
  success: boolean;
  account_info: MT5AccountInfo;
  trades: MT5Trade[];
  trades_count: number;
}

interface QueryParams {
  id?: string;
}

export async function accountsRoutes(fastify: FastifyInstance) {
  const db = getDatabase();

  // GET all accounts
  fastify.get('/api/accounts', async (request, reply) => {
    try {
      const accounts = db.prepare(`
        SELECT id, mt5_login, mt5_server, account_name, created_at, updated_at, is_active
        FROM accounts
        WHERE is_active = 1
        ORDER BY created_at DESC
      `).all();

      return { accounts };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      reply.status(500).send({ error: message });
    }
  });

  // GET single account
  fastify.get('/api/accounts/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const account = db.prepare(`
        SELECT id, mt5_login, mt5_server, account_name, created_at, updated_at, is_active
        FROM accounts
        WHERE id = ?
      `).get(id);

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
  fastify.post('/api/accounts', async (request, reply) => {
    try {
      const validatedData = AccountSchema.parse(request.body);

      // Encrypt password using AES
      const encryptedPassword = encrypt(validatedData.mt5_password);

      const stmt = db.query(`
        INSERT INTO accounts (mt5_login, mt5_server, mt5_password_encrypted, account_name)
        VALUES (?, ?, ?, ?)
      `);

      const result = stmt.run(
        validatedData.mt5_login,
        validatedData.mt5_server,
        encryptedPassword,
        validatedData.account_name || null
      );

      const account = db.query(`
        SELECT id, mt5_login, mt5_server, account_name, created_at, updated_at, is_active
        FROM accounts
        WHERE id = ?
      `).get(result.lastInsertRowid);

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
  fastify.put('/api/accounts/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const validatedData = AccountUpdateSchema.parse(request.body);

      // Check if account exists
      const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
      if (!existing) {
        return reply.status(404).send({ error: 'Account not found' });
      }

      // Build update query
      const updates: string[] = [];
      const params: (string | number | null)[] = [];

      if (validatedData.mt5_server) {
        updates.push('mt5_server = ?');
        params.push(validatedData.mt5_server);
      }

      if (validatedData.mt5_password) {
        updates.push('mt5_password_encrypted = ?');
        const encrypted = encrypt(validatedData.mt5_password);
        params.push(encrypted);
      }

      if (validatedData.account_name !== undefined) {
        updates.push('account_name = ?');
        params.push(validatedData.account_name);
      }

      if (updates.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      const query = `UPDATE accounts SET ${updates.join(', ')} WHERE id = ?`;
      db.prepare(query).run(...params);

      const updated = db.prepare(`
        SELECT id, mt5_login, mt5_server, account_name, created_at, updated_at, is_active
        FROM accounts
        WHERE id = ?
      `).get(id);

      return updated;
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
  fastify.delete('/api/accounts/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
      if (!existing) {
        return reply.status(404).send({ error: 'Account not found' });
      }

      // Soft delete
      db.prepare('UPDATE accounts SET is_active = 0 WHERE id = ?').run(id);

      return { success: true, message: 'Account deactivated' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      reply.status(500).send({ error: message });
    }
  });

  // POST sync account from MT5
  fastify.post('/api/accounts/:id/sync', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      // Get account with encrypted password
      const account = db.query('SELECT * FROM accounts WHERE id = ?').get(id) as Account | undefined;
      if (!account) {
        return reply.status(404).send({ error: 'Account not found' });
      }

      // Decrypt password
      const decryptedPassword = decrypt(account.mt5_password_encrypted);

      // Call Python MT5 API with credentials
      const response = await fetch('http://localhost:8000/sync-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login: parseInt(account.mt5_login),
          password: decryptedPassword,
          server: account.mt5_server
        })
      });

      if (!response.ok) {
        const errorData = await response.json() as { detail?: string };
        throw new Error(errorData.detail || 'Failed to sync with MT5');
      }

      const syncData = await response.json() as MT5SyncResponse;

      // Update account info in DB
      db.query(`
        UPDATE accounts 
        SET balance = ?, equity = ?, margin = ?, margin_free = ?, 
            profit = ?, currency = ?, leverage = ?, last_synced_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        syncData.account_info.balance,
        syncData.account_info.equity,
        syncData.account_info.margin,
        syncData.account_info.margin_free,
        syncData.account_info.profit,
        syncData.account_info.currency,
        syncData.account_info.leverage,
        id
      );

      // Insert or update trades
      const insertTrade = db.query(`
        INSERT OR IGNORE INTO trades (
          account_id, deal_id, ticket, symbol, direction, volume,
          open_price, close_price, stop_loss, take_profit,
          open_time, close_time,
          profit, commission, swap
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const trade of syncData.trades) {
        insertTrade.run(
          id,
          trade.deal_id,
          trade.ticket,
          trade.symbol,
          trade.direction,
          trade.volume,
          trade.open_price,
          trade.close_price,
          trade.stop_loss,
          trade.take_profit,
          trade.open_time,
          trade.close_time,
          trade.profit,
          trade.commission,
          trade.swap
        );
      }

      return {
        success: true,
        message: `Synced ${syncData.trades_count} trades`,
        account_info: syncData.account_info,
        new_trades: syncData.trades_count
      };
    } catch (error) {
      fastify.log.error(error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      reply.status(500).send({ error: message });
    }
  });

  // GET account statistics
  fastify.get('/api/accounts/:id/stats', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const stats = db.prepare(`
        SELECT
          COUNT(*) as total_trades,
          SUM(CASE WHEN profit > 0 THEN 1 ELSE 0 END) as winning_trades,
          SUM(CASE WHEN profit < 0 THEN 1 ELSE 0 END) as losing_trades,
          SUM(profit) as total_profit,
          AVG(profit) as avg_profit,
          MAX(profit) as best_trade,
          MIN(profit) as worst_trade
        FROM trades
        WHERE account_id = ? AND close_time IS NOT NULL
      `).get(id);

      return stats;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      reply.status(500).send({ error: message });
    }
  });
}
