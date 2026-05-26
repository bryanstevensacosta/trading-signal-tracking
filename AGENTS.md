# AGENTS.md - Architecture Reference

This document summarizes the project structure for AI agents.

## General Structure

```
src/
├── bounded-context/
│   ├── domain/           # Pure logic (entities, services, ports, value-objects, events)
│   ├── application/     # CQRS use cases (commands, queries, event-handlers)
│   ├── infrastructure/   # Implementations (adapters, persistence)
│   └── shared/           # Shared types, events, helpers
└── config/              # NestJS configuration
```

Each bounded context has its own DDD structure:

```
bounded-context/
├── domain/
│   ├── entities/        # Domain entities and aggregate roots (no external dependencies)
│   ├── services/        # Domain services
│   ├── ports/           # Interfaces (Hexagonal)
│   ├── value-objects/   # Value objects
│   └── events/          # Domain events
├── application/
│   ├── commands/        # CQRS commands
│   ├── queries/         # CQRS queries
│   └── event-handlers/  # Event handlers
├── infrastructure/
│   ├── adapters/        # Port implementations
│   └── persistence/     # Entities, mappers, repositories
└── shared/              # Shared types, constants, helpers
```

---

## Domain Layer (`domain/`)

### entities/
Domain entities with business logic. **No external dependencies**.

### services/
Domain services that encapsulate business rules transcending entities.

### ports/
Interfaces (contracts) following Hexagonal Architecture. Domain defines what it needs, infrastructure implements how.

### value-objects/
Immutable value objects without identity.

### events/
Domain events representing things that happened.

---

## Application Layer (`application/`)

### commands/`command-name`/
CQRS Command: `command.ts` + `handler.ts` + `dto.ts` (optional)

### queries/`query-name`/
CQRS Query: `query.ts` + `handler.ts` + `dto.ts` (optional)

### event-handlers/
Handlers for domain events.

---

## Infrastructure Layer (`infrastructure/`)

### adapters/
Port implementations (e.g., `RegexParserAdapter`, `SqliteTradeAdapter`)

### persistence/
TypeORM entities, mappers, DB-specific repositories.

---

## Shared (`shared/`)

### types/
Shared TypeScript types (not entities, only contracts)

### events/
Global or shared events

### constants/
Application constants

### helpers/
Pure utility functions

---

## File Conventions

| Type | Name | Location |
|------|--------|------------|
| Domain Entity | `trade.entity.ts` | `domain/entities/` |
| DB Entity | `trade.entity.ts` | `infrastructure/persistence/` |
| Mapper | `trade.mapper.ts` | `infrastructure/persistence/` |
| Port (interface) | `*.port.ts` | `domain/ports/` |
| Adapter (impl) | `*.adapter.ts` | `infrastructure/adapters/` |
| Command | `save-trade/command.ts` | `application/commands/save-trade/` |
| Handler | `save-trade/handler.ts` | `application/commands/save-trade/` |
| Patterns | `trade-patterns.ts` | `infrastructure/` (not in domain) |
| Validator | `trade-validator.ts` | `domain/services/` or `infrastructure/` |

---

## Key Rules

1. **Domain does not depend on infrastructure** - only on ports and interfaces
2. **Ports in domain, adapters in infrastructure** - dependency inversion
3. **Patterns/parsers/validators ≠ domain** - are implementation details
4. **Tests in `__tests__/`** next to the file they test
5. **CQRS naming**: `application/commands/save-trade/{command.ts,handler.ts}`
6. **JSDoc for documentation** - Document all public interfaces, classes, and functions with JSDoc comments

---

## JSDoc Documentation

All public APIs, interfaces, and complex functions should be documented with JSDoc:

```typescript
/**
 * Parses a trade message and extracts structured data.
 * 
 * @param message - Raw telegram message text
 * @returns ParseResult containing extracted fields and any errors
 * 
 * @example
 * const result = parser.parse('LONG BTCUSDT Entry: 50000 SL: 49000');
 * if (result.success) {
 *   console.log(result.symbol); // 'BTCUSDT'
 * }
 */
export interface ParserPort {
  parse(message: string): ParseResult;
}

/**
 * Converts a domain entity to its database representation.
 * 
 * @param entity - The TypeORM entity from the database
 * @returns Domain trade object
 * 
 * @throws Error if entity is invalid or missing required fields
 */
export function toDomain(entity: TradeEntity): Trade {
  // ...
}
```

**JSDoc locations:**
- Interface definitions (`*.port.ts`)
- Adapter implementations
- Domain services
- Command/Query handlers
- Utility functions used across modules

---

## Current Bounded Contexts

- **trade**: Trading context
  - `parsing/`: Parse Telegram messages
  - `repository/`: Persist trades
  - `shared/`: Types, events, shared helpers

---

## Project Documentation

Reference these documents for more details:

| Document | Description |
|-----------|-------------|
| `@docs/architecture.md` | General architecture and bounded contexts |
| `@docs/bounded-contexts.md` | Summary of each sub-context |
| `@docs/domain-driven-design.md` | DDD concepts (entities, value objects, services, events, ports) |
| `@docs/hexagonal-arch.md` | Hexagonal Architecture (Ports & Adapters) |
| `@docs/nestjs-components.md` | Guards, Pipes, Interceptors, Filters |
| `@docs/nestjs-cqrs.md` | Commands, Queries, Events, Aggregates |
| `@docs/nestjs-lifecycle.md` | Lifecycle hooks (onModuleInit, etc.) |
| `@docs/nestjs-modules.md` | Modules, Controllers, Providers, DI |
| `@docs/nestjs-testing.md` | Testing with NestJS |
| `@docs/nestjs-websocket.md` | WebSocket Gateway |
| `@docs/solid-principles.md` | SOLID Principles |
| `@docs/requirements.md` | Project requirements |
| `@docs/structure.md` | Detailed DDD + Hexagonal structure |
| `@docs/tech-stack-nestjs.md` | NestJS features |
| `@docs/tech-stack.md` | Tech stack |
| `@docs/testing-strategy.md` | Complete testing strategy |
| `@docs/testing-plan-parsing.md` | Test plan for trade/parsing module |

---

## Testing

- **Unit tests**: `*.unit.spec.ts` - pure functions, helpers, mappers
- **Property-based**: `*.pbt.spec.ts` - fast-check
- **Integration**: `*.integration.spec.ts` - handlers, adapters, DB
- **E2E**: `test/e2e/*.e2e.spec.ts` - full HTTP flow

Run tests:
- `npm run test:unit` - Unit tests
- `npm run test:integration` - Integration tests
- `npm run test:e2e` - E2E tests