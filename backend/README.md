# Trading Journal Backend

Backend API на Bun + Fastify + SQLite.

## Встановлення

```bash
bun install
```

## Налаштування

```bash
cp .env.example .env
# Відредагуйте .env
```

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
- `GET /api` - API info
