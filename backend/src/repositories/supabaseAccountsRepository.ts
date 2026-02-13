import { getSupabaseAdminClient } from '../clients/supabaseClient';
import type {
  AccountInsertInput,
  AccountPublicView,
  AccountStatsView,
  AccountUpdateInput,
} from './accountsRepository';

interface SupabaseAccountRow {
  id: number;
  user_id: string;
  mt5_login: string;
  mt5_server: string;
  mt5_password_encrypted: string;
  account_name: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

function toAccountPublicView(row: SupabaseAccountRow): AccountPublicView {
  return {
    id: row.id,
    mt5_login: row.mt5_login,
    mt5_server: row.mt5_server,
    account_name: row.account_name,
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_active: row.is_active ? 1 : 0,
  };
}

export async function listActiveAccountsSupabase(userId: string): Promise<AccountPublicView[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('accounts')
    .select('id, user_id, mt5_login, mt5_server, mt5_password_encrypted, account_name, created_at, updated_at, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => toAccountPublicView(row as SupabaseAccountRow));
}

export async function findAccountByIdPublicSupabase(id: string, userId: string): Promise<AccountPublicView | undefined> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('accounts')
    .select('id, user_id, mt5_login, mt5_server, mt5_password_encrypted, account_name, created_at, updated_at, is_active')
    .eq('id', Number(id))
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? toAccountPublicView(data as SupabaseAccountRow) : undefined;
}

export async function findAccountByIdWithSecretSupabase(id: string, userId: string): Promise<SupabaseAccountRow | undefined> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', Number(id))
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as SupabaseAccountRow | null) ?? undefined;
}

export async function insertAccountSupabase(payload: AccountInsertInput): Promise<AccountPublicView | undefined> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('accounts')
    .insert({
      user_id: payload.user_id,
      mt5_login: payload.mt5_login,
      mt5_server: payload.mt5_server,
      mt5_password_encrypted: payload.mt5_password_encrypted,
      account_name: payload.account_name ?? null,
    })
    .select('id, user_id, mt5_login, mt5_server, mt5_password_encrypted, account_name, created_at, updated_at, is_active')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data ? toAccountPublicView(data as SupabaseAccountRow) : undefined;
}

export async function updateAccountByIdSupabase(id: string, userId: string, payload: AccountUpdateInput) {
  const updates: Record<string, string | null> = {};

  if (payload.mt5_server) {
    updates.mt5_server = payload.mt5_server;
  }

  if (payload.mt5_password_encrypted) {
    updates.mt5_password_encrypted = payload.mt5_password_encrypted;
  }

  if (payload.account_name !== undefined) {
    updates.account_name = payload.account_name;
  }

  if (Object.keys(updates).length === 0) {
    return { changed: false, updated: undefined };
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('accounts')
    .update(updates)
    .eq('id', Number(id))
    .eq('user_id', userId)
    .select('id, user_id, mt5_login, mt5_server, mt5_password_encrypted, account_name, created_at, updated_at, is_active')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return {
    changed: true,
    updated: data ? toAccountPublicView(data as SupabaseAccountRow) : undefined,
  };
}

export async function softDeleteAccountByIdSupabase(id: string, userId: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('accounts')
    .update({ is_active: false })
    .eq('id', Number(id))
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function getAccountStatsSupabase(id: string, userId: string): Promise<AccountStatsView> {
  const supabase = getSupabaseAdminClient();

  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('id')
    .eq('id', Number(id))
    .eq('user_id', userId)
    .maybeSingle();

  if (accountError) {
    throw new Error(accountError.message);
  }

  if (!account) {
    return {
      total_trades: 0,
      winning_trades: 0,
      losing_trades: 0,
      total_profit: 0,
      avg_profit: 0,
      best_trade: 0,
      worst_trade: 0,
    };
  }

  const { data: trades, error: tradesError } = await supabase
    .from('trades')
    .select('profit')
    .eq('account_id', Number(id))
    .not('close_time', 'is', null);

  if (tradesError) {
    throw new Error(tradesError.message);
  }

  const profits = (trades ?? [])
    .map((row) => Number((row as { profit: number | null }).profit ?? 0))
    .filter((profit) => Number.isFinite(profit));

  const totalTrades = profits.length;
  const winningTrades = profits.filter((profit) => profit > 0).length;
  const losingTrades = profits.filter((profit) => profit < 0).length;
  const totalProfit = profits.reduce((sum, profit) => sum + profit, 0);
  const avgProfit = totalTrades > 0 ? totalProfit / totalTrades : 0;
  const bestTrade = totalTrades > 0 ? Math.max(...profits) : 0;
  const worstTrade = totalTrades > 0 ? Math.min(...profits) : 0;

  return {
    total_trades: totalTrades,
    winning_trades: winningTrades,
    losing_trades: losingTrades,
    total_profit: totalProfit,
    avg_profit: avgProfit,
    best_trade: bestTrade,
    worst_trade: worstTrade,
  };
}
