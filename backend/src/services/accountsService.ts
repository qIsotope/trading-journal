import type { FastifyBaseLogger } from 'fastify';
import { getDatabase } from '../db/database';
import { decrypt, encrypt } from '../lib/crypto';
import {
  findAccountByIdPublic,
  findAccountByIdWithSecret,
  getAccountStats,
  insertAccount,
  listActiveAccounts,
  softDeleteAccountById,
  updateAccountById,
} from '../repositories/accountsRepository';
import { fetchMt5SyncData, persistSyncData } from './accountSyncService';

export interface CreateAccountInput {
  user_id: string;
  mt5_login: string;
  mt5_server: string;
  mt5_password: string;
  account_name?: string;
}

export interface UpdateAccountInput {
  mt5_server?: string;
  mt5_password?: string;
  account_name?: string;
}

export function getAccounts(userId: string) {
  const db = getDatabase();
  return listActiveAccounts(db, userId);
}

export function getAccountById(id: string, userId: string) {
  const db = getDatabase();
  return findAccountByIdPublic(db, id, userId);
}

export function createAccount(input: CreateAccountInput) {
  const db = getDatabase();
  const encryptedPassword = encrypt(input.mt5_password);

  return insertAccount(db, {
    user_id: input.user_id,
    mt5_login: input.mt5_login,
    mt5_server: input.mt5_server,
    mt5_password_encrypted: encryptedPassword,
    account_name: input.account_name,
  });
}

export function updateAccount(id: string, userId: string, input: UpdateAccountInput) {
  const db = getDatabase();
  const existing = findAccountByIdWithSecret(db, id, userId);

  if (!existing) {
    return { exists: false, changed: false, updated: undefined };
  }

  const result = updateAccountById(db, id, userId, {
    mt5_server: input.mt5_server,
    mt5_password_encrypted: input.mt5_password ? encrypt(input.mt5_password) : undefined,
    account_name: input.account_name,
  });

  return { exists: true, ...result };
}

export function deactivateAccount(id: string, userId: string) {
  const db = getDatabase();
  const existing = findAccountByIdWithSecret(db, id, userId);

  if (!existing) {
    return false;
  }

  softDeleteAccountById(db, id, userId);
  return true;
}

export async function syncAccountWithMt5(params: {
  id: string;
  userId: string;
  resyncNotion: boolean;
  logger: FastifyBaseLogger;
}) {
  const db = getDatabase();
  const account = findAccountByIdWithSecret(db, params.id, params.userId);

  if (!account) {
    return { found: false as const };
  }

  let decryptedPassword: string;
  try {
    decryptedPassword = decrypt(account.mt5_password_encrypted);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to decrypt password';
    throw new Error(message);
  }

  const syncData = await fetchMt5SyncData(account, decryptedPassword);
  const result = await persistSyncData({
    db,
    accountId: params.id,
    accountName: account.account_name,
    syncData,
    resyncNotion: params.resyncNotion,
    logger: params.logger,
  });

  return {
    found: true as const,
    result,
  };
}

export function getStatsByAccountId(id: string, userId: string) {
  const db = getDatabase();
  return getAccountStats(db, id, userId);
}
