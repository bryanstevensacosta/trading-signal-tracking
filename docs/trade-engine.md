# Trade Engine

Responsibility: Monitor real-time prices and detect/execute triggers (entry, TP, SL, breakeven) for all trades (pending and active).

> Uses types from `trade-shared.md`

## Directory Structure

```
src/trade/engine/
├── domain/
│   ├── services/
│   │   └── TradingEngineService
│   ├── ports/
│   │   └── PriceSubscriptionPort
│   └── events/
│       └── TriggerDetectedEvent
├── application/
│   └── commands/
│       └── StartMonitoringCommand
│       └── StopMonitoringCommand
└── infrastructure/
    └── adapters/
```

## Domain

### Services

**TradingEngineService**
- Subscribes to symbols of **all trades** (pending + active)
- Monitors prices in real-time
- Detects when price hits entry, TP, SL, or breakeven
- Executes state transitions via trade/state

#### Key Methods
- `startMonitoring(trade: Trade): void` - Subscribe to trade's symbol
- `stopMonitoring(tradeId: string): void` - Unsubscribe when trade closed
- `onPriceUpdate(symbol: string, price: Price): void` - Handle price tick
- `checkTriggers(trade: Trade, currentPrice: number): TriggerResult` - Detect triggers
- `executeTrigger(trade: Trade, result: TriggerResult): Promise<void>` - Execute state change

#### Monitored Symbols
- Tracks which symbols are being monitored
- Auto-subscribes when new trade is created (pending)
- Stays subscribed until trade is closed/cancelled

### Ports

**PriceSubscriptionPort** (outbound)
```typescript
interface PriceSubscriptionPort {
  subscribe(symbols: string[]): void;
  unsubscribe(symbols: string[]): void;
  onPriceUpdate(callback: (price: Price) => void): void;
}
```

**StatePort** (outbound)
```typescript
interface StatePort {
  transitionState(tradeId: string, newStatus: TradeStatus, reason: string): Promise<Trade>;
  getTrade(tradeId: string): Promise<Trade>;
}
```

**NotificationPort** (outbound)
```typescript
interface NotificationPort {
  sendTriggerNotification(trade: Trade, trigger: TriggerType, price: number): void;
}
```

### Events

**TriggerDetectedEvent**
- Emitted when trigger is detected
- Payload: `trade`, `trigger`, `price`, `rr`

**TradeMonitoringStartedEvent**
- Emitted when monitoring starts
- Payload: `tradeId`, `symbol`

**TradeMonitoringStoppedEvent**
- Emitted when monitoring stops
- Payload: `tradeId`, `symbol`

## Application

### Commands

**StartMonitoringCommand**
- Input: `trade: Trade`
- Subscribes to trade's symbol
- Starts monitoring for triggers (entry for pending, TP/SL for active)

**StopMonitoringCommand**
- Input: `tradeId: string`
- Unsubscribes from symbol
- Stops monitoring

## Trigger Detection Logic

### LONG/SPOT
```typescript
// Entry hit (for pending trades)
const entryHit = trade.status === TradeStatus.PENDING &&
  (trade.entryMax
    ? currentPrice >= trade.entry && currentPrice <= trade.entryMax
    : currentPrice === trade.entry);

// TP hit
const tpHit = (tradeId: string, tpIndex: number) => {
  const tp = trade.tps[tpIndex];
  return tp && currentPrice >= tp;
};

// SL hit
const slHit = trade.sl && currentPrice <= trade.sl;
```

### SHORT
```typescript
// Entry hit
const entryHit = trade.status === TradeStatus.PENDING &&
  (trade.entryMax
    ? currentPrice >= trade.entry && currentPrice <= trade.entryMax
    : currentPrice === trade.entry);

// TP hit
const tpHit = (tpIndex: number) => {
  const tp = trade.tps[tpIndex];
  return tp && currentPrice <= tp;
};

// SL hit
const slHit = trade.sl && currentPrice >= trade.sl;
```

### Breakeven
```typescript
const breakevenHit = trade.status === TradeStatus.BREAKEVEN && currentPrice === trade.entry;
```

## Execution Flow

```
1. Trade created (pending)
   ↓
2. trade/repository saves trade
   ↓
3. trade/engine receives TradeCreatedEvent
   ↓
4. Engine subscribes to symbol in price/stream
   ↓
5. price/stream emits price ticks
   ↓
6. Engine checks triggers:
   - If pending: check entry hit → transition to active
   - If active: check TP/SL
   - If breakeven: check breakeven
   ↓
7. Engine calls trade/state.transitionState()
   ↓
8. StateChangedEvent emitted
   ↓
9. telegram/notification sends alerts
```

## Trigger Priority

1. **TP first** - Mark TP as hit, check if all TPs hit
2. **SL** - If no TP hit, check SL
3. **Entry** - If status is pending
4. **Breakeven** - Only if status is breakeven

## Monitoring All Trades

```typescript
// Engine monitors ALL trades, not just active
const MONITORED_STATUSES = [
  TradeStatus.PENDING,   // for entry hit
  TradeStatus.ACTIVE,    // for TP/SL
  TradeStatus.PARTIAL_TP, // for more TP
  TradeStatus.BREAKEVEN,  // for breakeven hit
];
```

## Price Source

- Use bid for LONG TP/SL checks
- Use ask for SHORT TP/SL checks  
- Use last for entry checks
- Timestamp from Binance event

## Notes

- One engine service for all trades
- Efficient: O(n) where n = unique symbols (not trades)
- Auto-cleanup on trade close
- Handles symbol normalization
- Monitors pending trades for entry hit
- Uses types from `trade-shared.md`