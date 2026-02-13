import type { Database } from 'bun:sqlite';
import type { FastifyBaseLogger } from 'fastify';
import type { MT5SyncResponse } from '../clients/mt5Client';
import { buildTradeMetrics } from './tradeMetricsService';
import { syncTradesToNotion } from './notionSyncService';

export { fetchMt5SyncData } from '../clients/mt5Client';

export async function persistSyncData(params: {
  db: Database;
  accountId: string;
  accountName: string | null | undefined;
  syncData: MT5SyncResponse;
  resyncNotion: boolean;
  logger: FastifyBaseLogger;
}) {
  const { db, accountId, accountName, syncData, resyncNotion, logger } = params;

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
    accountId
  );

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
    const metrics = buildTradeMetrics(trade);

    insertTrade.run(
      accountId,
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
      metrics.weekday,
      metrics.session,
      metrics.riskPercent,
      metrics.riskReward,
      metrics.result,
      trade.profit,
      metrics.profitPercent,
      metrics.commission,
      trade.swap
    );
  }

  if (resyncNotion) {
    db.query('UPDATE trades SET synced_to_notion = 0, notion_page_id = NULL WHERE account_id = ?').run(accountId);
    logger.info({ notion: 'resync_reset', account_id: accountId });
  }

  await syncTradesToNotion({
    db,
    accountId,
    accountName,
    trades: syncData.trades,
    logger,
  });

  return {
    success: true,
    message: `Synced ${syncData.trades_count} trades`,
    account_info: syncData.account_info,
    new_trades: syncData.trades_count,
  };
}
