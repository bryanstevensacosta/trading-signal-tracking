# price/cache Implementation Guide

Implementation details for `src/price/cache/` - in-memory price cache.

---

## Directory Structure

```
src/price/cache/
├── domain/
│   ├── ports/
│   │   ├── price-cache.port.ts          # Interface for price cache
│   │   └── index.ts
│   ├── services/
│   │   └── price-cache.service.ts      # Cache management
│   └── events/
│       └── index.ts
├── application/
│   ├── commands/
│   │   ├── set-price.command.ts
│   │   ├── remove-price.command.ts
│   │   └── index.ts
│   ├── queries/
│   │   ├── get-price.query.ts
│   │   ├── get-all-prices.query.ts
│   │   └── index.ts
│   └── event-handlers/
│       ├── on-price-updated.handler.ts
│       └── index.ts
├── infrastructure/
│   └── adapters/
│       └── index.ts
└── index.ts
```

---

## domain/ports/price-cache.port.ts

```typescript
import { Price } from '../../trade/shared/types';

export interface PriceCachePort {
  set(price: Price): void;
  get(symbol: string): Price | null;
  getAll(): Price[];
  remove(symbol: string): void;
  clear(): void;
  has(symbol: string): boolean;
  size(): number;
}
```

---

## domain/services/price-cache.service.ts

```typescript
import { Injectable } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { PriceCachePort } from '../ports/price-cache.port';
import { Price } from '../../trade/shared/types';
import { PriceUpdatedEvent } from '../../price/stream/events/price-updated.event';

@Injectable()
export class PriceCacheService implements PriceCachePort {
  private cache: Map<string, Price> = new Map();

  constructor(private readonly eventBus: EventBus) {}

  set(price: Price): void {
    const upperSymbol = price.symbol.toUpperCase();
    this.cache.set(upperSymbol, {
      ...price,
      symbol: upperSymbol,
      timestamp: new Date(),
    });
  }

  get(symbol: string): Price | null {
    return this.cache.get(symbol.toUpperCase()) || null;
  }

  getAll(): Price[] {
    return Array.from(this.cache.values());
  }

  remove(symbol: string): void {
    this.cache.delete(symbol.toUpperCase());
  }

  clear(): void {
    this.cache.clear();
  }

  has(symbol: string): boolean {
    return this.cache.has(symbol.toUpperCase());
  }

  size(): number {
    return this.cache.size;
  }

  getBySymbols(symbols: string[]): Price[] {
    return symbols
      .map(symbol => this.get(symbol))
      .filter((price): price is Price => price !== null);
  }
}
```

---

## application/commands/set-price.command.ts

```typescript
import { ICommand } from '@nestjs/cqrs';
import { Price } from '../../trade/shared/types';

export class SetPriceCommand implements ICommand {
  constructor(public readonly price: Price) {}
}
```

---

## application/commands/handler/set-price.handler.ts

```typescript
import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { SetPriceCommand } from './set-price.command';
import { PriceCacheService } from '../../domain/services/price-cache.service';

@CommandHandler(SetPriceCommand)
export class SetPriceHandler implements ICommandHandler<SetPriceCommand> {
  constructor(private readonly cache: PriceCacheService) {}

  async execute(command: SetPriceCommand) {
    this.cache.set(command.price);
  }
}
```

---

## application/queries/get-price.query.ts

```typescript
import { IQuery } from '@nestjs/cqrs';

export class GetPriceQuery implements IQuery {
  constructor(public readonly symbol: string) {}
}
```

---

## application/queries/handler/get-price.handler.ts

```typescript
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetPriceQuery } from './get-price.query';
import { PriceCacheService } from '../../domain/services/price-cache.service';

@QueryHandler(GetPriceQuery)
export class GetPriceHandler implements IQueryHandler<GetPriceQuery> {
  constructor(private readonly cache: PriceCacheService) {}

  async execute(query: GetPriceQuery) {
    return this.cache.get(query.symbol);
  }
}
```

---

## application/event-handlers/on-price-updated.handler.ts

```typescript
import { EventsHandler, IEventHandler, EventBus } from '@nestjs/cqrs';
import { PriceUpdatedEvent } from '../../price/stream/events/price-updated.event';
import { PriceCacheService } from '../domain/services/price-cache.service';

@EventsHandler(PriceUpdatedEvent)
export class OnPriceUpdatedHandler
  implements IEventHandler<PriceUpdatedEvent>
{
  constructor(
    private readonly cache: PriceCacheService,
    private readonly eventBus: EventBus,
  ) {}

  async handle(event: PriceUpdatedEvent) {
    this.cache.set(event.price);
  }
}
```

---

## Module Configuration

```typescript
// price.cache.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PriceCacheService } from './domain/services/price-cache.service';
import { SetPriceHandler } from './application/commands/handler/set-price.handler';
import { GetPriceHandler } from './application/queries/handler/get-price.handler';
import { OnPriceUpdatedHandler } from './application/event-handlers/on-price-updated.handler';
import { PriceStreamModule } from '../../price/stream/price.stream.module';

const CommandHandlers = [SetPriceHandler];
const QueryHandlers = [GetPriceHandler];
const EventHandlers = [OnPriceUpdatedHandler];

@Module({
  imports: [
    CqrsModule,
    forwardRef(() => PriceStreamModule),
  ],
  providers: [
    PriceCacheService,
    ...CommandHandlers,
    ...QueryHandlers,
    ...EventHandlers,
  ],
  exports: [PriceCacheService],
})
export class PriceCacheModule {}
```

---

## Usage Example

```typescript
import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { GetPriceQuery } from './queries/get-price.query';
import { PriceCacheService } from './domain/services/price-cache.service';

@Injectable()
export class PriceChecker {
  constructor(
    private readonly cache: PriceCacheService,
    private readonly queryBus: QueryBus,
  ) {}

  async checkPrice(symbol: string) {
    const cached = this.cache.get(symbol);
    if (cached) {
      return cached;
    }
    return this.queryBus.execute(new GetPriceQuery(symbol));
  }
}
```

---

## Event Flow

```
price/stream publishes PriceUpdatedEvent
       │
       ▼
OnPriceUpdatedHandler
       │
       ▼
PriceCacheService.set(price)
       │
       ▼
trade/engine subscribes to cache for latest prices
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
- `trade/shared` (Price type)
- `price/stream` (PriceUpdatedEvent)

---

## Next Context

After completing `price/cache`, proceed to **trade/engine** for trigger detection.