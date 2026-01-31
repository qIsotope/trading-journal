import { initDatabase, checkDatabaseHealth, db } from './database';

console.log('🔄 Running database migration...\n');

initDatabase();

if (checkDatabaseHealth()) {
  console.log('✅ Database is healthy\n');

  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    ORDER BY name
  `).all();

  console.log('📊 Tables:');
  tables.forEach((table: any) => {
    console.log(`  - ${table.name}`);
  });
} else {
  console.error('❌ Database health check failed');
  process.exit(1);
}

db.close();
console.log('\n✅ Migration completed');
