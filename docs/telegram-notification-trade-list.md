# Telegram Notification - Trade List

Responsibility: Maintain and send an updated list of active/pending trades to Telegram channel/group on every change.

> Uses types from `trade-shared.md`

## Directory Structure

```
src/telegram/notification/trade-list/
├── domain/
│   ├── services/
│   │   └── TradeListCacheService
│   ├── ports/
│   └── events/
├── application/
│   └── commands/
└── infrastructure/
    └── adapters/
```

## Domain

### Services

**TradeListCacheService**
- Maintains in-memory cache of active and pending trades
- Subscribes to trade events from trade/state
- Generates formatted trade list message

#### Cache Structure
```typescript
cache: Map<string, Trade>
```

#### Methods
- `addTrade(trade: Trade): void` - Add new trade to cache
- `updateTrade(trade: Trade): void` - Update existing trade
- `removeTrade(tradeId: string): void` - Remove closed trade
- `getTrades(): Trade[]` - Get all cached trades
- `getActiveTrades(): Trade[]` - Filter only active/pending

#### Event Handlers
- `onTradeCreated(trade: Trade)` → `addTrade()`
- `onStateChanged(trade: Trade, oldStatus: TradeStatus)` → update or remove
- `onTradeClosed(trade: Trade)` → `removeTrade()`

### Ports

**TradeListCachePort** (inbound)
- `addTrade(trade: Trade): void`
- `updateTrade(trade: Trade): void`
- `removeTrade(tradeId: string): void`
- `getTrades(): Trade[]`

**TelegramPort** (outbound)
- `sendMessage(chatId: number, text: string): void`

**TradeEventPort** (outbound)
- `subscribeToTradeCreated(callback: (trade: Trade) => void): void`
- `subscribeToStateChanged(callback: (trade: Trade, oldStatus: TradeStatus) => void): void`

### Events

**TradeListUpdatedEvent**
- Emitted after cache is updated
- Payload: `trades: Trade[]`, `reason: string`

## Application

### Commands

**SendTradeListCommand**
- Input: none (uses cached trades)
- Output: `void`
- Gets trades from cache, formats message, sends to channel

**RefreshTradeListCommand**
- Input: none
- Forces refresh from repository and rebuilds cache

## Infrastructure

### Adapters

**InMemoryTradeListCache**
- Simple Map<string, Trade> implementation
- No persistence (rebuilds on restart)

**TelegramMessageAdapter**
- Uses Telegram Bot API sendMessage
- Sends to configured channel/group

## Trade List Format

```
📊 ACTIVE TRADES (3)

1. BTCUSDT LONG
   Entry: 20000 | SL: 18299
   TP1: 25000 ✅ | TP2: 27000
   Status: Active

2. ETHUSDT SHORT
   Entry: 3200 | SL: 3350
   TP: 3000
   Status: Pending

3. BNBUSDT SPOT
   Entry: 680
   Status: Pending
```

### Format Variations

**With RR**
```
📊 ACTIVE TRADES (2)

1. BTCUSDT LONG
   Entry: 20000 | SL: 18299
   TP1: 25000 ✅ | TP2: 27000
   📈 +2.5R | Status: Partial TP
```

**Empty List**
```
📊 ACTIVE TRADES (0)

No active trades
```

## Configuration

| Option | Type | Description |
|--------|------|-------------|
| `channelId` | number | Target channel/group ID |
| `enabled` | boolean | Enable/disable trade list |
| `includePending` | boolean | Include pending trades in list |
| `includeRR` | boolean | Show risk/reward in list |
| `format` | string | Message format template |

## Event Flow

```
trade/state: StateChangedEvent
    ↓
TradeListCacheService.onStateChanged()
    ↓
update/remove from cache
    ↓
TradeListUpdatedEvent
    ↓
SendTradeListCommand.execute()
    ↓
format trade list
    ↓
TelegramMessageAdapter.sendMessage()
    ↓
new message sent to channel
```

## Trigger Events

| Event | Action | Cache Update |
|-------|--------|--------------|
| Trade created (pending) | `addTrade()` | Insert |
| Entry hit | `updateTrade()` | Update status |
| TP hit | `updateTrade()` | Update TP marker |
| Breakeven | `updateTrade()` | Update status |
| Trade closed | `removeTrade()` | Delete |
| Trade cancelled | `removeTrade()` | Delete |

## Notes

- New message sent on every change (no editing)
- Trades sorted by symbol alphabetically
- Empty list shows "No active trades"
- Cache rebuilds from repository on bot restart
- Consider rate limiting to avoid spam