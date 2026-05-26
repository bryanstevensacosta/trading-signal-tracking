# Trade Shared

Common types, enums, and events shared across trade sub-contexts.

## Types

### TradeStatus

```typescript
enum TradeStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  PARTIAL_TP = 'partial_tp',
  BREAKEVEN = 'breakeven',
  CLOSED_WIN = 'closed_win',
  CLOSED_PARTIAL = 'closed_partial',
  CLOSED_LOSS = 'closed_loss',
  CLOSED_BREAKEVEN = 'closed_breakeven',
  CLOSED_MANUAL = 'closed_manual',
  CANCELLED = 'cancelled',
}
```

### TradeSide

```typescript
enum TradeSide {
  LONG = 'LONG',
  SHORT = 'SHORT',
  SPOT = 'SPOT',
}
```

### TriggerType

```typescript
enum TriggerType {
  ENTRY = 'entry',
  TP = 'tp',
  SL = 'sl',
  BREAKEVEN = 'breakeven',
}
```

### CloseReason

```typescript
enum CloseReason {
  ALL_TP_HIT = 'all_tp_hit',
  TP_THEN_SL = 'tp_then_sl',
  SL_NO_TP = 'sl_no_tp',
  BREAKEVEN = 'breakeven',
  MANUAL = 'manual',
  CANCELLED = 'cancelled',
}
```

### Trade (Entity)

```typescript
interface Trade {
  id: string;
  symbol: string;
  side: TradeSide;
  entry: number;
  entryMax: number | null;
  sl: number | null;
  tps: number[] | null;
  chartUrl: string | null;
  notes: string | null;
  status: TradeStatus;
  sourceMessage: string;
  sourceChat: number | null;
  tpsHit: number[];
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
}
```

### ParsedTradeData

```typescript
interface ParsedTradeData {
  symbol: string;
  side: TradeSide;
  entry: number;
  entryMax: number | null;
  sl: number | null;
  tps: number[] | null;
  chartUrl: string | null;
  notes: string | null;
}
```

### ParseResult

```typescript
interface ParseResult {
  success: boolean;
  data: ParsedTradeData | null;
  errors: string[];
}
```

### TriggerResult

```typescript
interface TriggerResult {
  triggered: boolean;
  trigger: TriggerType | null;
  price: number;
  tpIndex?: number;
  rr?: number;
}
```

### Price

```typescript
interface Price {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  timestamp: Date;
  exchange?: string;
}
```

---

## Events

### TradeCreatedEvent

```typescript
interface TradeCreatedEvent {
  trade: Trade;
}
```

### TradeUpdatedEvent

```typescript
interface TradeUpdatedEvent {
  trade: Trade;
  field: string;
  oldValue: any;
  newValue: any;
}
```

### StateChangedEvent

```typescript
interface StateChangedEvent {
  trade: Trade;
  oldStatus: TradeStatus;
  newStatus: TradeStatus;
  reason: string;
}
```

### TriggerDetectedEvent

```typescript
interface TriggerDetectedEvent {
  trade: Trade;
  trigger: TriggerType;
  price: number;
  rr?: number;
}
```

---

## Valid Transitions

```typescript
const VALID_TRANSITIONS: Record<TradeStatus, TradeStatus[]> = {
  [TradeStatus.PENDING]: [
    TradeStatus.ACTIVE,
    TradeStatus.CANCELLED,
  ],
  [TradeStatus.ACTIVE]: [
    TradeStatus.PARTIAL_TP,
    TradeStatus.BREAKEVEN,
    TradeStatus.CLOSED_WIN,
    TradeStatus.CLOSED_LOSS,
    TradeStatus.CLOSED_MANUAL,
  ],
  [TradeStatus.PARTIAL_TP]: [
    TradeStatus.PARTIAL_TP,
    TradeStatus.BREAKEVEN,
    TradeStatus.CLOSED_PARTIAL,
    TradeStatus.CLOSED_LOSS,
    TradeStatus.CLOSED_MANUAL,
  ],
  [TradeStatus.BREAKEVEN]: [
    TradeStatus.CLOSED_BREAKEVEN,
    TradeStatus.CLOSED_MANUAL,
  ],
  [TradeStatus.CLOSED_WIN]: [],
  [TradeStatus.CLOSED_PARTIAL]: [],
  [TradeStatus.CLOSED_LOSS]: [],
  [TradeStatus.CLOSED_BREAKEVEN]: [],
  [TradeStatus.CLOSED_MANUAL]: [],
  [TradeStatus.CANCELLED]: [],
};
```

---

## State Helpers

```typescript
function isActiveTrade(status: TradeStatus): boolean {
  return [
    TradeStatus.PENDING,
    TradeStatus.ACTIVE,
    TradeStatus.PARTIAL_TP,
    TradeStatus.BREAKEVEN,
  ].includes(status);
}

function isClosedTrade(status: TradeStatus): boolean {
  return status.startsWith('closed_');
}

function canModifyEntry(status: TradeStatus): boolean {
  return status === TradeStatus.PENDING;
}

function canModifySL(status: TradeStatus): boolean {
  return isActiveTrade(status);
}

function canModifyTP(status: TradeStatus): boolean {
  return isActiveTrade(status);
}

function canManualClose(status: TradeStatus): boolean {
  return isActiveTrade(status);
}

function canCancel(status: TradeStatus): boolean {
  return status === TradeStatus.PENDING;
}
```

---

## RR Calculation

```typescript
function calculateRR(entry: number, sl: number, tp: number, side: TradeSide): number {
  const r = Math.abs(entry - sl);
  if (r === 0) return 0;

  const rr = Math.abs(tp - entry) / r;

  if (side === TradeSide.SHORT) {
    return -rr; // Negative for short
  }

  return rr;
}
```

---

## Directory Structure

```
src/trade/shared/
├── types/
│   ├── trade.types.ts
│   ├── trade-status.ts
│   ├── trigger.ts
│   └── index.ts
├── events/
│   ├── trade.events.ts
│   └── index.ts
├── constants/
│   └── valid-transitions.ts
└── helpers/
    ├── state-helpers.ts
    └── rr-calculation.ts
```