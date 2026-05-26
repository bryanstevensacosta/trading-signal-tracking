# trade/state Implementation Guide

Implementation details for `src/trade/state/` - state transitions only (no trigger detection, no modifications).

---

## Directory Structure

```
src/trade/state/
├── domain/
│   ├── services/
│   │   ├── state-machine.service.ts     # State transition logic
│   │   └── index.ts
│   ├── ports/
│   │   ├── state.port.ts                # Interface for state operations
│   │   └── index.ts
│   ├── events/
│   │   ├── state-changed.event.ts
│   │   └── index.ts
│   └── errors/
│       └── state-errors.ts
├── application/
│   ├── commands/
│   │   ├── transition-state.command.ts
│   │   ├── activate-trade.command.ts
│   │   ├── close-trade.command.ts
│   │   └── cancel-trade.command.ts
│   ├── handlers/
│   │   └── state-transition.handler.ts
│   └── index.ts
├── infrastructure/
│   └── adapters/
│       └── index.ts
└── index.ts
```

---

## Important Notes

**What trade/state does:**
- State transitions (PENDING → ACTIVE, ACTIVE → CLOSED_WIN, etc.)
- Validates transitions using VALID_TRANSITIONS map
- Emits StateChangedEvent

**What trade/state does NOT do:**
- Trigger detection (that goes to trade/engine)
- Entry/SL/TP modifications (that goes to telegram/command)
- Price monitoring (that goes to trade/engine)

---

## domain/services/state-machine.service.ts

```typescript
import { Injectable } from '@nestjs/common';
import { Trade, TradeStatus } from '../../shared/types';
import { isValidTransition } from '../../shared/constants';

export interface TransitionResult {
  success: boolean;
  newStatus?: TradeStatus;
  error?: string;
}

@Injectable()
export class StateMachineService {
  canTransition(trade: Trade, targetStatus: TradeStatus): boolean {
    return isValidTransition(trade.status, targetStatus);
  }

  transition(
    trade: Trade,
    targetStatus: TradeStatus,
    reason?: string
  ): TransitionResult {
    if (!this.canTransition(trade, targetStatus)) {
      return {
        success: false,
        error: `Invalid transition from ${trade.status} to ${targetStatus}`,
      };
    }

    const newTrade = {
      ...trade,
      status: targetStatus,
      updatedAt: new Date(),
      closedAt: targetStatus.startsWith('closed_') ? new Date() : trade.closedAt,
    };

    return {
      success: true,
      newStatus: targetStatus,
    };
  }

  activate(trade: Trade): TransitionResult {
    return this.transition(trade, TradeStatus.ACTIVE, 'entry_triggered');
  }

  closeWithTP(trade: Trade): TransitionResult {
    return this.transition(trade, TradeStatus.CLOSED_WIN, 'all_tp_hit');
  }

  closeWithSL(trade: Trade): TransitionResult {
    return this.transition(trade, TradeStatus.CLOSED_LOSS, 'sl_triggered');
  }

  closeManual(trade: Trade): TransitionResult {
    return this.transition(trade, TradeStatus.CLOSED_MANUAL, 'manual_close');
  }

  cancel(trade: Trade): TransitionResult {
    return this.transition(trade, TradeStatus.CANCELLED, 'cancelled');
  }

  moveToBreakeven(trade: Trade): TransitionResult {
    return this.transition(trade, TradeStatus.BREAKEVEN, 'moved_to_breakeven');
  }
}
```

---

## domain/ports/state.port.ts

```typescript
import { Trade, TradeStatus } from '../../shared/types';
import { TransitionResult } from '../services/state-machine.service';

export interface StatePort {
  transition(trade: Trade, targetStatus: TradeStatus, reason?: string): Promise<TransitionResult>;
  activate(trade: Trade): Promise<TransitionResult>;
  closeWithTP(trade: Trade): Promise<TransitionResult>;
  closeWithSL(trade: Trade): Promise<TransitionResult>;
  closeManual(trade: Trade): Promise<TransitionResult>;
  cancel(trade: Trade): Promise<TransitionResult>;
  moveToBreakeven(trade: Trade): Promise<TransitionResult>;
}
```

---

## domain/events/state-changed.event.ts

```typescript
import { Trade, TradeStatus } from '../../shared/types';

export class StateChangedEvent {
  constructor(
    public readonly trade: Trade,
    public readonly oldStatus: TradeStatus,
    public readonly newStatus: TradeStatus,
    public readonly reason: string,
  ) {}
}
```

---

## domain/errors/state-errors.ts

```typescript
export class InvalidTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Invalid transition from ${from} to ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export class TradeNotFoundError extends Error {
  constructor(id: string) {
    super(`Trade not found: ${id}`);
    this.name = 'TradeNotFoundError';
  }
}
```

---

## application/commands/transition-state.command.ts

```typescript
import { ICommand } from '@nestjs/cqrs';
import { TradeStatus } from '../../shared/types';

export class TransitionStateCommand implements ICommand {
  constructor(
    public readonly tradeId: string,
    public readonly targetStatus: TradeStatus,
    public readonly reason?: string,
  ) {}
}
```

---

## application/commands/activate-trade.command.ts

```typescript
import { ICommand } from '@nestjs/cqrs';

export class ActivateTradeCommand implements ICommand {
  constructor(public readonly tradeId: string) {}
}
```

---

## application/commands/close-trade.command.ts

```typescript
import { ICommand } from '@nestjs/cqrs';
import { CloseReason } from '../../shared/types';

export class CloseTradeCommand implements ICommand {
  constructor(
    public readonly tradeId: string,
    public readonly reason: CloseReason,
  ) {}
}
```

---

## application/commands/cancel-trade.command.ts

```typescript
import { ICommand } from '@nestjs/cqrs';

export class CancelTradeCommand implements ICommand {
  constructor(public readonly tradeId: string) {}
}
```

---

## application/handlers/state-transition.handler.ts

```typescript
import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { EventBus } from '@nestjs/cqrs';
import { TransitionStateCommand } from '../commands/transition-state.command';
import { TradeRepositoryPort } from '../../trade/repository/domain/ports/trade-repository.port';
import { StateMachineService } from '../domain/services/state-machine.service';
import { StateChangedEvent } from '../domain/events/state-changed.event';

@CommandHandler(TransitionStateCommand)
export class StateTransitionHandler
  implements ICommandHandler<TransitionStateCommand>
{
  constructor(
    private readonly repository: TradeRepositoryPort,
    private readonly stateMachine: StateMachineService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: TransitionStateCommand) {
    const trade = await this.repository.findById(command.tradeId);
    if (!trade) {
      throw new Error(`Trade not found: ${command.tradeId}`);
    }

    const result = this.stateMachine.transition(
      trade,
      command.targetStatus,
      command.reason
    );

    if (!result.success) {
      throw new Error(result.error);
    }

    await this.repository.update(command.tradeId, {
      status: command.targetStatus,
      closedAt: command.targetStatus.startsWith('closed_') ? new Date() : undefined,
    });

    const updatedTrade = await this.repository.findById(command.tradeId);

    await this.eventBus.publish(
      new StateChangedEvent(
        updatedTrade!,
        trade.status,
        command.targetStatus,
        command.reason || 'state_transition'
      )
    );

    return updatedTrade;
  }
}
```

---

## Module Configuration

```typescript
// trade.state.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { StateMachineService } from './domain/services/state-machine.service';
import { StateTransitionHandler } from './application/handlers/state-transition.handler';
import { TradeRepositoryModule } from '../repository/trade.repository.module';

const CommandHandlers = [StateTransitionHandler];

@Module({
  imports: [
    CqrsModule,
    forwardRef(() => TradeRepositoryModule),
  ],
  providers: [
    StateMachineService,
    ...CommandHandlers,
  ],
  exports: [StateMachineService],
})
export class TradeStateModule {}
```

---

## Usage Example

```typescript
import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { TransitionStateCommand } from './commands/transition-state.command';
import { TradeStatus } from '../shared/types';

@Injectable()
export class TradeTriggerService {
  constructor(private readonly commandBus: CommandBus) {}

  async onEntryHit(tradeId: string) {
    await this.commandBus.execute(
      new TransitionStateCommand(tradeId, TradeStatus.ACTIVE, 'entry_triggered')
    );
  }

  async onSLHit(tradeId: string) {
    await this.commandBus.execute(
      new TransitionStateCommand(tradeId, TradeStatus.CLOSED_LOSS, 'sl_triggered')
    );
  }

  async onAllTPHit(tradeId: string) {
    await this.commandBus.execute(
      new TransitionStateCommand(tradeId, TradeStatus.CLOSED_WIN, 'all_tp_hit')
    );
  }
}
```

---

## Event Flow

```
trade/engine detects trigger
       │
       ▼
TransitionStateCommand
       │
       ▼
StateMachineService.transition()
       │  (validates using VALID_TRANSITIONS)
       │
       ├─► Invalid ──► Throw error
       │
       └─► Valid ──► Update trade in repository
                          │
                          ▼
                   StateChangedEvent
                          │
                          ├─► telegram/notification (send alert)
                          └─► trade/engine (stop monitoring)
```

---

## Dependencies

```json
{
  "@nestjs/common": "^10.0.0",
  "@nestjs/core": "^10.0.0",
  "@nestjs/cqrs": "^10.0.0"
}
```

Depends on:
- `trade/shared` (types, VALID_TRANSITIONS)
- `trade/repository` (to fetch/update trades)

---

## Next Context

After completing `trade/state`, proceed to **price/exchange** for exchange adapters (Binance first).