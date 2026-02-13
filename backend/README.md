# Trading Journal Backend

Backend API на Bun + Fastify + SQLite (+ Supabase integration).

## Встановлення

```bash
bun install
```

## Налаштування

```bash
cp .env.example .env
# Відредагуйте .env
```

Для Supabase вкажіть у `.env`:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Міграція БД

```bash
bun run db:migrate
```

## Запуск

```bash
# Development
bun run dev

# Production
bun run start
```

Сервер: `http://localhost:3001`

## Endpoints

- `GET /health` - health check
- `GET /health/supabase` - supabase health check
- `GET /api` - API info
- `POST /api/auth/register` - register by email/password
- `POST /api/auth/login` - login by email/password
- `POST /api/auth/refresh` - refresh session tokens
- `POST /api/auth/logout` - global sign out
- `GET /api/auth/me` - get current user by Bearer token
- `GET /api/accounts` - list user accounts (Bearer required)
- `GET /api/accounts/:id` - get one user account (Bearer required)
- `POST /api/accounts` - create user account (Bearer required)
- `PUT /api/accounts/:id` - update user account (Bearer required)
- `DELETE /api/accounts/:id` - deactivate user account (Bearer required)
- `POST /api/accounts/:id/sync` - sync account from MT5 (Bearer required)
- `GET /api/accounts/:id/stats` - account stats (Bearer required)
