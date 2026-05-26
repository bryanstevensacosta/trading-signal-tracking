# Architecture - Bounded Contexts

## Trade Context

**Responsibility**: Parse, store, and manage trade lifecycle

### Sub Contexts
- `trade/shared` - Common types, events, helpers
- `trade/ingestion` - Receive trade messages from Telegram
- `trade/parsing` - Extract trade data from text
- `trade/repository` - Persist trades to SQLite
- `trade/state` - State machine and transitions (only transitions)
- `trade/engine` - Monitor prices and execute triggers (includes trigger detection)

### Directory Structure
```
src/trade/
├── shared/
│   ├── types/
│   ├── events/
│   ├── constants/
│   └── helpers/
├── ingestion/
├── parsing/
├── repository/
├── state/
└── engine/
```

See: `trade-shared.md`, `trade-ingestion.md`, `trade-parsing.md`, `trade-repository.md`, `trade-state.md`, `trade-engine.md`

---

## Telegram Context

**Responsibility**: Handle commands and user interactions

### Sub Contexts
- `telegram/command` - Command handlers
- `telegram/notification/single-trade` - Individual trade alerts
- `telegram/notification/trade-list` - Trade list with cache

### Directory Structure
```
src/telegram/
├── command/
└── notification/
    ├── single-trade/
    └── trade-list/
```

See: `telegram-command.md`, `telegram-notification-single-trade.md`, `telegram-notification-trade-list.md`

---

## Price Context

**Responsibility**: Track real-time prices

### Sub Contexts
- `price/stream` - WebSocket connections (generic)
- `price/cache` - In-memory price cache
- `price/exchange` - Exchange adapters (Binance, Bybit, KuCoin...)

### Directory Structure
```
src/price/
├── stream/
├── cache/
└── exchange/
    ├── binance/
    ├── bybit/
    └── kucoin/
```

See: `price-stream.md`, `price-cache.md`, `price-exchange.md`, `exchange-binance.md`

---

## Database

**Responsibility**: Persist trades

- SQLite
- Schema: see `trade-repository.md`

---

## Event Flow

```
Telegram Message
    ↓
trade/ingestion (receive)
    ↓
trade/parsing (extract data)
    ↓
trade/repository (save as pending)
    ↓
trade/state (transition to active when entry hit)
    ↓
trade/engine (monitor price triggers)
    ↓
price/stream (WebSocket)
    ↓
price/cache (cache price)
    ↓
trade/state (execute state transitions)
    ↓
telegram/notification (send alerts)
```

---

## External Integrations

| Service | Context | Protocol |
|---------|---------|----------|
| Telegram Bot API | telegram/command, telegram/notification | HTTP |
| Binance WebSocket | price/stream | WebSocket |
| SQLite | trade/repository | SQL |
| Redis Pub/Sub | Inter-context events | Redis |

## Tech Stack

See: `tech-stack.md`, `tech-stack-nestjs.md`, `nestjs-modules.md`, `nestjs-cqrs.md`, `nestjs-components.md`, `nestjs-lifecycle.md`, `nestjs-testing.md`, `nestjs-websocket.md`