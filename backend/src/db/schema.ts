export const createTablesSQL = `
-- MT5 Accounts
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mt5_login TEXT UNIQUE NOT NULL,
  mt5_server TEXT NOT NULL,
  mt5_password_encrypted TEXT NOT NULL,
  account_name TEXT,
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
  trade_type TEXT NOT NULL,
  volume REAL NOT NULL,
  open_price REAL NOT NULL,
  close_price REAL,
  open_time DATETIME NOT NULL,
  close_time DATETIME,
  profit REAL DEFAULT 0,
  commission REAL DEFAULT 0,
  swap REAL DEFAULT 0,
  comment TEXT,
  notion_page_id TEXT,
  synced_to_notion BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  UNIQUE(account_id, deal_id)
);

-- Open Positions
CREATE TABLE IF NOT EXISTS open_positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  position_id TEXT NOT NULL,
  ticket TEXT,
  symbol TEXT NOT NULL,
  position_type TEXT NOT NULL,
  volume REAL NOT NULL,
  open_price REAL NOT NULL,
  current_price REAL,
  open_time DATETIME NOT NULL,
  profit REAL DEFAULT 0,
  swap REAL DEFAULT 0,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  UNIQUE(account_id, position_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trades_account ON trades(account_id);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_open_time ON trades(open_time);
CREATE INDEX IF NOT EXISTS idx_trades_notion ON trades(synced_to_notion);
CREATE INDEX IF NOT EXISTS idx_positions_account ON open_positions(account_id);
`;

export interface Account {
  id?: number;
  mt5_login: string;
  mt5_server: string;
  mt5_password_encrypted: string;
  account_name?: string;
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
  created_at?: string;
  updated_at?: string;
}

export interface OpenPosition {
  id?: number;
  account_id: number;
  position_id: string;
  ticket?: string;
  symbol: string;
  position_type: 'BUY' | 'SELL';
  volume: number;
  open_price: number;
  current_price?: number;
  open_time: string;
  profit?: number;
  swap?: number;
  last_updated?: string;
}
