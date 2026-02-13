import type { Account } from '../db/schema';

export interface MT5AccountInfo {
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

export interface MT5Trade {
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

export interface MT5SyncResponse {
  success: boolean;
  account_info: MT5AccountInfo;
  trades: MT5Trade[];
  trades_count: number;
}

export async function fetchMt5SyncData(account: Account, decryptedPassword: string): Promise<MT5SyncResponse> {
  const response = await fetch('http://localhost:8000/sync-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      login: Number(account.mt5_login),
      password: decryptedPassword,
      server: account.mt5_server,
    }),
  });

  if (!response.ok) {
    const errorData = (await response.json()) as { detail?: string };
    throw new Error(errorData.detail || 'Failed to sync with MT5');
  }

  return (await response.json()) as MT5SyncResponse;
}
