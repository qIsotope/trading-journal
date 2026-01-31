import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import dotenv from 'dotenv';
import { initDatabase, checkDatabaseHealth } from './db/database';

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

await fastify.register(cookie, {
  secret: process.env.COOKIE_SECRET,
});

await fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'supersecret',
  cookie: {
    cookieName: 'token',
    signed: true,
  },
});

// Initialize database
initDatabase();

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
        create: 'POST /api/trades',
      },
      accounts: {
        getAll: 'GET /api/accounts',
        create: 'POST /api/accounts',
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
