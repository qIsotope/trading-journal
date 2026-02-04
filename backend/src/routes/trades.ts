import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../db/database';
import type { Trade } from '../db/schema';
import { z } from 'zod';

const TradeSchema = z.object({
  account_id: z.number(),
  deal_id: z.string(),
  ticket: z.string().optional(),
  symbol: z.string(),
  direction: z.enum(['LONG', 'SHORT']),
  volume: z.number(),
  open_price: z.number(),
  close_price: z.number().optional(),
  stop_loss: z.number().optional(),
  take_profit: z.number().optional(),
  open_time: z.string(),
  close_time: z.string().optional(),
  weekday: z.string().optional(),
  session: z.enum(['ASIA', 'FRANKFURT', 'LONDON', 'NEWYORK']).optional(),
  risk_percent: z.number().optional(),
  risk_reward: z.number().optional(),
  result: z.enum(['BE', 'SL', 'TP', 'MANUAL']).optional(),
  profit: z.number().optional(),
  profit_percent: z.number().optional(),
  commission: z.number().optional(),
  swap: z.number().optional(),
  mistakes: z.string().optional(),
  note: z.string().optional(),
  trigger: z.string().optional(),
  bias: z.string().optional(),
});

const TradeUpdateSchema = TradeSchema.partial().omit({ account_id: true, deal_id: true });

interface TradeQueryParams {
  account_id?: string;
  symbol?: string;
  session?: string;
  result?: string;
  limit?: number;
  offset?: number;
}

interface StatsQueryParams {
  account_id?: string;
}

interface IdParams {
  id: string;
}

export async function tradesRoutes(fastify: FastifyInstance) {
  const db = getDatabase();

  // GET all trades
  fastify.get('/api/trades', async (request, reply) => {
    try {
      const { account_id, symbol, session, result, limit = 100, offset = 0 } = request.query as TradeQueryParams;

      let query = 'SELECT * FROM trades WHERE 1=1';
      const params: (string | number)[] = [];

      if (account_id) {
        query += ' AND account_id = ?';
        params.push(account_id);
      }

      if (symbol) {
        query += ' AND symbol = ?';
        params.push(symbol);
      }

      if (session) {
        query += ' AND session = ?';
        params.push(session);
      }

      if (result) {
        query += ' AND result = ?';
        params.push(result);
      }

      query += ' ORDER BY open_time DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const trades = db.prepare(query).all(...params);

      return { trades, count: trades.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      reply.status(500).send({ error: message });
    }
  });

  // GET single trade
  fastify.get('/api/trades/:id', async (request, reply) => {
    try {
      const { id } = request.params as IdParams;

      const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(id);

      if (!trade) {
        return reply.status(404).send({ error: 'Trade not found' });
      }

      return trade;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      reply.status(500).send({ error: message });
    }
  });

  // POST create trade
  fastify.post('/api/trades', async (request, reply) => {
    try {
      const validatedData = TradeSchema.parse(request.body);

      const stmt = db.prepare(`
        INSERT INTO trades (
          account_id, deal_id, ticket, symbol, direction, volume,
          open_price, close_price, stop_loss, take_profit,
          open_time, close_time, weekday, session,
          risk_percent, risk_reward, result,
          profit, profit_percent, commission, swap,
          mistakes, note, trigger, bias
        ) VALUES (
          @account_id, @deal_id, @ticket, @symbol, @direction, @volume,
          @open_price, @close_price, @stop_loss, @take_profit,
          @open_time, @close_time, @weekday, @session,
          @risk_percent, @risk_reward, @result,
          @profit, @profit_percent, @commission, @swap,
          @mistakes, @note, @trigger, @bias
        )
      `);

      const result = stmt.run(validatedData);

      const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(result.lastInsertRowid);

      reply.status(201).send(trade);
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400).send({ error: 'Validation error', details: error.errors });
      } else {
        const message = error instanceof Error ? error.message : 'Unknown error';
        reply.status(500).send({ error: message });
      }
    }
  });

  // PUT update trade
  fastify.put('/api/trades/:id', async (request, reply) => {
    try {
      const { id } = request.params as IdParams;
      const validatedData = TradeUpdateSchema.parse(request.body);

      // Check if trade exists
      const existing = db.prepare('SELECT * FROM trades WHERE id = ?').get(id);
      if (!existing) {
        return reply.status(404).send({ error: 'Trade not found' });
      }

      // Build update query
      const fields = Object.keys(validatedData);
      if (fields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      const setClause = fields.map(f => `${f} = @${f}`).join(', ');
      const query = `UPDATE trades SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = @id`;

      const stmt = db.prepare(query);
      stmt.run({ ...validatedData, id });

      const updated = db.prepare('SELECT * FROM trades WHERE id = ?').get(id);

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

  // DELETE trade
  fastify.delete('/api/trades/:id', async (request, reply) => {
    try {
      const { id } = request.params as IdParams;

      const existing = db.prepare('SELECT * FROM trades WHERE id = ?').get(id);
      if (!existing) {
        return reply.status(404).send({ error: 'Trade not found' });
      }

      db.prepare('DELETE FROM trades WHERE id = ?').run(id);

      return { success: true, message: 'Trade deleted' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      reply.status(500).send({ error: message });
    }
  });

  // GET trade statistics
  fastify.get('/api/trades/stats', async (request, reply) => {
    try {
      const { account_id } = request.query as StatsQueryParams;

      let whereClause = '1=1';
      const params: string[] = [];

      if (account_id) {
        whereClause = 'account_id = ?';
        params.push(account_id);
      }

      const stats = db.prepare(`
        SELECT
          COUNT(*) as total_trades,
          SUM(CASE WHEN profit > 0 THEN 1 ELSE 0 END) as winning_trades,
          SUM(CASE WHEN profit < 0 THEN 1 ELSE 0 END) as losing_trades,
          SUM(profit) as total_profit,
          AVG(profit) as avg_profit,
          MAX(profit) as best_trade,
          MIN(profit) as worst_trade,
          AVG(risk_reward) as avg_rr
        FROM trades
        WHERE ${whereClause} AND close_time IS NOT NULL
      `).get(...params);

      return stats;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      reply.status(500).send({ error: message });
    }
  });
}
