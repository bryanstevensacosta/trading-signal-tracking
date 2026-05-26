# SOLID Principles

## Overview

SOLID is a set of five design principles for writing maintainable and flexible code.

| Principle | Description |
|-----------|-------------|
| **S**ingle Responsibility | One class, one reason to change |
| **O**pen/Closed | Open for extension, closed for modification |
| **L**iskov Substitution | Subtypes must be substitutable for base types |
| **I**nterface Segregation | Many specific interfaces > one general interface |
| **D**ependency Inversion | Depend on abstractions, not concrete implementations |

---

## 1. Single Responsibility Principle (SRP)

A class should have only one reason to change.

```typescript
// ❌ Bad - Multiple responsibilities
class Trade {
  id: string;
  symbol: string;
  
  save(): void { /* DB logic */ }
  sendNotification(): void { /* Email logic */ }
  generateReport(): void { /* Report logic */ }
}

// ✅ Good - Separate responsibilities
class TradeEntity {
  id: string;
  symbol: string;
}

class TradeRepository {
  save(trade: TradeEntity): void { /* DB logic */ }
}

class TradeNotifier {
  notify(trade: TradeEntity): void { /* Email logic */ }
}

class TradeReporter {
  report(trades: TradeEntity[]): void { /* Report logic */ }
```

**Our implementation:**
- `TradeEntity` - only data
- `TradeRepositoryPort` - persistence contract
- `SqliteTradeAdapter` - one implementation

---

## 2. Open/Closed Principle (OCP)

Software entities should be open for extension but closed for modification.

```typescript
// ❌ Bad - Need to modify to add new exchange
class PriceService {
  getPrice(symbol: string, exchange: string): Price {
    if (exchange === 'binance') {
      // ...
    } else if (exchange === 'bybit') {
      // ...
    }
    throw new Error('Unknown exchange');
  }
}

// ✅ Good - Add new exchanges without modifying existing code
interface ExchangePort {
  getTicker(symbol: string): Promise<Price>;
  subscribe(symbol: string, callback: (price: Price) => void): void;
}

class BinanceAdapter implements ExchangePort { /* ... */ }
class BybitAdapter implements ExchangePort { /* ... */ }
```

**Our implementation:**
- `ExchangePort` - open for new exchanges
- `BinanceExchangeAdapter`, `BybitExchangeAdapter` - closed for modification

---

## 3. Liskov Substitution Principle (LSP)

Objects should be replaceable with subtypes without altering program correctness.

```typescript
// ❌ Bad - Subtype changes behavior unexpectedly
interface TradeRepositoryPort {
  findById(id: string): Promise<Trade | null>;
}

class FailingTradeAdapter implements TradeRepositoryPort {
  async findById(id: string): Promise<Trade | null> {
    throw new Error('Not implemented'); // Violates contract
  }
}

// ✅ Good - Subtypes honor the contract
class SqliteTradeAdapter implements TradeRepositoryPort {
  async findById(id: string): Promise<Trade | null> {
    return this.repository.findOne({ where: { id } });
  }
}
```

**Key Rules:**
- Preconditions cannot be strengthened
- Postconditions cannot be weakened
- Invariants must be maintained

---

## 4. Interface Segregation Principle (ISP)

Prefer many small, specific interfaces over one large general interface.

```typescript
// ❌ Bad - Fat interface
interface TradePort {
  save(trade: Trade): Promise<Trade>;
  findById(id: string): Promise<Trade | null>;
  findAll(): Promise<Trade[]>;
  subscribe(callback: (trade: Trade) => void): void;
  notify(user: string, message: string): void;
}

// ✅ Good - Segregated interfaces
interface TradeRepositoryPort {
  save(trade: Trade): Promise<Trade>;
  findById(id: string): Promise<Trade | null>;
  findAll(): Promise<Trade[]>;
}

interface TradeSubscriberPort {
  subscribe(callback: (trade: Trade) => void): void;
}

interface NotificationPort {
  notify(user: string, message: string): void;
}
```

**Our implementation:**
- `TradeRepositoryPort` - persistence only
- `ParserPort` - parsing only
- `ExchangePort` - exchange operations only

---

## 5. Dependency Inversion Principle (DIP)

High-level modules should not depend on low-level modules. Both should depend on abstractions.

```typescript
// ❌ Bad - High-level depends on low-level
class TradeEngine {
  private adapter = new SqliteTradeAdapter(); // Direct dependency
  
  async saveTrade(trade: Trade) {
    await this.adapter.save(trade);
  }
}

// ✅ Good - Depend on abstractions
class TradeEngine {
  constructor(private readonly repository: TradeRepositoryPort) {}
  
  async saveTrade(trade: Trade) {
    await this.repository.save(trade); // Depends on interface
  }
}
```

**Our implementation:**
```typescript
// Module configuration
@Module({
  providers: [
    { provide: TradeRepositoryPort, useClass: SqliteTradeAdapter }
  ]
})
export class TradeRepositoryModule {}
```

---

## Applying SOLID in Our Project

| Principle | How We Apply It |
|-----------|-----------------|
| SRP | `TradeRepositoryPort` only handles persistence, not notifications |
| OCP | New exchanges implement `ExchangePort`, no modification needed |
| LSP | All adapters honor port contracts exactly |
| ISP | Separate ports: `ParserPort`, `TradeRepositoryPort`, `ExchangePort` |
| DIP | Domain defines interfaces, infrastructure implements them |

---

## References

- Robert C. Martin - Design Principles and Design Patterns
- Robert C. Martin - Agile Software Development