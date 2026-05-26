# Trade State

Responsibility: Manage trade state transitions and enforce valid transition rules.

> Uses types from `trade-shared.md`

## Directory Structure

```
src/trade/state/
├── domain/
│   ├── services/
│   │   └── StateMachineService
│   ├── ports/
│   │   └── StatePort
│   └── events/
│       └── StateChangedEvent
├── application/
│   ├── commands/
│   │   └── TransitionStateCommand
│   └── queries/
│       └── GetTradeStatusQuery
└── infrastructure/
    └── adapters/
```

## Domain

### Services

**StateMachineService**
- Validates state transitions
- Enforces business rules:
  - Entry can only be modified in `pending` status
  - TP can only be modified if not yet hit
  - SL can be modified anytime before closed
  - Manual close allowed in any active status
- Executes valid transitions

#### Methods
- `transitionState(trade: Trade, newStatus: TradeStatus, reason: string): Trade`
- `validateTransition(currentStatus: TradeStatus, newStatus: TradeStatus): boolean`

### Ports

**StatePort** (inbound)
```typescript
interface StatePort {
  transitionState(tradeId: string, newStatus: TradeStatus, reason: string): Promise<Trade>;
  getTradeStatus(tradeId: string): Promise<TradeStatus>;
}
```

### Events

**StateChangedEvent**
- Emitted when trade status changes
- Payload: `trade`, `oldStatus`, `newStatus`, `reason`

## Application

### Commands

**TransitionStateCommand**
- Input: `tradeId`, `newStatus`, `reason`
- Output: `Trade`
- Validates transition before executing

### Queries

**GetTradeStatusQuery**
- Input: `tradeId`
- Output: `TradeStatus`

## State Transitions

```
pending → active         (entry hit)
active → partial_tp     (any TP hit)
partial_tp → partial_tp (more TP hit)
partial_tp → breakeven  (SL moved to entry)
active → breakeven      (SL moved to entry)
breakeven → closed_breakeven (breakeven hit)

active → closed_win     (all TP hit)
active → closed_loss    (SL hit, no TP)
partial_tp → closed_partial (SL hit after TP)
partial_tp → closed_loss   (SL hit, no more TP)

active/partial_tp/breakeven → closed_manual (user close)
pending → cancelled     (user cancel)
```

Valid transitions are defined in `trade-shared.md`.

## Notes

- Only handles state transitions, NOT trigger detection (that is in `trade/engine`)
- Only handles state transitions, NOT modifications (that is in `telegram/command`)
- Uses `VALID_TRANSITIONS` from `trade-shared.md`
- Uses types from `trade-shared.md`