import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { initDatabase, checkDatabaseHealth } from './db/database';
import { tradesRoutes } from './routes/trades';
import { accountsRoutes } from './routes/accounts';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3001');
const HOST = '0.0.0.0';

const fastify = Fastify({
  logger: {
    level: 'info',
  },
});

// Register plugins
await fastify.register(cors, {
  origin: true,
  credentials: true,
});

// Initialize database
initDatabase();

// Register routes
await fastify.register(tradesRoutes);
await fastify.register(accountsRoutes);

// Health check
fastify.get('/health', async () => {
  const dbHealthy = checkDatabaseHealth();
  return {
    status: dbHealthy ? 'ok' : 'degraded',
    database: dbHealthy ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  };
});

// API info
fastify.get('/api', async () => {
  return {
    message: 'Trading Journal API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      api: 'GET /api',
      trades: {
        getAll: 'GET /api/trades',
        getOne: 'GET /api/trades/:id',
        create: 'POST /api/trades',
        update: 'PUT /api/trades/:id',
        delete: 'DELETE /api/trades/:id',
        stats: 'GET /api/trades/stats',
        managementLog: 'GET /api/trades/:id/management-log',
      },
      accounts: {
        getAll: 'GET /api/accounts',
        getOne: 'GET /api/accounts/:id',
        create: 'POST /api/accounts',
        update: 'PUT /api/accounts/:id',
        delete: 'DELETE /api/accounts/:id',
        sync: 'POST /api/accounts/:id/sync',
        stats: 'GET /api/accounts/:id/stats',
      },
    }
  };
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`\n🚀 Backend running at http://localhost:${PORT}`);
    console.log(`📊 API docs at http://localhost:${PORT}/api`);
    console.log(`✅ Health check at http://localhost:${PORT}/health\n`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
