# trade/shared Implementation Guide

Implementation details for `src/trade/shared/` - types, events, constants, and helpers.

---

## Directory Structure

```
src/trade/shared/
├── types/
│   ├── trade.types.ts       # Trade entity interface
│   ├── trade-status.ts       # TradeStatus enum
│   ├── trigger.ts           # TriggerType, CloseReason
│   ├── price.ts             # Price interface
│   ├── index.ts            # Barrel export
│   └── all.ts              # Re-export everything
├── events/
│   ├── trade.events.ts      # Trade-related events
│   ├── index.ts            # Barrel export
│   └── all.ts              # Re-export everything
├── constants/
│   ├── valid-transitions.ts # State transition map
│   └── index.ts            # Barrel export
├── helpers/
│   ├── state-helpers.ts    # isActiveTrade, canModify, etc.
│   ├── rr-calculation.ts   # Risk/Reward calculation
│   ├── index.ts           # Barrel export
│   └── all.ts             # Re-export everything
└── index.ts               # Main barrel export
```

---

## types/trade-status.ts

```typescript
export enum TradeStatus {
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

export type ClosedTradeStatus = 
  | TradeStatus.CLOSED_WIN 
  | TradeStatus.CLOSED_PARTIAL 
  | TradeStatus.CLOSED_LOSS 
  | TradeStatus.CLOSED_BREAKEVEN 
  | TradeStatus.CLOSED_MANUAL;

export type ActiveTradeStatus = 
  | TradeStatus.PENDING 
  | TradeStatus.ACTIVE 
  | TradeStatus.PARTIAL_TP 
  | TradeStatus.BREAKEVEN;
```

---

## types/trade.types.ts

```typescript
import { TradeStatus, TradeSide } from './trade-status';
import { TriggerType } from './trigger';

export interface Trade {
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

export interface CreateTradeInput {
  symbol: string;
  side: TradeSide;
  entry: number;
  entryMax?: number;
  sl?: number;
  tps?: number[];
  chartUrl?: string;
  notes?: string;
  sourceMessage?: string;
  sourceChat?: number;
}

export interface UpdateTradeInput {
  entry?: number;
  entryMax?: number;
  sl?: number;
  tps?: number[];
  chartUrl?: string;
  notes?: string;
  status?: TradeStatus;
  tpsHit?: number[];
  closedAt?: Date;
}
```

---

## types/trigger.ts

```typescript
export enum TradeSide {
  LONG = 'LONG',
  SHORT = 'SHORT',
  SPOT = 'SPOT',
}

export enum TriggerType {
  ENTRY = 'entry',
  TP = 'tp',
  SL = 'sl',
  BREAKEVEN = 'breakeven',
}

export enum CloseReason {
  ALL_TP_HIT = 'all_tp_hit',
  TP_THEN_SL = 'tp_then_sl',
  SL_NO_TP = 'sl_no_tp',
  BREAKEVEN = 'breakeven',
  MANUAL = 'manual',
  CANCELLED = 'cancelled',
}
```

---

## types/price.ts

```typescript
export interface Price {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  timestamp: Date;
  exchange?: string;
}

export interface PriceWithExchange extends Price {
  exchange: string;
}
```

---

## types/index.ts (Barrel)

```typescript
export * from './trade-status';
export * from './trade.types';
export * from './trigger';
export * from './price';
export * from './parsed-trade';
export * from './parse-result';
export * from './trigger-result';
```

---

## events/trade.events.ts

```typescript
import { Trade, TradeStatus, TriggerType } from '../types';

export interface TradeCreatedEvent {
  trade: Trade;
}

export interface TradeUpdatedEvent {
  trade: Trade;
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface StateChangedEvent {
  trade: Trade;
  oldStatus: TradeStatus;
  newStatus: TradeStatus;
  reason: string;
}

export interface TriggerDetectedEvent {
  trade: Trade;
  trigger: TriggerType;
  price: number;
  rr?: number;
  tpIndex?: number;
}

export interface TradeClosedEvent {
  trade: Trade;
  reason: string;
  pnl?: number;
}
```

---

## events/index.ts

```typescript
export * from './trade.events';
```

---

## constants/valid-transitions.ts

```typescript
import { TradeStatus } from '../types';

export const VALID_TRANSITIONS: Record<TradeStatus, TradeStatus[]> = {
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

export function isValidTransition(
  from: TradeStatus,
  to: TradeStatus
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
```

---

## constants/index.ts

```typescript
export * from './valid-transitions';
```

---

## helpers/state-helpers.ts

```typescript
import { TradeStatus } from '../types';

export function isActiveTrade(status: TradeStatus): boolean {
  return [
    TradeStatus.PENDING,
    TradeStatus.ACTIVE,
    TradeStatus.PARTIAL_TP,
    TradeStatus.BREAKEVEN,
  ].includes(status);
}

export function isClosedTrade(status: TradeStatus): boolean {
  return status.startsWith('closed_');
}

export function isPendingTrade(status: TradeStatus): boolean {
  return status === TradeStatus.PENDING;
}

export function canModifyEntry(status: TradeStatus): boolean {
  return status === TradeStatus.PENDING;
}

export function canModifySL(status: TradeStatus): boolean {
  return isActiveTrade(status);
}

export function canModifyTP(status: TradeStatus): boolean {
  return isActiveTrade(status);
}

export function canManualClose(status: TradeStatus): boolean {
  return isActiveTrade(status);
}

export function canCancel(status: TradeStatus): boolean {
  return status === TradeStatus.PENDING;
}

export function canMoveToBreakeven(status: TradeStatus): boolean {
  return status === TradeStatus.ACTIVE || status === TradeStatus.PARTIAL_TP;
}
```

---

## helpers/rr-calculation.ts

```typescript
import { TradeSide } from '../types';

export function calculateR(entry: number, sl: number): number {
  return Math.abs(entry - sl);
}

export function calculateRR(
  entry: number,
  sl: number,
  tp: number,
  side: TradeSide
): number {
  const r = calculateR(entry, sl);
  if (r === 0) return 0;

  const rr = Math.abs(tp - entry) / r;

  if (side === TradeSide.SHORT) {
    return -rr;
  }

  return rr;
}

export function calculateMultipleRR(
  entry: number,
  sl: number,
  tps: number[],
  side: TradeSide
): number[] {
  return tps.map((tp) => calculateRR(entry, sl, tp, side));
}

export function calculatePnL(
  entry: number,
  closePrice: number,
  side: TradeSide
): number {
  if (side === TradeSide.LONG || side === TradeSide.SPOT) {
    return closePrice - entry;
  }
  return entry - closePrice;
}

export function calculatePnLPercent(
  entry: number,
  closePrice: number,
  side: TradeSide
): number {
  const pnl = calculatePnL(entry, closePrice, side);
  return (pnl / entry) * 100;
}
```

---

## helpers/index.ts

```typescript
export * from './state-helpers';
export * from './rr-calculation';
```

---

## main index.ts

```typescript
// Types
export * from './types/trade-status';
export * from './types/trade.types';
export * from './types/trigger';
export * from './types/price';

// Events
export * from './events/trade.events';

// Constants
export * from './constants/valid-transitions';

// Helpers
export * from './helpers/state-helpers';
export * from './helpers/rr-calculation';
```

---

## Usage Example

```typescript
import {
  Trade,
  TradeStatus,
  TradeSide,
  isActiveTrade,
  calculateRR,
  VALID_TRANSITIONS,
  StateChangedEvent,
} from './shared/types';

// Check if trade is active
const trade: Trade = { /* ... */ };
if (isActiveTrade(trade.status)) {
  // Monitor this trade
}

// Calculate risk/reward
const rr = calculateRR(
  trade.entry,
  trade.sl!,
  trade.tps![0],
  trade.side
);

// Validate state transition
if (VALID_TRANSITIONS[TradeStatus.PENDING].includes(TradeStatus.ACTIVE)) {
  // Transition is valid
}
```

---

## Dependencies

No external dependencies - pure TypeScript.

Optional future additions:
- `zod` for runtime validation
- `class-transformer` for DTOs