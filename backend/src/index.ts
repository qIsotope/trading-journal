import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { initDatabase, checkDatabaseHealth } from './db/database';
import { accountsRoutes } from './routes/accounts';
import { checkSupabaseHealth, isSupabaseConfigured } from './lib/supabase';
import { authRoutes } from './routes/auth';

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
await fastify.register(authRoutes);
await fastify.register(accountsRoutes);

// Health check
fastify.get('/health', async () => {
  const dbHealthy = checkDatabaseHealth();
  const supabase = await checkSupabaseHealth();

  const status = dbHealthy && (supabase.healthy || !supabase.configured) ? 'ok' : 'degraded';

  return {
    status,
    database: dbHealthy ? 'connected' : 'disconnected',
    supabase,
    timestamp: new Date().toISOString()
  };
});

fastify.get('/health/supabase', async (_request, reply) => {
  const supabase = await checkSupabaseHealth();

  if (!supabase.healthy) {
    return reply.status(503).send(supabase);
  }

  return supabase;
});

// API info
fastify.get('/api', async () => {
  return {
    message: 'Trading Journal API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      supabaseHealth: 'GET /health/supabase',
      api: 'GET /api',
      auth: {
        enabled: isSupabaseConfigured(),
        provider: 'supabase',
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        refresh: 'POST /api/auth/refresh',
        logout: 'POST /api/auth/logout',
        me: 'GET /api/auth/me',
      },
      accounts: {
        authRequired: true,
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
