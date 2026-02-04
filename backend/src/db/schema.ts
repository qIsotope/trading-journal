export const createTablesSQL = `
-- MT5 Accounts
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mt5_login TEXT UNIQUE NOT NULL,
  mt5_server TEXT NOT NULL,
  mt5_password_encrypted TEXT NOT NULL,
  account_name TEXT,
  -- Account info from last sync
  balance REAL,
  equity REAL,
  margin REAL,
  margin_free REAL,
  profit REAL,
  currency TEXT,
  leverage INTEGER,
  last_synced_at DATETIME,
  -- Meta
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT 1
);

-- Trades
CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  deal_id TEXT NOT NULL,
  ticket TEXT,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('LONG', 'SHORT')),
  volume REAL NOT NULL,
  open_price REAL NOT NULL,
  close_price REAL,
  stop_loss REAL,
  take_profit REAL,
  open_time DATETIME NOT NULL,
  close_time DATETIME,
  weekday TEXT,
  session TEXT CHECK(session IN ('ASIA', 'FRANKFURT', 'LONDON', 'NEWYORK')),
  risk_percent REAL,
  risk_reward REAL,
  result TEXT CHECK(result IN ('BE', 'SL', 'TP', 'MANUAL')),
  profit REAL DEFAULT 0,
  profit_percent REAL,
  commission REAL DEFAULT 0,
  swap REAL DEFAULT 0,
  -- User editable fields
  mistakes TEXT,
  note TEXT,
  trigger TEXT,
  bias TEXT,
  -- Meta fields
  notion_page_id TEXT,
  synced_to_notion BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  UNIQUE(account_id, deal_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trades_account ON trades(account_id);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_open_time ON trades(open_time);
CREATE INDEX IF NOT EXISTS idx_trades_notion ON trades(synced_to_notion);
CREATE INDEX IF NOT EXISTS idx_trades_session ON trades(session);
CREATE INDEX IF NOT EXISTS idx_trades_result ON trades(result);
`;

export interface Account {
  id?: number;
  mt5_login: string;
  mt5_server: string;
  mt5_password_encrypted: string;
  account_name?: string;
  // Account info
  balance?: number;
  equity?: number;
  margin?: number;
  margin_free?: number;
  profit?: number;
  currency?: string;
  leverage?: number;
  last_synced_at?: string;
  // Meta
  created_at?: string;
  updated_at?: string;
  is_active?: boolean;
}

export interface Trade {
  id?: number;
  account_id: number;
  deal_id: string;
  ticket?: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  volume: number;
  open_price: number;
  close_price?: number;
  stop_loss?: number;
  take_profit?: number;
  open_time: string;
  close_time?: string;
  weekday?: string;
  session?: 'ASIA' | 'FRANKFURT' | 'LONDON' | 'NEWYORK';
  risk_percent?: number;
  risk_reward?: number;
  result?: 'BE' | 'SL' | 'TP' | 'MANUAL';
  profit?: number;
  profit_percent?: number;
  commission?: number;
  swap?: number;
  // User editable
  mistakes?: string;
  note?: string;
  trigger?: string;
  bias?: string;
  // Meta
  notion_page_id?: string;
  synced_to_notion?: boolean;
  created_at?: string;
  updated_at?: string;
}
