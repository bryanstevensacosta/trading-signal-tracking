# Hexagonal Architecture (Ports & Adapters)

## Overview

Hexagonal Architecture (also known as Ports and Adapters) organizes code to separate core business logic from external concerns. The domain sits at the center, with infrastructure "adapting" to it through "ports."

## Layer Structure

```
┌─────────────────────────────────────────┐
│              API / Clients              │
│         (Telegram, HTTP, WebSocket)      │
└─────────────────────┬───────────────────┘
                     │
┌─────────────────────▼───────────────────┐
│              Application                  │
│         (Commands, Queries, DTOs)          │
└─────────────────────┬───────────────────┘
                     │
┌─────────────────────▼───────────────────┐
│                Domain                     │
│    (Entities, Services, Ports, Events)    │
└─────────────────────┬───────────────────┘
                     │
┌─────────────────────▼───────────────────┐
│             Infrastructure               │
│      (Adapters: SQLite, Binance, etc.)   │
└─────────────────────────────────────────┘
```

## Each Layer Explained

### 1. Domain Layer (Core)

Contains pure business logic with no dependencies on external frameworks.

```typescript
// domain/ports/trade-repository.port.ts
export interface TradeRepositoryPort {
  save(input: CreateTradeInput): Promise<Trade>;
  findById(id: string): Promise<Trade | null>;
  findAll(): Promise<Trade[]>;
}

// domain/services/state-machine.service.ts
export class StateMachineService {
  canTransition(from: TradeStatus, to: TradeStatus): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }
}

// domain/entities/trade.entity.ts
export class Trade {
  id: string;
  symbol: string;
  side: TradeSide;
  status: TradeStatus;
  // Business methods
  activate(): void { /* ... */ }
}
```

**Responsibilities:**
- Business rules
- Domain entities and value objects
- Port interfaces (contracts)
- Domain events

---

### 2. Application Layer

Orchestrates domain logic, implements CQRS patterns.

```typescript
// application/commands/save-trade/
// command.ts
export class SaveTradeCommand implements ICommand {
  constructor(public readonly input: CreateTradeInput) {}
}

// handler.ts
@CommandHandler(SaveTradeCommand)
export class SaveTradeHandler implements ICommandHandler<SaveTradeCommand> {
  constructor(private readonly repository: TradeRepositoryPort) {}

  async execute(command: SaveTradeCommand): Promise<Trade> {
    return this.repository.save(command.input);
  }
}
```

**Responsibilities:**
- Command handlers
- Query handlers
- DTOs and mappers
- Orchestration of domain services

---

### 3. Infrastructure Layer

Implements ports defined by domain using external systems.

```typescript
// infrastructure/adapters/sqlite-trade.adapter.ts
@Injectable()
export class SqliteTradeAdapter implements TradeRepositoryPort {
  constructor(
    @InjectRepository(TradeEntity)
    private readonly repository: Repository<TradeEntity>,
  ) {}

  async save(input: CreateTradeInput): Promise<Trade> {
    const entity = this.repository.create(input);
    const saved = await this.repository.save(entity);
    return TradeMapper.toDomain(saved);
  }
}

// infrastructure/adapters/binance-exchange.adapter.ts
@Injectable()
export class BinanceExchangeAdapter implements ExchangePort {
  async getTicker(symbol: string): Promise<Price> {
    // Binance API call
  }
}
```

**Responsibilities:**
- Port implementations
- External API clients
- Database adapters
- Message brokers

---

### 4. API / Clients Layer

External interfaces that consume the application.

```typescript
// telegram/telegram-bot.adapter.ts
@Injectable()
export class TelegramBotAdapter implements OnModuleInit {
  async onModuleInit() {
    this.bot.command('trades', async (ctx) => {
      const trades = await this.queryBus.execute(new GetAllTradesQuery());
      // Send to Telegram
    });
  }
}
```

---

## Our Bounded Contexts Structure

```
src/trade/
├── domain/
│   ├── ports/           # Interfaces (contracts)
│   ├── services/        # Business logic
│   ├── entities/        # Domain models
│   └── events/          # Domain events
├── application/
│   └── commands/        # CQRS commands
│       └── save-trade/
│           ├── command.ts
│           └── handler.ts
└── infrastructure/
    └── adapters/        # Implementations
        └── sqlite-trade.adapter.ts
```

## Ports vs Adapters

| Concept | Description | Example |
|---------|-------------|---------|
| Port | Interface defined in domain | `TradeRepositoryPort` |
| Adapter | Implementation in infrastructure | `SqliteTradeAdapter` |

The domain defines **what** needs to be done (port), infrastructure defines **how** (adapter).

---

## Dependency Rule

```
Domain → Application → Infrastructure
   ↑           │
   └───────────┘ (depends on interfaces, not implementations)
```

**Key Principle:** Domain should never depend on infrastructure. Dependencies point inward.

## References

- Alistair Cockburn - Hexagonal Architecture
- Robert C. Martin - Clean Architecture