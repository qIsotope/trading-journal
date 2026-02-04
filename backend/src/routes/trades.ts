import { FastifyInstance } from 'fastify';
import { getDatabase } from '../db/database';
import { Trade } from '../db/schema';
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

export async function tradesRoutes(fastify: FastifyInstance) {
  const db = getDatabase();

  // GET all trades
  fastify.get('/api/trades', async (request, reply) => {
    try {
      const { account_id, symbol, session, result, limit = 100, offset = 0 } = request.query as any;

      let query = 'SELECT * FROM trades WHERE 1=1';
      const params: any[] = [];

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
    } catch (error: any) {
      reply.status(500).send({ error: error.message });
    }
  });

  // GET single trade
  fastify.get('/api/trades/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(id);

      if (!trade) {
        return reply.status(404).send({ error: 'Trade not found' });
      }

      return trade;
    } catch (error: any) {
      reply.status(500).send({ error: error.message });
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
    } catch (error: any) {
      if (error.name === 'ZodError') {
        reply.status(400).send({ error: 'Validation error', details: error.errors });
      } else {
        reply.status(500).send({ error: error.message });
      }
    }
  });

  // PUT update trade
  fastify.put('/api/trades/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
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
    } catch (error: any) {
      if (error.name === 'ZodError') {
        reply.status(400).send({ error: 'Validation error', details: error.errors });
      } else {
        reply.status(500).send({ error: error.message });
      }
    }
  });

  // DELETE trade
  fastify.delete('/api/trades/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const existing = db.prepare('SELECT * FROM trades WHERE id = ?').get(id);
      if (!existing) {
        return reply.status(404).send({ error: 'Trade not found' });
      }

      db.prepare('DELETE FROM trades WHERE id = ?').run(id);

      return { success: true, message: 'Trade deleted' };
    } catch (error: any) {
      reply.status(500).send({ error: error.message });
    }
  });

  // GET trade statistics
  fastify.get('/api/trades/stats', async (request, reply) => {
    try {
      const { account_id } = request.query as any;

      let whereClause = '1=1';
      const params: any[] = [];

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
    } catch (error: any) {
      reply.status(500).send({ error: error.message });
    }
  });

  // GET management log for trade
  fastify.get('/api/trades/:id/management-log', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const logs = db.prepare(`
        SELECT * FROM trade_management_log
        WHERE trade_id = ?
        ORDER BY timestamp DESC
      `).all(id);

      return { logs };
    } catch (error: any) {
      reply.status(500).send({ error: error.message });
    }
  });

  // POST management log entry
  fastify.post('/api/trades/:id/management-log', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { action_type, old_sl, new_sl, old_tp, new_tp, price_at_change, pips_moved, reason } = request.body as any;

      const stmt = db.prepare(`
        INSERT INTO trade_management_log (
          trade_id, action_type, old_sl, new_sl, old_tp, new_tp,
          price_at_change, pips_moved, reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(id, action_type, old_sl, new_sl, old_tp, new_tp, price_at_change, pips_moved, reason);

      const log = db.prepare('SELECT * FROM trade_management_log WHERE id = ?').get(result.lastInsertRowid);

      reply.status(201).send(log);
    } catch (error: any) {
      reply.status(500).send({ error: error.message });
    }
  });
}
