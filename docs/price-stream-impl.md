# price/stream Implementation Guide

Implementation details for `src/price/stream/` - stream prices using exchange adapter.

---

## Directory Structure

```
src/price/stream/
├── domain/
│   ├── services/
│   │   └── price-stream.service.ts      # Main streaming service
│   ├── ports/
│   │   ├── price-stream.port.ts         # Interface for price streaming
│   │   └── index.ts
│   └── events/
│       ├── price-updated.event.ts
│       └── index.ts
├── application/
│   ├── commands/
│   │   ├── subscribe-symbols.command.ts
│   │   ├── unsubscribe-symbols.command.ts
│   │   └── index.ts
│   └── index.ts
├── infrastructure/
│   └── adapters/
│       └── index.ts
└── index.ts
```

---

## domain/ports/price-stream.port.ts

```typescript
import { Price } from '../../trade/shared/types';

export interface SubscriptionInfo {
  symbol: string;
  unsubscribe: () => void;
  subscribedAt: Date;
}

export interface PriceStreamPort {
  subscribe(symbol: string, callback: (price: Price) => void): SubscriptionInfo;
  unsubscribe(symbol: string): void;
  unsubscribeAll(): void;
  getActiveSubscriptions(): string[];
  isSubscribed(symbol: string): boolean;
}
```

---

## domain/services/price-stream.service.ts

```typescript
import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { PriceStreamPort, SubscriptionInfo } from '../ports/price-stream.port';
import { ExchangePort } from '../../price/exchange/domain/ports/exchange.port';
import { Price } from '../../trade/shared/types';
import { PriceUpdatedEvent } from '../events/price-updated.event';

@Injectable()
export class PriceStreamService {
  private subscriptions: Map<string, SubscriptionInfo> = new Map();

  constructor(
    @Inject(forwardRef(() => ExchangePort))
    private readonly exchange: ExchangePort,
    private readonly eventBus: EventBus,
  ) {}

  subscribe(symbol: string): SubscriptionInfo {
    const upperSymbol = symbol.toUpperCase();

    if (this.subscriptions.has(upperSymbol)) {
      return this.subscriptions.get(upperSymbol)!;
    }

    const unsubscribe = this.exchange.subscribeToTicker(upperSymbol, (price) => {
      this.handlePriceUpdate(price);
    });

    const subscription: SubscriptionInfo = {
      symbol: upperSymbol,
      unsubscribe,
      subscribedAt: new Date(),
    };

    this.subscriptions.set(upperSymbol, subscription);
    return subscription;
  }

  unsubscribe(symbol: string): void {
    const upperSymbol = symbol.toUpperCase();
    const subscription = this.subscriptions.get(upperSymbol);

    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(upperSymbol);
    }
  }

  unsubscribeAll(): void {
    this.subscriptions.forEach((sub) => {
      sub.unsubscribe();
    });
    this.subscriptions.clear();
  }

  getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  isSubscribed(symbol: string): boolean {
    return this.subscriptions.has(symbol.toUpperCase());
  }

  private async handlePriceUpdate(price: Price) {
    await this.eventBus.publish(new PriceUpdatedEvent(price));
  }
}
```

---

## domain/events/price-updated.event.ts

```typescript
import { Price } from '../../trade/shared/types';

export class PriceUpdatedEvent {
  constructor(public readonly price: Price) {}
}
```

---

## application/commands/subscribe-symbols.command.ts

```typescript
import { ICommand } from '@nestjs/cqrs';

export class SubscribeSymbolsCommand implements ICommand {
  constructor(public readonly symbols: string[]) {}
}
```

---

## application/commands/unsubscribe-symbols.command.ts

```typescript
import { ICommand } from '@nestjs/cqrs';

export class UnsubscribeSymbolsCommand implements ICommand {
  constructor(public readonly symbols: string[]) {}
}
```

---

## application/commands/handler/subscribe-symbols.handler.ts

```typescript
import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { SubscribeSymbolsCommand } from './subscribe-symbols.command';
import { PriceStreamService } from '../../domain/services/price-stream.service';

@CommandHandler(SubscribeSymbolsCommand)
export class SubscribeSymbolsHandler
  implements ICommandHandler<SubscribeSymbolsCommand>
{
  constructor(private readonly priceStream: PriceStreamService) {}

  async execute(command: SubscribeSymbolsCommand) {
    const results = command.symbols.map(symbol => {
      const subscription = this.priceStream.subscribe(symbol);
      return {
        symbol: subscription.symbol,
        subscribedAt: subscription.subscribedAt,
      };
    });
    return results;
  }
}
```

---

## Module Configuration

```typescript
// price.stream.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PriceStreamService } from './domain/services/price-stream.service';
import { SubscribeSymbolsHandler } from './application/commands/handler/subscribe-symbols.handler';
import { PriceExchangeModule } from '../../price/exchange/price.exchange.module';

const CommandHandlers = [SubscribeSymbolsHandler];

@Module({
  imports: [
    CqrsModule,
    forwardRef(() => PriceExchangeModule),
  ],
  providers: [
    PriceStreamService,
    ...CommandHandlers,
  ],
  exports: [PriceStreamService],
})
export class PriceStreamModule {}
```

---

## Usage Example

```typescript
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { PriceStreamService } from './domain/services/price-stream.service';
import { Price } from '../../trade/shared/types';
import { PriceUpdatedEvent } from './events/price-updated.event';

@Injectable()
export class PriceMonitor implements OnModuleDestroy {
  constructor(
    private readonly priceStream: PriceStreamService,
    private readonly eventBus: EventBus,
  ) {}

  async startMonitoring(symbols: string[]) {
    symbols.forEach(symbol => {
      this.priceStream.subscribe(symbol, (price) => {
        this.onPriceUpdate(price);
      });
    });
  }

  private onPriceUpdate(price: Price) {
    console.log(`Price update: ${price.symbol} - ${price.last}`);
  }

  onModuleDestroy() {
    this.priceStream.unsubscribeAll();
  }
}
```

---

## Event Flow

```
price/stream
       │
       ▼
PriceStreamService.subscribe(symbol)
       │
       ▼
ExchangePort.subscribeToTicker() (from price/exchange)
       │
       ▼
WebSocket receives price update
       │
       ▼
PriceUpdatedEvent ──► trade/engine (trigger detection)
                      └─► price/cache (store latest)
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
- `price/exchange` (ExchangePort)

---

## Next Context

After completing `price/stream`, proceed to **price/cache** for in-memory price caching.