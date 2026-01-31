const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface Trade {
  id?: number;
  account_id: number;
  deal_id: string;
  ticket?: string;
  symbol: string;
  trade_type: 'BUY' | 'SELL';
  volume: number;
  open_price: number;
  close_price?: number;
  open_time: string;
  close_time?: string;
  profit?: number;
  commission?: number;
  swap?: number;
  comment?: string;
  notion_page_id?: string;
  synced_to_notion?: boolean;
}

export interface Account {
  id?: number;
  mt5_login: string;
  mt5_server: string;
  account_name?: string;
  is_active?: boolean;
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_URL;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  // Health check
  async healthCheck() {
    return this.request<{ status: string; database: string; timestamp: string }>('/health');
  }

  // Trades
  async getTrades() {
    return this.request<Trade[]>('/api/trades');
  }

  async createTrade(trade: Omit<Trade, 'id'>) {
    return this.request<Trade>('/api/trades', {
      method: 'POST',
      body: JSON.stringify(trade),
    });
  }

  // Accounts
  async getAccounts() {
    return this.request<Account[]>('/api/accounts');
  }

  async createAccount(account: Omit<Account, 'id'>) {
    return this.request<Account>('/api/accounts', {
      method: 'POST',
      body: JSON.stringify(account),
    });
  }
}

export const apiClient = new ApiClient();
