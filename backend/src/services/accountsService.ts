import type { FastifyBaseLogger } from 'fastify';
import { decrypt, encrypt } from '../lib/crypto';
import {
  findAccountByIdPublicSupabase,
  findAccountByIdWithSecretSupabase,
  getAccountStatsSupabase,
  insertAccountSupabase,
  listActiveAccountsSupabase,
  softDeleteAccountByIdSupabase,
  updateAccountByIdSupabase,
} from '../repositories/supabaseAccountsRepository';
import { fetchMt5SyncData, persistSyncDataSupabase } from './accountSyncService';

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

export async function getAccounts(userId: string) {
  return listActiveAccountsSupabase(userId);
}

export async function getAccountById(id: string, userId: string) {
  return findAccountByIdPublicSupabase(id, userId);
}

export async function createAccount(input: CreateAccountInput) {
  return insertAccountSupabase({
    user_id: input.user_id,
    mt5_login: input.mt5_login,
    mt5_server: input.mt5_server,
    mt5_password_encrypted: encrypt(input.mt5_password),
    account_name: input.account_name,
  });
}

export async function updateAccount(id: string, userId: string, input: UpdateAccountInput) {
  const existing = await findAccountByIdWithSecretSupabase(id, userId);

  if (!existing) {
    return { exists: false, changed: false, updated: undefined };
  }

  const result = await updateAccountByIdSupabase(id, userId, {
    mt5_server: input.mt5_server,
    mt5_password_encrypted: input.mt5_password ? encrypt(input.mt5_password) : undefined,
    account_name: input.account_name,
  });

  return { exists: true, ...result };
}

export async function deactivateAccount(id: string, userId: string) {
  return softDeleteAccountByIdSupabase(id, userId);
}

export async function syncAccountWithMt5(params: {
  id: string;
  userId: string;
  resyncNotion: boolean;
  logger: FastifyBaseLogger;
}) {
  const account = await findAccountByIdWithSecretSupabase(params.id, params.userId);

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
  const result = await persistSyncDataSupabase({
    accountId: Number(account.id),
    userId: params.userId,
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

export async function getStatsByAccountId(id: string, userId: string) {
  return getAccountStatsSupabase(id, userId);
}
