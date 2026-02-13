import type { Database } from 'bun:sqlite';
import type { FastifyBaseLogger } from 'fastify';
import type { MT5Trade } from '../clients/mt5Client';
import { createNotionTradePage } from '../lib/notion';
import {
  getTradeSyncStateSupabase,
  markTradeNotionSyncedSupabase,
} from '../repositories/supabaseTradesRepository';
import { buildTradeMetrics } from './tradeMetricsService';

export async function syncTradesToNotion(params: {
  db: Database;
  accountId: string;
  accountName: string | null | undefined;
  trades: MT5Trade[];
  logger: FastifyBaseLogger;
}) {
  const { db, accountId, accountName, trades, logger } = params;

  const getTradeSyncState = db.query('SELECT id, synced_to_notion FROM trades WHERE account_id = ? AND deal_id = ?');
  const updateTradeNotion = db.query(`
    UPDATE trades
    SET notion_page_id = ?, synced_to_notion = 1, updated_at = CURRENT_TIMESTAMP
    WHERE account_id = ? AND deal_id = ?
  `);

  logger.info({ notion: 'sync_start', trades: trades.length, account_id: accountId });

  for (const trade of trades) {
    const existing = getTradeSyncState.get(accountId, String(trade.deal_id)) as
      | { id: number; synced_to_notion: number }
      | undefined;

    if (!existing || existing.synced_to_notion) {
      logger.info({ notion: 'skip', deal_id: trade.deal_id, reason: !existing ? 'not_inserted' : 'already_synced' });
      continue;
    }

    const metrics = buildTradeMetrics(trade);

    try {
      logger.info({ notion: 'create_page_start', deal_id: trade.deal_id });
      const notionPageId = await createNotionTradePage({
        accountId,
        accountName: accountName ?? null,
        trade: {
          ...trade,
          open_time: metrics.openTimeIso,
          close_time: metrics.closeTimeIso,
          weekday: metrics.weekday,
          session: metrics.session,
          date: metrics.date,
          result: metrics.result,
          risk_percent: metrics.riskPercent,
          risk_reward: metrics.riskReward,
        },
      });

      if (notionPageId) {
        logger.info({ notion: 'create_page_success', deal_id: trade.deal_id, notion_page_id: notionPageId });
        updateTradeNotion.run(notionPageId, accountId, String(trade.deal_id));
      } else {
        logger.warn({ notion: 'create_page_empty', deal_id: trade.deal_id });
      }
    } catch (notionError) {
      logger.error({ notion: 'create_page_error', deal_id: trade.deal_id, error: notionError });
    }
  }
}

export async function syncTradesToNotionSupabase(params: {
  accountId: number;
  accountName: string | null | undefined;
  trades: MT5Trade[];
  logger: FastifyBaseLogger;
}) {
  const { accountId, accountName, trades, logger } = params;

  logger.info({ notion: 'sync_start', trades: trades.length, account_id: accountId });

  for (const trade of trades) {
    const existing = await getTradeSyncStateSupabase(accountId, String(trade.deal_id));

    if (!existing || existing.synced_to_notion) {
      logger.info({ notion: 'skip', deal_id: trade.deal_id, reason: !existing ? 'not_inserted' : 'already_synced' });
      continue;
    }

    const metrics = buildTradeMetrics(trade);

    try {
      logger.info({ notion: 'create_page_start', deal_id: trade.deal_id });
      const notionPageId = await createNotionTradePage({
        accountId: String(accountId),
        accountName: accountName ?? null,
        trade: {
          ...trade,
          open_time: metrics.openTimeIso,
          close_time: metrics.closeTimeIso,
          weekday: metrics.weekday,
          session: metrics.session,
          date: metrics.date,
          result: metrics.result,
          risk_percent: metrics.riskPercent,
          risk_reward: metrics.riskReward,
        },
      });

      if (notionPageId) {
        logger.info({ notion: 'create_page_success', deal_id: trade.deal_id, notion_page_id: notionPageId });
        await markTradeNotionSyncedSupabase(accountId, String(trade.deal_id), notionPageId);
      } else {
        logger.warn({ notion: 'create_page_empty', deal_id: trade.deal_id });
      }
    } catch (notionError) {
      logger.error({ notion: 'create_page_error', deal_id: trade.deal_id, error: notionError });
    }
  }
}
