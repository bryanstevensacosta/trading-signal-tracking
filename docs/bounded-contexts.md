# Bounded Contexts Summary

Quick reference for understanding each sub-context's purpose and responsibilities.

---

## Trade Context

### trade/ingestion
**Purpose**: Receive trade messages from Telegram

**Responsibilities**:
- Receive direct messages from users
- Receive forwarded messages from channels/groups
- Filter non-trade messages
- Convert Telegram messages to internal format

**Outputs**: `IncomingMessage` → `TradeReceivedEvent`

---

### trade/parsing
**Purpose**: Extract trade data from text

**Responsibilities**:
- Parse text using regex
- Extract: symbol, side, entry, SL, TPs, chartUrl, notes
- Support multiple formats (full text, compact, with URLs)
- Validate numeric values

**Outputs**: `ParseResult` with `ParsedTradeData`

---

### trade/repository
**Purpose**: Persist trades

**Responsibilities**:
- Save trades to SQLite
- Query trades by ID, status
- Update trade data
- Delete trades

**Outputs**: `Trade` entity stored in DB

---

### trade/state
**Purpose**: Manage trade state transitions

**Responsibilities**:
- Validate state transitions (pending → active, etc.)
- Enforce business rules
- Execute valid transitions
- Emit `StateChangedEvent`

**Important**: Does NOT detect triggers - that is trade/engine's job

---

### trade/engine
**Purpose**: Monitor prices and detect triggers

**Responsibilities**:
- Subscribe to symbols of active trades
- Monitor prices in real-time
- Detect entry, TP, SL, breakeven hits
- Execute state transitions when triggers hit

**Key**: Monitors ALL trades (pending + active) - not just active

---

### trade/shared
**Purpose**: Common types and helpers

**Contains**:
- `Trade`, `TradeStatus`, `TradeSide`, `TriggerType`
- `Price`, `ParsedTradeData`, `ParseResult`
- Event definitions
- State helpers (`isActiveTrade`, `canModifyEntry`, etc.)
- RR calculation

---

## Telegram Context

### telegram/command
**Purpose**: Handle user commands

**Responsibilities**:
- Parse and execute commands (`/trades`, `/active`, `/cancel`, etc.)
- Validate command parameters
- Handle mutations (modify entry, SL, TP, close manually)

**Note**: Modifications (entry/SL/TP) handled here, NOT in trade/state

---

### telegram/notification/single-trade
**Purpose**: Send individual trade alerts

**Responsibilities**:
- Generate formatted notifications
- Send alerts on: new trade, entry hit, TP hit, SL hit, close
- Apply templates with emoji

**Triggers**: StateChangedEvent from trade/state

---

### telegram/notification/trade-list
**Purpose**: Send updated trade list

**Responsibilities**:
- Maintain in-memory cache of active/pending trades
- Update cache on trade events
- Send updated list when trades change

---

## Price Context

### price/stream
**Purpose**: Stream real-time prices

**Responsibilities**:
- Manage WebSocket connections
- Subscribe/unsubscribe to symbols
- Emit price updates
- Handle reconnection

**Uses**: ExchangePort from price/exchange (doesn't know which exchange)

---

### price/cache
**Purpose**: Cache current prices

**Responsibilities**:
- Store prices in memory
- Provide price by symbol
- Subscribe to stream updates

---

### price/exchange
**Purpose**: Exchange adapters (Binance, Bybit, KuCoin)

**Responsibilities**:
- Define generic `ExchangePort` interface
- Implement adapters per exchange
- Handle exchange-specific WebSocket protocols

**Used by**: price/stream

---

## Data Flow Summary

```
User Message
    ↓
telegram/command → Parse command
    ↓
trade/ingestion → Receive message
    ↓
trade/parsing → Extract data
    ↓
trade/repository → Save to DB (pending)
    ↓
trade/engine → Subscribe to symbol
    ↓
price/stream → WebSocket price
    ↓
price/cache → Cache price
    ↓
trade/engine → Detect trigger
    ↓
trade/state → Transition state
    ↓
telegram/notification → Send alerts
```

---

## Quick Commands Reference

| Context | Command | Type |
|---------|----------|------|
| trade/state | transitionState | Mutation |
| trade/repository | save, findById | Command/Query |
| trade/engine | startMonitoring | Command |
| telegram/command | /trades, /cancel, /entry | Both |
| price/stream | subscribe | Command |
| price/cache | getPrice | Query |