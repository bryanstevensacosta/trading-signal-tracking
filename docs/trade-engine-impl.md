# trade/engine Implementation Guide

Implementation details for `src/trade/engine/` - monitor prices and detect triggers (entry, TP, SL).

---

## Directory Structure

```
src/trade/engine/
├── domain/
│   ├── services/
│   │   ├── trading-engine.service.ts   # Main monitoring logic
│   │   └── trigger-detector.service.ts # Trigger detection
│   ├── ports/
│   │   ├── price-subscription.port.ts  # Interface for price subscriptions
│   │   └── index.ts
│   └── events/
│       ├── trigger-detected.event.ts
│       ├── monitoring-started.event.ts
│       ├── monitoring-stopped.event.ts
│       └── index.ts
├── application/
│   ├── commands/
│   │   ├── start-monitoring.command.ts
│   │   ├── stop-monitoring.command.ts
│   │   ├── check-all-trades.command.ts
│   │   └── index.ts
│   ├── handlers/
│   │   ├── on-price-updated.handler.ts
│   │   ├── start-monitoring.handler.ts
│   │   └── index.ts
│   └── index.ts
├── infrastructure/
│   └── adapters/
│       └── index.ts
└── index.ts
```

---

## Important Notes

**What trade/engine does:**
- Monitor ALL trades (pending + active) to detect entry hits
- Detect TP hits, SL hits
- Calculate RR (risk/reward) at trigger time
- Emit TriggerDetectedEvent

**What trade/engine does NOT do:**
- State transitions (that goes to trade/state)
- Send notifications (that goes to telegram/notification)
- Handle modifications (that goes to telegram/command)

---

## domain/services/trigger-detector.service.ts

```typescript
import { Injectable } from '@nestjs/common';
import { Trade, TradeSide, TriggerType, Price } from '../../shared/types';

export interface TriggerResult {
  triggered: boolean;
  trigger?: TriggerType;
  price?: number;
  rr?: number;
  tpIndex?: number;
}

@Injectable()
export class TriggerDetectorService {
  checkEntryHit(trade: Trade, price: Price): TriggerResult {
    if (trade.status !== 'pending') {
      return { triggered: false };
    }

    const hitPrice = trade.side === TradeSide.LONG ? price.ask : price.bid;
    const entry = trade.entry;
    const entryMax = trade.entryMax || entry;

    const isHit =
      trade.side === TradeSide.LONG
        ? hitPrice >= entry && hitPrice <= entryMax
        : hitPrice <= entry && hitPrice >= entryMax;

    if (isHit) {
      return {
        triggered: true,
        trigger: TriggerType.ENTRY,
        price: hitPrice,
      };
    }

    return { triggered: false };
  }

  checkTPHit(trade: Trade, price: Price): TriggerResult {
    if (!trade.tps || trade.tps.length === 0) {
      return { triggered: false };
    }

    const currentPrice = trade.side === TradeSide.LONG ? price.bid : price.ask;

    for (let i = 0; i < trade.tps.length; i++) {
      const tp = trade.tps[i];
      if (trade.tpsHit?.includes(i)) continue;

      const isHit =
        trade.side === TradeSide.LONG
          ? currentPrice >= tp
          : currentPrice <= tp;

      if (isHit) {
        const rr = trade.sl
          ? this.calculateRR(trade.entry, trade.sl, tp, trade.side)
          : undefined;

        return {
          triggered: true,
          trigger: TriggerType.TP,
          price: tp,
          rr,
          tpIndex: i,
        };
      }
    }

    return { triggered: false };
  }

  checkSLHit(trade: Trade, price: Price): TriggerResult {
    if (!trade.sl) {
      return { triggered: false };
    }

    const currentPrice = trade.side === TradeSide.LONG ? price.bid : price.ask;

    const isHit =
      trade.side === TradeSide.LONG
        ? currentPrice <= trade.sl
        : currentPrice >= trade.sl;

    if (isHit) {
      const rr = -1;

      return {
        triggered: true,
        trigger: TriggerType.SL,
        price: trade.sl,
        rr,
      };
    }

    return { triggered: false };
  }

  checkAllTriggers(trade: Trade, price: Price): TriggerResult {
    const entryResult = this.checkEntryHit(trade, price);
    if (entryResult.triggered) return entryResult;

    const tpResult = this.checkTPHit(trade, price);
    if (tpResult.triggered) return tpResult;

    const slResult = this.checkSLHit(trade, price);
    if (slResult.triggered) return slResult;

    return { triggered: false };
  }

  private calculateRR(entry: number, sl: number, tp: number, side: TradeSide): number {
    const r = Math.abs(entry - sl);
    if (r === 0) return 0;

    const reward = Math.abs(tp - entry);
    const rr = reward / r;

    return side === TradeSide.SHORT ? -rr : rr;
  }
}
```

---

## domain/services/trading-engine.service.ts

```typescript
import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { Trade, Price } from '../../shared/types';
import { TradeRepositoryPort } from '../../trade/repository/domain/ports/trade-repository.port';
import { PriceStreamService } from '../../price/stream/domain/services/price-stream.service';
import { TriggerDetectorService } from './services/trigger-detector.service';
import { TriggerDetectedEvent } from './events/trigger-detected.event';

@Injectable()
export class TradingEngineService {
  private monitoredSymbols: Set<string> = new Set();

  constructor(
    private readonly repository: TradeRepositoryPort,
    @Inject(forwardRef(() => PriceStreamService))
    private readonly priceStream: PriceStreamService,
    private readonly triggerDetector: TriggerDetectorService,
    private readonly eventBus: EventBus,
  ) {}

  async startMonitoring(trade: Trade): Promise<void> {
    const symbol = trade.symbol.toUpperCase();
    
    if (!this.monitoredSymbols.has(symbol)) {
      this.priceStream.subscribe(symbol, (price) => {
        this.onPriceUpdate(trade.id, price);
      });
      this.monitoredSymbols.add(symbol);
    }
  }

  async stopMonitoring(trade: Trade): Promise<void> {
    const symbol = trade.symbol.toUpperCase();
    const otherTrades = await this.repository.findBySymbol(symbol);
    
    const stillActive = otherTrades.filter(
      t => t.id !== trade.id && ['pending', 'active'].includes(t.status)
    );

    if (stillActive.length === 0) {
      this.priceStream.unsubscribe(symbol);
      this.monitoredSymbols.delete(symbol);
    }
  }

  async startMonitoringAll(): Promise<void> {
    const activeTrades = await this.repository.findActive();
    const pendingTrades = await this.repository.findPending();

    const allTrades = [...activeTrades, ...pendingTrades];
    const symbols = [...new Set(allTrades.map(t => t.symbol.toUpperCase()))];

    for (const symbol of symbols) {
      if (!this.monitoredSymbols.has(symbol)) {
        this.priceStream.subscribe(symbol, (price) => {
          this.onPriceUpdateForSymbol(symbol, price);
        });
        this.monitoredSymbols.add(symbol);
      }
    }
  }

  async onPriceUpdate(tradeId: string, price: Price): Promise<void> {
    const trade = await this.repository.findById(tradeId);
    if (!trade) return;

    const result = this.triggerDetector.checkAllTriggers(trade, price);

    if (result.triggered) {
      await this.eventBus.publish(
        new TriggerDetectedEvent(trade, result.trigger!, result.price!, result.rr, result.tpIndex)
      );
    }
  }

  private async onPriceUpdateForSymbol(symbol: string, price: Price): Promise<void> {
    const trades = await this.repository.findBySymbol(symbol);

    for (const trade of trades) {
      if (!['pending', 'active'].includes(trade.status)) continue;

      const result = this.triggerDetector.checkAllTriggers(trade, price);

      if (result.triggered) {
        await this.eventBus.publish(
          new TriggerDetectedEvent(trade, result.trigger!, result.price!, result.rr, result.tpIndex)
        );
      }
    }
  }

  getMonitoredSymbols(): string[] {
    return Array.from(this.monitoredSymbols);
  }
}
```

---

## domain/ports/price-subscription.port.ts

```typescript
import { Price } from '../../trade/shared/types';

export interface PriceSubscriptionPort {
  subscribe(symbol: string, callback: (price: Price) => void): () => void;
  unsubscribe(symbol: string): void;
  getActiveSymbols(): string[];
}
```

---

## domain/events/trigger-detected.event.ts

```typescript
import { Trade, TriggerType } from '../../shared/types';

export class TriggerDetectedEvent {
  constructor(
    public readonly trade: Trade,
    public readonly trigger: TriggerType,
    public readonly price: number,
    public readonly rr?: number,
    public readonly tpIndex?: number,
  ) {}
}
```

---

## domain/events/monitoring-started.event.ts

```typescript
import { Trade } from '../../shared/types';

export class MonitoringStartedEvent {
  constructor(public readonly trade: Trade) {}
}
```

---

## domain/events/monitoring-stopped.event.ts

```typescript
import { Trade } from '../../shared/types';

export class MonitoringStoppedEvent {
  constructor(public readonly trade: Trade, public readonly reason: string) {}
}
```

---

## application/commands/start-monitoring.command.ts

```typescript
import { ICommand } from '@nestjs/cqrs';

export class StartMonitoringCommand implements ICommand {
  constructor(public readonly tradeId: string) {}
}
```

---

## application/commands/stop-monitoring.command.ts

```parameter name="content">import { ICommand } from '@nestjs/cqrs';

export class StopMonitoringCommand implements ICommand {
  constructor(
    public readonly tradeId: string,
    public readonly reason?: string,
  ) {}
}
```

---

## application/commands/check-all-trades.command.ts

```typescript
import { ICommand } from '@nestjs/cqrs';

export class CheckAllTradesCommand implements ICommand {}
```

---

## application/handlers/on-price-updated.handler.ts

```typescript
import { EventsHandler, IEventHandler, EventBus } from '@nestjs/cqrs';
import { PriceUpdatedEvent } from '../../price/stream/events/price-updated.event';
import { TradingEngineService } from '../domain/services/trading-engine.service';
import { TradeRepositoryPort } from '../../trade/repository/domain/ports/trade-repository.port';

@EventsHandler(PriceUpdatedEvent)
export class OnPriceUpdatedHandler
  implements IEventHandler<PriceUpdatedEvent>
{
  constructor(
    private readonly engine: TradingEngineService,
    private readonly repository: TradeRepositoryPort,
  ) {}

  async handle(event: PriceUpdatedEvent) {
    const trades = await this.repository.findBySymbol(event.price.symbol);

    for (const trade of trades) {
      if (!['pending', 'active'].includes(trade.status)) continue;
      
      await this.engine.onPriceUpdate(trade.id, event.price);
    }
  }
}
```

---

## application/handlers/on-trigger-detected.handler.ts

```typescript
import { EventsHandler, IEventHandler, EventBus } from '@nestjs/cqrs';
import { TriggerDetectedEvent } from '../domain/events/trigger-detected.event';
import { CommandBus } from '@nestjs/cqrs';
import { TransitionStateCommand } from '../../trade/state/application/commands/transition-state.command';
import { TradeStatus } from '../../trade/shared/types';

@EventsHandler(TriggerDetectedEvent)
export class OnTriggerDetectedHandler
  implements IEventHandler<TriggerDetectedEvent>
{
  constructor(private readonly commandBus: CommandBus) {}

  async handle(event: TriggerDetectedEvent) {
    const { trade, trigger, tpIndex } = event;

    switch (trigger) {
      case 'entry':
        await this.commandBus.execute(
          new TransitionStateCommand(trade.id, TradeStatus.ACTIVE, 'entry_triggered')
        );
        break;

      case 'tp':
        const tpsHit = [...(trade.tpsHit || []), tpIndex!];
        const allTPHit = trade.tps!.length === tpsHit.length;
        
        if (allTPHit) {
          await this.commandBus.execute(
            new TransitionStateCommand(trade.id, TradeStatus.CLOSED_WIN, 'all_tp_hit')
          );
        } else {
          await this.commandBus.execute(
            new TransitionStateCommand(trade.id, TradeStatus.PARTIAL_TP, 'partial_tp_hit')
          );
        }
        break;

      case 'sl':
        await this.commandBus.execute(
          new TransitionStateCommand(trade.id, TradeStatus.CLOSED_LOSS, 'sl_triggered')
        );
        break;
    }
  }
}
```

---

## Module Configuration

```typescript
// trade.engine.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TradingEngineService } from './domain/services/trading-engine.service';
import { TriggerDetectorService } from './domain/services/trigger-detector.service';
import { OnPriceUpdatedHandler } from './application/handlers/on-price-updated.handler';
import { OnTriggerDetectedHandler } from './application/handlers/on-trigger-detected.handler';
import { TradeRepositoryModule } from '../repository/trade.repository.module';
import { TradeStateModule } from '../state/trade.state.module';
import { PriceStreamModule } from '../../price/stream/price.stream.module';

const EventHandlers = [OnPriceUpdatedHandler, OnTriggerDetectedHandler];

@Module({
  imports: [
    CqrsModule,
    forwardRef(() => TradeRepositoryModule),
    forwardRef(() => TradeStateModule),
    forwardRef(() => PriceStreamModule),
  ],
  providers: [
    TradingEngineService,
    TriggerDetectorService,
    ...EventHandlers,
  ],
  exports: [TradingEngineService, TriggerDetectorService],
})
export class TradeEngineModule {}
```

---

## Usage Example

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { TradingEngineService } from './domain/services/trading-engine.service';

@Injectable()
export class EngineStarter implements OnModuleInit {
  constructor(private readonly engine: TradingEngineService) {}

  async onModuleInit() {
    await this.engine.startMonitoringAll();
  }
}
```

---

## Event Flow

```
trade/engine
       │
       ▼
TradingEngineService.startMonitoringAll()
       │
       ▼
PriceStreamService.subscribe(symbols)
       │
       ▼
WebSocket publishes PriceUpdatedEvent
       │
       ▼
OnPriceUpdatedHandler
       │
       ▼
TriggerDetectorService.checkAllTriggers()
       │
       ├─► Entry hit ──► TriggerDetectedEvent (entry)
       │
       ├─► TP hit ──► TriggerDetectedEvent (tp)
       │
       └─► SL hit ──► TriggerDetectedEvent (sl)
                │
                ▼
         OnTriggerDetectedHandler
                │
                ▼
         TransitionStateCommand ──► trade/state
                     │
                     ▼
              StateChangedEvent ──► telegram/notification
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
- `trade/shared` (types)
- `trade/repository` (to get trades)
- `trade/state` (to transition state)
- `price/stream` (to subscribe to prices)

---

## Next Context

After completing `trade/engine`, proceed to **telegram/command** for handling user commands.