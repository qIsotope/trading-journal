import Database from 'better-sqlite3';
import { createTablesSQL } from './schema';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'trading-journal.db');

export const db = new Database(DB_PATH);

db.pragma('foreign_keys = ON');

export function initDatabase() {
  console.log('🗄️  Initializing database...');

  try {
    db.exec(createTablesSQL);
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}

export function checkDatabaseHealth() {
  try {
    const result = db.prepare('SELECT 1 as health').get();
    return result !== undefined;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

process.on('SIGINT', () => {
  console.log('\n👋 Closing database...');
  db.close();
  process.exit(0);
});

export default db;
