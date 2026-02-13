import type { Database } from 'bun:sqlite';
import type { Account } from '../db/schema';

export interface AccountPublicView {
  id: number;
  mt5_login: string;
  mt5_server: string;
  account_name: string | null;
  created_at: string;
  updated_at: string;
  is_active: number;
}

export interface AccountStatsView {
  total_trades: number;
  winning_trades: number | null;
  losing_trades: number | null;
  total_profit: number | null;
  avg_profit: number | null;
  best_trade: number | null;
  worst_trade: number | null;
}

export interface AccountInsertInput {
  user_id: string;
  mt5_login: string;
  mt5_server: string;
  mt5_password_encrypted: string;
  account_name?: string;
}

export interface AccountUpdateInput {
  mt5_server?: string;
  mt5_password_encrypted?: string;
  account_name?: string;
}

export function listActiveAccounts(db: Database, userId: string) {
  return db
    .prepare(
      `
      SELECT id, mt5_login, mt5_server, account_name, created_at, updated_at, is_active
      FROM accounts
      WHERE is_active = 1 AND user_id = ?
      ORDER BY created_at DESC
    `
    )
    .all(userId) as AccountPublicView[];
}

export function findAccountByIdPublic(db: Database, id: string, userId: string) {
  return db
    .prepare(
      `
      SELECT id, mt5_login, mt5_server, account_name, created_at, updated_at, is_active
      FROM accounts
      WHERE id = ? AND user_id = ?
    `
    )
    .get(id, userId) as AccountPublicView | undefined;
}

export function findAccountByIdWithSecret(db: Database, id: string, userId: string) {
  return db.query('SELECT * FROM accounts WHERE id = ? AND user_id = ?').get(id, userId) as Account | undefined;
}

export function insertAccount(db: Database, payload: AccountInsertInput) {
  const stmt = db.query(
    `
      INSERT INTO accounts (user_id, mt5_login, mt5_server, mt5_password_encrypted, account_name)
      VALUES (?, ?, ?, ?, ?)
    `
  );

  const result = stmt.run(
    payload.user_id,
    payload.mt5_login,
    payload.mt5_server,
    payload.mt5_password_encrypted,
    payload.account_name || null
  );

  return db
    .query(
      `
      SELECT id, mt5_login, mt5_server, account_name, created_at, updated_at, is_active
      FROM accounts
      WHERE id = ? AND user_id = ?
    `
    )
    .get(result.lastInsertRowid, payload.user_id) as AccountPublicView | undefined;
}

export function updateAccountById(db: Database, id: string, userId: string, payload: AccountUpdateInput) {
  const updates: string[] = [];
  const params: (string | number | null)[] = [];

  if (payload.mt5_server) {
    updates.push('mt5_server = ?');
    params.push(payload.mt5_server);
  }

  if (payload.mt5_password_encrypted) {
    updates.push('mt5_password_encrypted = ?');
    params.push(payload.mt5_password_encrypted);
  }

  if (payload.account_name !== undefined) {
    updates.push('account_name = ?');
    params.push(payload.account_name);
  }

  if (updates.length === 0) {
    return { updated: undefined, changed: false };
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id, userId);

  const query = `UPDATE accounts SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`;
  db.prepare(query).run(...params);

  const updated = findAccountByIdPublic(db, id, userId);
  return { updated, changed: true };
}

export function softDeleteAccountById(db: Database, id: string, userId: string) {
  db.prepare('UPDATE accounts SET is_active = 0 WHERE id = ? AND user_id = ?').run(id, userId);
}

export function getAccountStats(db: Database, id: string, userId: string) {
  return db
    .prepare(
      `
      SELECT
        COUNT(*) as total_trades,
        SUM(CASE WHEN profit > 0 THEN 1 ELSE 0 END) as winning_trades,
        SUM(CASE WHEN profit < 0 THEN 1 ELSE 0 END) as losing_trades,
        SUM(profit) as total_profit,
        AVG(profit) as avg_profit,
        MAX(profit) as best_trade,
        MIN(profit) as worst_trade
      FROM trades
      WHERE account_id = ?
        AND close_time IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM accounts a
          WHERE a.id = trades.account_id AND a.user_id = ?
        )
    `
    )
    .get(id, userId) as AccountStatsView;
}
