# Implementation Plan - Bounded Contexts

Implementation order based on dependencies - build the foundation first, then add layers.

---

## Phase 1: Foundation (Weeks 1-2)

### 1. trade/shared
**Duration**: 1 day

Types, events, and helpers needed by all other contexts.

**Files to create**:
```
src/trade/shared/
├── types/
│   ├── trade.types.ts
│   ├── trade-status.ts
│   └── index.ts
├── events/
│   ├── trade.events.ts
│   └── index.ts
├── constants/
│   └── valid-transitions.ts
└── helpers/
    ├── state-helpers.ts
    ├── rr-calculation.ts
    └── index.ts
```

**Why first**: All other contexts depend on these types.

---

### 2. trade/repository
**Duration**: 1-2 days

Persistence layer - stores trades in SQLite.

**Files to create**:
```
src/trade/repository/
├── domain/
│   ├── ports/
│   │   └── trade-repository.port.ts
│   └── events/
│       └── trade-created.event.ts
├── application/
│   ├── commands/
│   │   ├── save-trade.command.ts
│   │   ├── update-trade.command.ts
│   │   └── delete-trade.command.ts
│   └── queries/
│       ├── get-trade-by-id.query.ts
│       ├── get-all-trades.query.ts
│       └── get-active-trades.query.ts
└── infrastructure/
    └── adapters/
        └── sqlite-trade.adapter.ts
```

**Dependencies**: trade/shared (types)

---

### 3. trade/parsing
**Duration**: 2-3 days

Extract trade data from text messages.

**Files to create**:
```
src/trade/parsing/
├── domain/
│   ├── ports/
│   │   └── parser.port.ts
│   └── services/
│       └── trade-parser.service.ts
├── application/
│   └── commands/
│       └── parse-trade.command.ts
└── infrastructure/
    └── adapters/
        ├── regex-parser.adapter.ts
        └── nlp-enhancement.adapter.ts (optional)
```

**Dependencies**: trade/shared (types)

---

## Phase 2: Core Business Logic (Weeks 2-3)

### 4. trade/ingestion
**Duration**: 2-3 days

Receive messages from Telegram.

**Files to create**:
```
src/trade/ingestion/
├── domain/
│   ├── entities/
│   │   └── incoming-message.entity.ts
│   ├── value-objects/
│   │   └── message-source.vo.ts
│   ├── services/
│   │   └── message-filter.service.ts
│   └── events/
│       ├── trade-received.event.ts
│       └── invalid-message.event.ts
├── application/
│   ├── commands/
│   │   └── ingest-message.command.ts
│   └── event-handlers/
│       └── on-trade-received.handler.ts
└── infrastructure/
    └── adapters/
        └── telegram-ingestion.adapter.ts
```

**Dependencies**: 
- trade/parsing (ParserPort)
- trade/repository (to save parsed trades)

---

### 5. trade/state
**Duration**: 1-2 days

Handle state transitions only.

**Files to create**:
```
src/trade/state/
├── domain/
│   ├── services/
│   │   └── state-machine.service.ts
│   ├── ports/
│   │   └── state.port.ts
│   └── events/
│       └── state-changed.event.ts
├── application/
│   └── commands/
│       └── transition-state.command.ts
└── infrastructure/
    └── adapters/
```

**Dependencies**: 
- trade/shared (VALID_TRANSITIONS)
- trade/repository (to get trade)

**Important**: Do NOT include trigger detection - that goes to trade/engine

---

## Phase 3: Price Integration (Weeks 3-4)

### 6. price/exchange
**Duration**: 2-3 days

Exchange adapters (Binance first).

**Files to create**:
```
src/price/exchange/
├── domain/
│   ├── ports/
│   │   └── exchange.port.ts
│   └── value-objects/
│       └── exchange-config.vo.ts
├── application/
│   └── commands/
│       ├── connect-exchange.command.ts
│       └── switch-exchange.command.ts
└── infrastructure/
    └── adapters/
        ├── binance/
        │   └── binance-exchange.adapter.ts
        ├── bybit/
        └── kucoin/
```

**Dependencies**: trade/shared (Price type)

---

### 7. price/stream
**Duration**: 2 days

Stream prices using exchange adapter.

**Files to create**:
```
src/price/stream/
├── domain/
│   ├── services/
│   │   └── websocket.service.ts
│   ├── ports/
│   │   └── price-stream.port.ts
│   └── events/
│       └── price-updated.event.ts
├── application/
│   └── commands/
│       ├── subscribe-symbols.command.ts
│       └── unsubscribe-symbols.command.ts
└── infrastructure/
    └── adapters/
```

**Dependencies**: 
- price/exchange (ExchangePort)
- trade/shared (Price type)

---

### 8. price/cache
**Duration**: 1 day

In-memory price cache.

**Files to create**:
```
src/price/cache/
├── domain/
│   ├── ports/
│   │   └── price-cache.port.ts
│   └── events/
│       └── price-updated.event.ts
├── application/
│   ├── commands/
│   │   ├── set-price.command.ts
│   │   └── remove-price.command.ts
│   └── queries/
│       ├── get-price.query.ts
│       └── get-all-prices.query.ts
└── infrastructure/
    └── adapters/
        └── in-memory-price-cache.adapter.ts
```

**Dependencies**: 
- price/stream (price events)
- trade/shared (Price type)

---

## Phase 4: Trade Engine (Weeks 4-5)

### 9. trade/engine
**Duration**: 3-4 days

Monitor prices and detect triggers.

**Files to create**:
```
src/trade/engine/
├── domain/
│   ├── services/
│   │   └── trading-engine.service.ts
│   ├── ports/
│   │   └── price-subscription.port.ts
│   └── events/
│       ├── trigger-detected.event.ts
│       └── trade-monitoring-started.event.ts
├── application/
│   └── commands/
│       ├── start-monitoring.command.ts
│       └── stop-monitoring.command.ts
└── infrastructure/
    └── adapters/
```

**Dependencies**:
- trade/shared (types, events)
- trade/state (StatePort)
- trade/repository (to get trades)
- price/stream (PriceSubscriptionPort)
- telegram/notification (NotificationPort)

---

## Phase 5: Telegram Integration (Weeks 5-6)

### 10. telegram/command
**Duration**: 3-4 days

Handle user commands.

**Files to create**:
```
src/telegram/command/
├── domain/
│   ├── entities/
│   │   └── bot-command.entity.ts
│   ├── ports/
│   │   ├── command.port.ts
│   │   └── trade.port.ts
│   └── events/
│       └── command-executed.event.ts
├── application/
│   ├── commands/
│   │   ├── query/
│   │   │   ├── start.command.ts
│   │   │   ├── help.command.ts
│   │   │   ├── trades.command.ts
│   │   │   └── stats.command.ts
│   │   └── mutation/
│   │       ├── cancel.command.ts
│   │       ├── modify-entry.command.ts
│   │       ├── modify-sl.command.ts
│   │       ├── modify-tp.command.ts
│   │       └── close.command.ts
│   └── handlers/
│       └── inline-buttons.handler.ts
└── infrastructure/
    └── adapters/
        ├── telegram-bot.adapter.ts
        └── trade-formatter.adapter.ts
```

**Dependencies**: 
- trade/shared (types)
- trade/repository (queries)
- trade/state (transitions)

---

### 11. telegram/notification/single-trade
**Duration**: 2 days

Send individual alerts.

**Files to create**:
```
src/telegram/notification/single-trade/
├── domain/
│   ├── services/
│   │   └── notification-template.service.ts
│   ├── ports/
│   │   ├── notification.port.ts
│   │   └── telegram.port.ts
│   └── events/
│       └── trade-notification.event.ts
├── application/
│   └── commands/
│       ├── send-trade-notification.command.ts
│       └── send-modification-notification.command.ts
└── infrastructure/
    └── adapters/
        └── telegram-message.adapter.ts
```

**Dependencies**: 
- trade/shared (types)
- trade/state (events)

---

### 12. telegram/notification/trade-list
**Duration**: 2 days

Send updated trade list.

**Files to create**:
```
src/telegram/notification/trade-list/
├── domain/
│   ├── services/
│   │   └── trade-list-cache.service.ts
│   ├── ports/
│   │   ├── trade-list-cache.port.ts
│   │   └── telegram.port.ts
│   └── events/
│       └── trade-list-updated.event.ts
├── application/
│   └── commands/
│       ├── send-trade-list.command.ts
│       └── refresh-trade-list.command.ts
└── infrastructure/
    └── adapters/
        └── in-memory-trade-list-cache.adapter.ts
```

**Dependencies**: 
- trade/shared (types)
- trade/state (events)
- trade/repository (for initial load)

---

## Implementation Checklist

| Phase | Context | Week | Dependencies Met |
|------|---------|------|------------------|
| 1 | trade/shared | 1 | ✅ None |
| 1 | trade/repository | 1-2 | ✅ shared |
| 1 | trade/parsing | 2-3 | ✅ shared |
| 2 | trade/ingestion | 2-3 | ✅ parsing, repository |
| 2 | trade/state | 3 | ✅ shared, repository |
| 3 | price/exchange | 3-4 | ✅ shared |
| 3 | price/stream | 4 | ✅ exchange |
| 3 | price/cache | 4 | ✅ stream, shared |
| 4 | trade/engine | 4-5 | ✅ state, repository, stream, notification |
| 5 | telegram/command | 5-6 | ✅ shared, repository, state |
| 5 | telegram/notification/single | 6 | ✅ shared, state |
| 5 | telegram/notification/trade-list | 6 | ✅ shared, state, repository |

---

## Notes

- **MVP Focus**: First implement trade/shared, trade/repository, trade/parsing, trade/ingestion, trade/state, and price/stream - this gives you a working trade capture system
- **Engine comes later**: trade/engine depends on price/stream being ready
- **Telegram last**: Commands and notifications are the outermost layer
- **Parallel work**: Some contexts can be developed in parallel if teams available