# Project Structure: Domain Driven Design + Hexagonal Architecture

## Overview

```
src/
├── bounded-context/
│   ├── domain/           # Pure business logic (no external dependencies)
│   ├── application/      # Use cases (CQRS)
│   ├── infrastructure/   # External implementations
│   └── shared/            # Shared types, events, helpers
└── config/               # NestJS configuration
```

---

## Domain Layer (`src/bounded-context/domain/`)

Contains the essence of the business. No framework or infrastructure dependencies.

### entities/
**Purpose:** Domain entities and Aggregate Roots

- Have unique identity
- Encapsulate invariants and business rules
- No dependencies on TypeORM, SQLite, etc.

```typescript
// domain/entities/trade.entity.ts
export class Trade {
  private status: TradeStatus;

  constructor(
    public readonly id: string,
    public readonly symbol: string,
    public readonly entry: number,
  ) {}

  activate(): void {
    if (this.status !== TradeStatus.PENDING) {
      throw new DomainError('Can only activate pending trades');
    }
    this.status = TradeStatus.ACTIVE;
  }
}
```

### services/
**Purpose:** Domain services

- Business logic that transcends entities (distributed transactions)
- Coordinate multiple entities or aggregates
- No state, only pure logic

```typescript
// domain/services/trade-activation.service.ts
export class TradeActivationService {
  activateTrade(trade: Trade, currentPrice: number): void {
    if (!trade.canActivate(currentPrice)) {
      throw new DomainError('Price outside entry range');
    }
    trade.activate();
  }
}
```

### ports/
**Purpose:** Interface abstraction (Hexagonal Architecture)

- Define contracts outward
- Domain depends on abstractions, not implementations
- Dependency inversion: infrastructure depends on domain

```typescript
// domain/ports/trade-repository.port.ts
export interface TradeRepositoryPort {
  findById(id: string): Promise<Trade | null>;
  save(trade: Trade): Promise<void>;
  findActive(): Promise<Trade[]>;
}
```

### value-objects/
**Purpose:** Value objects

- No identity of their own
- Immutable
- Value equality

```typescript
// domain/value-objects/money.vo.ts
export class Money {
  constructor(
    public readonly amount: number,
    public readonly currency: string,
  ) {}

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }
}
```

### events/
**Purpose:** Domain events

- Represent something that happened in the past
- Decouple domain logic
- Used by event handlers in application layer

```typescript
// domain/events/trade-activation.event.ts
export class TradeActivatedEvent {
  constructor(
    public readonly tradeId: string,
    public readonly activatedAt: Date,
  ) {}
}
```

---

## Application Layer (`src/bounded-context/application/`)

Contains use cases. Coordinates data flow between domain and infrastructure.

### commands/ or queries/

NestJS CQRS structure:

```
application/
├── commands/
│   └── save-trade/
│       ├── command.ts      # Command definition
│       ├── handler.ts      # Command logic
│       └── dto.ts          # (optional) Data Transfer Object
├── queries/
│   └── get-trade-by-id/
│       ├── query.ts
│       ├── handler.ts
│       └── dto.ts
└── event-handlers/         # Domain event handlers
    └── trade-activation.handler.ts
```

```typescript
// application/commands/save-trade/command.ts
export class SaveTradeCommand implements ICommand {
  constructor(public readonly input: CreateTradeInput) {}
}

// application/commands/save-trade/handler.ts
@CommandHandler(SaveTradeCommand)
export class SaveTradeHandler implements ICommandHandler<SaveTradeCommand> {
  constructor(
    private readonly repository: TradeRepositoryPort,
  ) {}

  async execute(command: SaveTradeCommand): Promise<Trade> {
    const trade = new Trade(command.symbol, command.side, command.entry);
    await this.repository.save(trade);
    return trade;
  }
}
```

---

## Infrastructure Layer (`src/bounded-context/infrastructure/`)

Concrete implementations of ports defined in domain.

### adapters/
**Purpose:** Port implementations

- Implement interfaces defined in domain/ports
- Contain external dependencies (TypeORM, SQLite, APIs, etc.)

```typescript
// infrastructure/adapters/sqlite-trade.adapter.ts
@Injectable()
export class SqliteTradeAdapter implements TradeRepositoryPort {
  constructor(
    @InjectRepository(TradeEntity)
    private readonly repository: Repository<TradeEntity>,
  ) {}

  async findById(id: string): Promise<Trade | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? TradeMapper.toDomain(entity) : null;
  }
}
```

### persistence/
**Purpose:** Persistence elements

- TypeORM Entity (with DB annotations)
- Mappers (domain ↔ entity)
- DB-specific repositories

```typescript
// infrastructure/persistence/trade.entity.ts (TypeORM)
@Entity('trades')
export class TradeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  symbol: string;
}

// infrastructure/persistence/trade.mapper.ts
export class TradeMapper {
  static toDomain(entity: TradeEntity): Trade {
    return new Trade(entity.id, entity.symbol, entity.entry);
  }
}
```

---

## Shared (`src/bounded-context/shared/`)

Shared types, constants and helpers across bounded contexts.

```
shared/
├── types/          # Shared TypeScript types
├── events/         # Global events
├── constants/     # Application constants
├── helpers/        # Utility functions
└── index.ts        # Barrel exports
```

**Note:** Types in shared are domain contracts, not entities. Entities go in `domain/entities/`.

---

## Organization Rules

1. **Domain is the center:** No outward dependencies (only on ports)
2. **Ports in domain:** Interfaces live in domain, implementations in infrastructure
3. **Patterns/parsers/validators are NOT domain:** Implementation details → go in `infrastructure/`
4. **Entities vs DB Entities:**
   - Domain entity (`domain/entities/`): pure business logic, no external dependencies
   - Infrastructure entity (`infrastructure/persistence/`): TypeORM/SQLite annotations
5. **CQRS in application:** Commands and queries as use cases
6. **Tests near code:** `__tests__/` next to the file they test
7. **CQRS naming:** `application/commands/save-trade/{command.ts,handler.ts}`

---

## Suggested Final Structure

```
src/
├── bounded-context/
│   ├── domain/
│   │   ├── entities/
│   │   ├── services/
│   │   ├── ports/
│   │   ├── value-objects/
│   │   └── events/
│   ├── application/
│   │   ├── commands/
│   │   ├── queries/
│   │   └── event-handlers/
│   ├── infrastructure/
│   │   ├── adapters/
│   │   └── persistence/
│   └── shared/
│       ├── types/
│       ├── events/
│       ├── constants/
│       └── helpers/
└── config/
```

---

## Additional Notes

- **Not all folders are required in each BC**
- **Value objects** can live in shared if used across multiple BCs
- **Domain events** are defined in domain, handlers in application
- **Shared helpers** should be pure functions without side effects