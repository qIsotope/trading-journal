import { Database } from 'bun:sqlite';
import { createTablesSQL } from './schema';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'trading-journal.db');

export const db = new Database(DB_PATH);

db.run('PRAGMA foreign_keys = ON');

type ColumnDef = {
  name: string;
  type: string;
  defaultValue?: string;
};

const ensureColumns = (tableName: string, columns: ColumnDef[]) => {
  const existing = db
    .query(`PRAGMA table_info(${tableName})`)
    .all()
    .map((col: any) => col.name as string);

  for (const column of columns) {
    if (existing.includes(column.name)) continue;
    const defaultClause = column.defaultValue ? ` DEFAULT ${column.defaultValue}` : '';
    db.run(`ALTER TABLE ${tableName} ADD COLUMN ${column.name} ${column.type}${defaultClause}`);
    console.log(`➕ Added column ${tableName}.${column.name}`);
  }
};

export function initDatabase() {
  console.log('🗄️  Initializing database...');

  try {
    db.run(createTablesSQL);

    // Migrations for existing databases (add missing columns)
    ensureColumns('accounts', [
      { name: 'balance', type: 'REAL' },
      { name: 'equity', type: 'REAL' },
      { name: 'margin', type: 'REAL' },
      { name: 'margin_free', type: 'REAL' },
      { name: 'profit', type: 'REAL' },
      { name: 'currency', type: 'TEXT' },
      { name: 'leverage', type: 'INTEGER' },
      { name: 'last_synced_at', type: 'DATETIME' },
    ]);

    ensureColumns('trades', [
      { name: 'ticket', type: 'TEXT' },
      { name: 'open_price', type: 'REAL' },
      { name: 'close_price', type: 'REAL' },
      { name: 'stop_loss', type: 'REAL' },
      { name: 'take_profit', type: 'REAL' },
      { name: 'weekday', type: 'TEXT' },
      { name: 'session', type: 'TEXT' },
      { name: 'risk_percent', type: 'REAL' },
      { name: 'risk_reward', type: 'REAL' },
      { name: 'result', type: 'TEXT' },
      { name: 'profit_percent', type: 'REAL' },
      { name: 'notion_page_id', type: 'TEXT' },
      { name: 'synced_to_notion', type: 'BOOLEAN', defaultValue: '0' },
    ]);

    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}

export function checkDatabaseHealth() {
  try {
    const result = db.query('SELECT 1 as health').get();
    return result !== undefined;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

export function getDatabase() {
  return db;
}

process.on('SIGINT', () => {
  console.log('\n👋 Closing database...');
  db.close();
  process.exit(0);
});

export default db;
