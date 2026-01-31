# Trading Journal

Повнофункціональний додаток для трейдерів для відстеження угод з інтеграцією MT5 та Notion.

## 🏗️ Архітектура

```
trading-journal/
├── frontend/          # React + Vite + Tailwind CSS
├── backend/           # Bun + Fastify + SQLite
└── python-mt5/        # Python скрипт для MT5
```

## 🚀 Технології

### Frontend
- ⚡ **Bun** - швидкий runtime
- ⚙️ **Vite** - bundler
- ⚛️ **React 18** - UI фреймворк
- 📘 **TypeScript** - типізація
- 🎨 **Tailwind CSS** - стилізація
- 🧩 **Shadcn/ui** - UI компоненти
- 🔀 **Tanstack Router** - маршрутизація
- 🔄 **Tanstack Query** - data fetching
- 📊 **Tanstack Table** - таблиці з фільтрами
- 📅 **date-fns** - робота з датами

### Backend
- ⚡ **Bun** - runtime
- 🚀 **Fastify** - web framework
- 🗄️ **SQLite** - база даних
- 🔐 **JWT** - автентифікація
- ✅ **Zod** - валідація

### Python MT5 Connector
- 🐍 **Python 3**
- 📈 **MetaTrader5** - API для MT5
- 📝 **Notion API** - інтеграція з Notion

## 📦 Встановлення

### Вимоги
- Bun ([встановити](https://bun.sh))
- Python 3.8+ (для MT5 скрипта)

### 1. Backend

```bash
cd backend
bun install
cp .env.example .env
# Відредагуйте .env
bun run db:migrate
bun run dev
```

Backend запуститься на `http://localhost:3001`

### 2. Frontend

```bash
cd frontend
bun install
cp .env.example .env
bun run dev
```

Frontend запуститься на `http://localhost:3000`

### 3. Python MT5 (Windows тільки)

```bash
cd python-mt5
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Відредагуйте .env з вашими MT5 даними
python mt5_connector.py
```

## 🔧 Конфігурація

### Backend (.env)
```env
PORT=3001
JWT_SECRET=your_secret
NOTION_API_KEY=your_notion_key
NOTION_DATABASE_ID=your_database_id
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:3001
```

### Python MT5 (.env)
```env
MT5_LOGIN=your_account
MT5_PASSWORD=your_password
MT5_SERVER=your_broker_server
```

## 📊 База даних

SQLite бази даних:
- `backend/trading-journal.db` - головна БД

### Таблиці:
- `accounts` - MT5 акаунти
- `trades` - історія угод
- `open_positions` - відкриті позиції

## 🌊 Workflow

1. **Трейдер заходить в угоду** на MT5
2. **Python скрипт** отримує угоду через MT5 API
3. **Backend** отримує дані і зберігає в SQLite
4. **Notion API** отримує дані для синхронізації
5. **Frontend** відображає всі угоди з фільтрами

## 📝 TODO

- [ ] Додати Shadcn/ui компоненти
- [ ] Створити API endpoints для угод
- [ ] Додати Notion інтеграцію
- [ ] Створити форми для додавання акаунтів
- [ ] Додати фільтри і сортування в таблиці
- [ ] Налаштувати GitHub Actions для Python скрипта
- [ ] Додати графіки прибутку

## 📄 Ліцензія

MIT

---

Створено для особистого використання трейдером 🚀
