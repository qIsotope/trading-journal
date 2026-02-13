import { getSupabaseAdminClient } from '../clients/supabaseClient';

export interface SupabaseTradeInsertInput {
  account_id: number;
  deal_id: string;
  ticket?: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  volume: number;
  open_price: number;
  close_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  open_time: string;
  close_time: string | null;
  weekday: string;
  session: 'ASIA' | 'FRANKFURT' | 'LONDON' | 'NEWYORK';
  risk_percent: number | null;
  risk_reward: number | null;
  result: 'BE' | 'SL' | 'TP' | 'MANUAL';
  profit: number;
  profit_percent: number | null;
  commission: number;
  swap: number;
}

export async function updateAccountSnapshotSupabase(params: {
  accountId: number;
  userId: string;
  balance: number;
  equity: number;
  margin: number;
  marginFree: number;
  profit: number;
  currency: string;
  leverage: number;
}) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('accounts')
    .update({
      balance: params.balance,
      equity: params.equity,
      margin: params.margin,
      margin_free: params.marginFree,
      profit: params.profit,
      currency: params.currency,
      leverage: params.leverage,
      last_synced_at: new Date().toISOString(),
    })
    .eq('id', params.accountId)
    .eq('user_id', params.userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function insertTradesIgnoreDuplicatesSupabase(rows: SupabaseTradeInsertInput[]) {
  if (rows.length === 0) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from('trades').upsert(rows, {
    onConflict: 'account_id,deal_id',
    ignoreDuplicates: true,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function resetTradesNotionSyncSupabase(accountId: number) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('trades')
    .update({ synced_to_notion: false, notion_page_id: null })
    .eq('account_id', accountId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getTradeSyncStateSupabase(accountId: number, dealId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('trades')
    .select('id, synced_to_notion')
    .eq('account_id', accountId)
    .eq('deal_id', dealId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as { id: number; synced_to_notion: boolean } | null) ?? undefined;
}

export async function markTradeNotionSyncedSupabase(accountId: number, dealId: string, notionPageId: string) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('trades')
    .update({
      notion_page_id: notionPageId,
      synced_to_notion: true,
      updated_at: new Date().toISOString(),
    })
    .eq('account_id', accountId)
    .eq('deal_id', dealId);

  if (error) {
    throw new Error(error.message);
  }
}
