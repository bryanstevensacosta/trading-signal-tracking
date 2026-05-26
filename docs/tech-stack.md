# Tech Stack

## Core

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | LTS | Runtime |
| TypeScript | ^5.0 | Language |
| NestJS | ^10 | Framework |
| NestJS CQRS | ^10 | Commands, Queries, Events |

## Database

| Technology | Purpose |
|------------|---------|
| SQLite | Primary database (MVP) |
| better-sqlite3 | SQLite driver |

## Messaging & Events

| Technology | Purpose |
|------------|---------|
| Redis Pub/Sub | Inter-context communication |
| EventEmitter | In-process events |

## Real-time

| Technology | Purpose |
|------------|---------|
| ws | WebSocket client |
| Exchange Adapters | Binance, Bybit, KuCoin (extensible) |

## Telegram

| Technology | Purpose |
|------------|---------|
| node-telegram-bot-api | Telegram Bot API |

## Utilities

| Technology | Purpose |
|------------|---------|
| zod | Validation |
| uuid | ID generation |
| date-fns | Date handling |

## Project Structure

```
src/
├── main.ts
├── app.module.ts
├── trade/
│   ├── ingestion/
│   ├── parsing/
│   ├── repository/
│   └── state/
├── telegram/
│   ├── command/
│   └── notification/
│       ├── single-trade/
│       └── trade-list/
├── price/
│   ├── stream/
│   └── cache/
└── common/
    ├── events/
    └── adapters/
```

## Environment Variables

```
# Database
DATABASE_URL=

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHANNEL_ID=

# Redis
REDIS_HOST=
REDIS_PORT=

# Binance
BINANCE_WS_URL=
BINANCE_REST_URL=
```