# Domain-Driven Design (DDD)

## Overview

DDD is a software design approach that focuses on modeling business domains through code. It emphasizes collaboration between technical and domain experts.

## Core Concepts

### 1. Entities

Entities are objects with a distinct identity that runs through time and different representations.

```typescript
// domain/entities/trade.entity.ts
@Entity()
export class Trade {
  @PrimaryGeneratedColumn('uuid')
  id: string; // Identity - not the data

  @Column()
  symbol: string;

  @Column()
  side: TradeSide;

  @Column('real')
  entry: number;

  // Identity check
  equals(other: Trade): boolean {
    return this.id === other.id;
  }
}
```

**Key Characteristics:**
- Unique identity that persists over time
- Can change state/attributes while maintaining identity
- Equality based on ID, not attributes

---

### 2. Value Objects

Value Objects are immutable objects without identity, defined by their attributes.

```typescript
// domain/value-objects/price.vo.ts
export class Price {
  constructor(
    public readonly symbol: string,
    public readonly bid: number,
    public readonly ask: number,
    public readonly timestamp: Date
  ) {
    Object.freeze(this); // Immutable
  }

  // Value equality - no identity
  equals(other: Price): boolean {
    return (
      this.symbol === other.symbol &&
      this.bid === other.bid &&
      this.ask === other.ask
    );
  }
}
```

**Key Characteristics:**
- No identity
- Immutable
- Equality based on all attributes
- No side effects

---

### 3. Domain Services

Domain Services contain domain logic that doesn't naturally fit in entities or value objects.

```typescript
// domain/services/state-machine.service.ts
@Injectable()
export class StateMachineService {
  canTransition(trade: Trade, targetStatus: TradeStatus): boolean {
    return VALID_TRANSITIONS[trade.status]?.includes(targetStatus) ?? false;
  }

  transition(trade: Trade, targetStatus: TradeStatus): TransitionResult {
    if (!this.canTransition(trade, targetStatus)) {
      return { success: false, error: 'Invalid transition' };
    }
    // Domain logic here
    return { success: true };
  }
}
```

**Key Characteristics:**
- Stateless (or stateful within domain)
- Contains business rules
- No external dependencies

---

### 4. Domain Events

Events represent something that happened in the domain.

```typescript
// domain/events/trade.events.ts
export interface TradeCreatedEvent {
  trade: Trade;
  timestamp: Date;
}

export interface StateChangedEvent {
  trade: Trade;
  oldStatus: TradeStatus;
  newStatus: TradeStatus;
  reason: string;
}
```

**Key Characteristics:**
- Immutable
- Represent past events
- Can trigger reactions

---

### 5. Ports (Interfaces)

Ports define contracts between domain and infrastructure.

```typescript
// domain/ports/trade-repository.port.ts
export interface TradeRepositoryPort {
  save(input: CreateTradeInput): Promise<Trade>;
  findById(id: string): Promise<Trade | null>;
  findAll(): Promise<Trade[]>;
  findActive(): Promise<Trade[]>;
  update(id: string, input: UpdateTradeInput): Promise<Trade | null>;
  delete(id: string): Promise<boolean>;
}
```

**Key Characteristics:**
- Belong to domain layer
- Define interfaces, not implementations
- Infrastructure implements ports

---

## DDD in Our Project

```
src/trade/
├── domain/
│   ├── entities/          # Trade entity
│   ├── value-objects/    # Price, etc.
│   ├── services/         # StateMachineService
│   ├── events/          # TradeCreatedEvent, etc.
│   └── ports/           # TradeRepositoryPort
├── application/
│   ├── commands/        # CQRS commands + handlers
│   └── queries/         # CQRS queries + handlers
└── infrastructure/
    └── adapters/        # SqliteTradeAdapter
```

## When to Use Each

| Concept | Use When |
|---------|----------|
| Entity | Object has identity, persists over time |
| Value Object | Object is defined by attributes, immutable |
| Domain Service | Business logic doesn't fit in entity |
| Domain Event | Something happened that others need to know |
| Port | Need to define contract for infrastructure |

## References

- Eric Evans - Domain-Driven Design
- Vaughn Vernon - Implementing Domain-Driven Design