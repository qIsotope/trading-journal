import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../db/database';
import type { Account } from '../db/schema';
import { z } from 'zod';
import { encrypt, decrypt } from '../lib/crypto';
import { createNotionTradePage, fetchNotionDatabase } from '../lib/notion';

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
  open_time: number;
  close_time: number | null;
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

const START_BALANCE = Number(process.env.ACCOUNT_START_BALANCE || 10000);
const BE_THRESHOLD_PERCENT = Number(process.env.BE_THRESHOLD_PERCENT || 0.15); // 15$ of 10k = 0.15%
const SL_TOLERANCE_PERCENT = Number(process.env.SL_TOLERANCE_PERCENT || 10);
const CONTRACT_SIZE_DEFAULT = Number(process.env.CONTRACT_SIZE_DEFAULT || 100000);

const calcRiskMoney = (openPrice: number, stopLoss: number | null, volume: number) => {
  if (!stopLoss || openPrice === 0) return null;
  return Math.abs(openPrice - stopLoss) * volume * CONTRACT_SIZE_DEFAULT;
};

const TIME_OFFSET_HOURS = -2;

const getWeekdayFromTs = (ts: number, offsetHours = 0) => {
  const date = new Date((ts + offsetHours * 3600) * 1000);
  const weekdayIndex = date.getDay();
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return names[weekdayIndex] || 'Unknown';
};

const getSessionFromTs = (ts: number, offsetHours = 0) => {
  const hour = new Date((ts + offsetHours * 3600) * 1000).getHours();
  if (hour >= 0 && hour < 9) return 'ASIA';
  if (hour >= 9 && hour < 10) return 'FRANKFURT';
  if (hour >= 10 && hour < 15) return 'LONDON';
  if (hour >= 15 && hour < 23) return 'NEWYORK';
  return 'ASIA';
};

const getDateOnlyFromTs = (ts: number, offsetHours = 0) => {
  const date = new Date((ts + offsetHours * 3600) * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatIsoFromTs = (ts: number, offsetHours = 0) => {
  const date = new Date((ts + offsetHours * 3600) * 1000);
  return date.toISOString();
};

const calcRiskPercent = (riskMoney: number | null) => {
  if (!riskMoney || START_BALANCE === 0) return null;
  return (riskMoney / START_BALANCE) * 100;
};

const calcProfitPercent = (profit: number) => {
  if (START_BALANCE === 0) return null;
  return (profit / START_BALANCE) * 100;
};

const round2 = (value: number | null) => {
  if (value === null) return null;
  return Math.round(value * 100) / 100;
};

const getResult = (profit: number, riskMoney: number | null, profitPercent: number | null) => {
  if (profitPercent !== null && Math.abs(profitPercent) <= BE_THRESHOLD_PERCENT) return 'BE';

  if (riskMoney !== null && profit < 0) {
    const tolerance = Math.abs(riskMoney) * (SL_TOLERANCE_PERCENT / 100);
    if (Math.abs(profit + riskMoney) <= tolerance) return 'SL';
  }

  if (profit > 0) return 'TP';
  return 'MANUAL';
};

const calcRiskReward = (profit: number, riskMoney: number | null, result: string) => {
  if (result === 'BE') return 0;
  if (result === 'SL') return -1;
  if (!riskMoney || riskMoney === 0) return null;
  return profit / riskMoney;
};

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
      const { resync_notion } = request.query as { resync_notion?: string };

      // Get account with encrypted password
      const account = db.query('SELECT * FROM accounts WHERE id = ?').get(id) as Account | undefined;
      if (!account) {
        return reply.status(404).send({ error: 'Account not found' });
      }

      // Decrypt password
      let decryptedPassword: string;
      try {
        decryptedPassword = decrypt(account.mt5_password_encrypted);
      } catch (decryptError) {
        const message = decryptError instanceof Error ? decryptError.message : 'Failed to decrypt password';
        return reply.status(400).send({ error: message });
      }

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
          open_time, close_time, weekday, session,
          risk_percent, risk_reward, result,
          profit, profit_percent, commission, swap
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const trade of syncData.trades) {
        const weekday = getWeekdayFromTs(trade.open_time, TIME_OFFSET_HOURS);
        const session = getSessionFromTs(trade.open_time, TIME_OFFSET_HOURS);
        const riskMoney = calcRiskMoney(trade.open_price, trade.stop_loss, trade.volume);
        const riskPercent = round2(calcRiskPercent(riskMoney));
        const profitPercent = calcProfitPercent(trade.profit);
        const result = getResult(trade.profit, riskMoney, profitPercent);
        const riskReward = round2(calcRiskReward(trade.profit, riskMoney, result));
        const commission = round2(trade.commission) ?? trade.commission;

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
          weekday,
          session,
          riskPercent,
          riskReward,
          result,
          trade.profit,
          profitPercent,
          commission,
          trade.swap
        );
      }

      if (resync_notion === '1') {
        db.query(
          'UPDATE trades SET synced_to_notion = 0, notion_page_id = NULL WHERE account_id = ?'
        ).run(id);
        fastify.log.info({ notion: 'resync_reset', account_id: id });
      }

      // Sync trades to Notion (if configured)
      const getTradeSyncState = db.query(
        'SELECT id, synced_to_notion FROM trades WHERE account_id = ? AND deal_id = ?'
      );
      const updateTradeNotion = db.query(`
        UPDATE trades
        SET notion_page_id = ?, synced_to_notion = 1, updated_at = CURRENT_TIMESTAMP
        WHERE account_id = ? AND deal_id = ?
      `);

      fastify.log.info({ notion: 'sync_start', trades: syncData.trades.length, account_id: id });

      for (const trade of syncData.trades) {
        const existing = getTradeSyncState.get(id, String(trade.deal_id)) as
          | { id: number; synced_to_notion: number }
          | undefined;

        if (!existing || existing.synced_to_notion) {
          fastify.log.info({ notion: 'skip', deal_id: trade.deal_id, reason: !existing ? 'not_inserted' : 'already_synced' });
          continue;
        }

        const weekday = getWeekdayFromTs(trade.open_time, TIME_OFFSET_HOURS);
        const session = getSessionFromTs(trade.open_time, TIME_OFFSET_HOURS);
        const riskMoney = calcRiskMoney(trade.open_price, trade.stop_loss, trade.volume);
        const riskPercent = round2(calcRiskPercent(riskMoney));
        const profitPercent = calcProfitPercent(trade.profit);
        const result = getResult(trade.profit, riskMoney, profitPercent);
        const riskReward = round2(calcRiskReward(trade.profit, riskMoney, result));
        const date = getDateOnlyFromTs(trade.open_time, TIME_OFFSET_HOURS);
        const openTime = formatIsoFromTs(trade.open_time, TIME_OFFSET_HOURS);
        const closeTime = trade.close_time ? formatIsoFromTs(trade.close_time, TIME_OFFSET_HOURS) : null;

        try {
          fastify.log.info({ notion: 'create_page_start', deal_id: trade.deal_id });
          const notionPageId = await createNotionTradePage({
            accountId: id,
            accountName: account.account_name ?? null,
            trade: {
              ...trade,
              open_time: openTime,
              close_time: closeTime,
              weekday,
              session,
              date,
              result,
              risk_percent: riskPercent,
              risk_reward: riskReward,
            },
          });

          if (notionPageId) {
            fastify.log.info({ notion: 'create_page_success', deal_id: trade.deal_id, notion_page_id: notionPageId });
            updateTradeNotion.run(notionPageId, id, String(trade.deal_id));
          } else {
            fastify.log.warn({ notion: 'create_page_empty', deal_id: trade.deal_id });
          }
        } catch (notionError) {
          fastify.log.error({ notion: 'create_page_error', deal_id: trade.deal_id, error: notionError });
        }
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

  // GET Notion test endpoint (logs database rows)
  fastify.get('/api/notion/test', async (_request, reply) => {
    try {
      const results = await fetchNotionDatabase(10);

      if (!results) {
        return reply.status(400).send({ error: 'Notion is not configured' });
      }

      fastify.log.info({ notion_count: results.length, results });
      return { success: true, count: results.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      reply.status(500).send({ error: message });
    }
  });
}
