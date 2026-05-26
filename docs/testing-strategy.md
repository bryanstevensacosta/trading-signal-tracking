# Testing Strategy

## Overview

This document defines the comprehensive testing strategy for the crypto-signals project, focusing on **trade/shared** and **trade/repository** bounded contexts.

## Test Naming Convention

Tests are placed in `__tests__/` folders alongside the file being tested.

**Naming format**: `<file-name>.<type>.spec.ts`

| Type | Suffix | Description |
|------|--------|-------------|
| Unit | `.unit.spec.ts` | Pure functions, helpers, mappers |
| Property-Based | `.pbt.spec.ts` | fast-check property tests |
| Integration | `.integration.spec.ts` | Handlers, adapters, DB |
| E2E | `.e2e.spec.ts` | Full HTTP flow |

**Example**:
```
src/trade/shared/helpers/
├── rr-calculation.ts
└── __tests__/
    ├── rr-calculation.unit.spec.ts       # Jest unit test
    └── rr-calculation.pbt.spec.ts        # fast-check property test

src/trade/repository/infrastructure/adapters/
├── sqlite-trade.adapter.ts
└── __tests__/
    └── sqlite-trade.adapter.integration.spec.ts  # Integration test

test/e2e/
└── trades.e2e.spec.ts                    # HTTP e2e test
```

## Test Pyramid

```
        ╱╲
       ╱  ╲        E2E Tests (5%)
      ╱────╲       Full flow: HTTP + DB + Events
     ╱      ╲
    ╱════════╲    Integration Tests (25%)
   ╱          ╲   Module interaction, DB, CQRS
  ╱────────────╲
 ╱              ╲ Unit Tests (70%)
╱                ╲ Pure functions, helpers, services
────────────────────
```

## Testing Layers

### 1. Unit Tests (70% coverage target)

**Scope**: Pure functions, helpers, mappers, validators

**Files to test**:
```
src/trade/shared/
├── types/           → Interface validation
├── events/           → Event shape validation
├── constants/        → valid-transitions map
└── helpers/          → state-helpers, rr-calculation

src/trade/repository/
├── mapper/           → TradeMapper.toDomain/toEntity
├── domain/ports/     → Interface contracts
└── infrastructure/   → Adapter logic (mocked repo)
```

**Example**:
```typescript
// src/trade/shared/helpers/__tests__/rr-calculation.unit.spec.ts
import { calculateRR, calculateR, calculatePnL } from '../../rr-calculation';
import { TradeSide } from '../../types';

describe('calculateRR', () => {
  it('should calculate positive RR for LONG', () => {
    const rr = calculateRR(50000, 49000, 52000, TradeSide.LONG);
    expect(rr).toBe(2);
  });

  it('should calculate negative RR for SHORT', () => {
    const rr = calculateRR(50000, 51000, 49000, TradeSide.SHORT);
    expect(rr).toBe(-1);
  });

  it('should return 0 when SL equals entry', () => {
    const rr = calculateRR(50000, 50000, 52000, TradeSide.LONG);
    expect(rr).toBe(0);
  });
});

describe('calculateR', () => {
  it('should return absolute difference', () => {
    expect(calculateR(50000, 49000)).toBe(1000);
  });
});
```

### 2. Integration Tests (25% coverage target)

**Scope**: CQRS handlers, TypeORM with in-memory DB, module interaction

**Files to test**:
```
src/trade/repository/
├── application/
│   ├── commands/handlers/  → SaveTradeHandler, UpdateTradeHandler
│   └── queries/handlers/   → GetTradeByIdHandler, GetAllTradesHandler
└── infrastructure/adapters/  → SqliteTradeAdapter (real DB)
```

**Example**:
```typescript
// src/trade/repository/infrastructure/adapters/__tests__/integration.sqlite-trade.adapter.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SqliteTradeAdapter } from '../../sqlite-trade.adapter';
import { TradeEntity } from '../../../entity/trade.entity';
import { TradeStatus, TradeSide, CreateTradeInput } from '@trade/shared';

describe('SqliteTradeAdapter', () => {
  let adapter: SqliteTradeAdapter;
  let repository: Repository<TradeEntity>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [TradeEntity],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([TradeEntity]),
      ],
      providers: [SqliteTradeAdapter],
    }).compile();

    adapter = module.get<SqliteTradeAdapter>(SqliteTradeAdapter);
    repository = module.get<Repository<TradeEntity>>(getRepositoryToken(TradeEntity));
  });

  describe('save', () => {
    it('should save trade and return with id', async () => {
      const input: CreateTradeInput = {
        symbol: 'BTCUSDT',
        side: TradeSide.LONG,
        entry: 50000,
        sl: 49000,
        tps: [52000, 53000],
      };

      const result = await adapter.save(input);

      expect(result.id).toBeDefined();
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.status).toBe(TradeStatus.PENDING);
    });

    it('should uppercase symbol', async () => {
      const input: CreateTradeInput = {
        symbol: 'btcusdt',
        side: TradeSide.LONG,
        entry: 50000,
      };

      const result = await adapter.save(input);

      expect(result.symbol).toBe('BTCUSDT');
    });
  });

  describe('findAll', () => {
    it('should return all trades ordered by createdAt DESC', async () => {
      await adapter.save({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000 });
      await adapter.save({ symbol: 'ETHUSDT', side: TradeSide.SHORT, entry: 3000 });

      const trades = await adapter.findAll();

      expect(trades).toHaveLength(2);
      expect(trades[0].symbol).toBe('ETHUSDT'); // Most recent first
    });
  });

  describe('findActive', () => {
    it('should return only pending and active trades', async () => {
      const pending = await adapter.save({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000 });
      
      const activeTrades = await adapter.findActive();

      expect(activeTrades).toHaveLength(1);
      expect(activeTrades[0].status).toBe(TradeStatus.PENDING);
    });
  });
});
```

### 3. E2E Tests (5% coverage target)

**Scope**: Full HTTP endpoints, real DB

**Location**: `test/e2e/`

**Example**:
```typescript
// test/e2e/e2e.trades.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Trade Repository (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [TradeEntity],
          synchronize: true,
        }),
        AppModule,
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /trades', () => {
    it('should return empty array initially', () => {
      return request(app.getHttpServer())
        .get('/trades')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body).toHaveLength(0);
        });
    });
  });

  describe('POST /trades', () => {
    it('should create trade', () => {
      return request(app.getHttpServer())
        .post('/trades')
        .send({
          symbol: 'BTCUSDT',
          side: 'LONG',
          entry: 50000,
          sl: 49000,
          tps: [52000, 53000],
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.id).toBeDefined();
          expect(res.body.symbol).toBe('BTCUSDT');
          expect(res.body.status).toBe('pending');
        });
    });

    it('should reject invalid trade', () => {
      return request(app.getHttpServer())
        .post('/trades')
        .send({
          symbol: 'INVALID',
        })
        .expect(400);
    });
  });
});
```

### 4. Property-Based Tests

**Scope**: Pure functions with random inputs

**Library**: fast-check

**Example**:
```typescript
// src/trade/shared/helpers/__tests__/pbt.rr-calculation.spec.ts
import { fc, test } from 'fast-check';
import { calculateRR, calculateR, calculatePnL } from '../../rr-calculation';
import { TradeSide } from '../../types';

describe('calculateRR (property-based)', () => {
  test('RR is always positive for LONG when TP > entry > SL', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1000, max: 100000 }),
        fc.float({ min: 1000, max: 100000 }),
        fc.float({ min: 1000, max: 100000 }),
        (entry, sl, tp) => {
          // Arrange: TP > entry > SL for LONG
          const validInput = tp > entry && entry > sl;
          if (!validInput) return true; // Skip invalid

          // Act
          const rr = calculateRR(entry, sl, tp, TradeSide.LONG);

          // Assert
          return rr >= 0;
        }
      ),
      { numRuns: 1000 }
    );
  });

  test('RR is always negative for SHORT when SL > entry > TP', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1000, max: 100000 }),
        fc.float({ min: 1000, max: 100000 }),
        fc.float({ min: 1000, max: 100000 }),
        (entry, sl, tp) => {
          // Arrange: SL > entry > TP for SHORT
          const validInput = sl > entry && entry > tp;
          if (!validInput) return true;

          // Act
          const rr = calculateRR(entry, sl, tp, TradeSide.SHORT);

          // Assert
          return rr <= 0;
        }
      ),
      { numRuns: 1000 }
    );
  });

  test('RR magnitude equals (TP-entry)/(entry-SL)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1000, max: 100000 }),
        fc.float({ min: 1000, max: 100000 }),
        fc.float({ min: 1000, max: 100000 }),
        (entry, sl, tp) => {
          const r = calculateR(entry, sl);
          if (r === 0) return true; // Skip divide by zero

          const rr = calculateRR(entry, sl, tp, TradeSide.LONG);
          const expected = Math.abs(tp - entry) / r;

          return Math.abs(rr - expected) < 0.0001;
        }
      ),
      { numRuns: 1000 }
    );
  });

  test('calculatePnL is positive for LONG when close > entry', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1000, max: 100000 }),
        fc.float({ min: 1000, max: 100000 }),
        (entry, closePrice) => {
          if (closePrice <= entry) return true;
          const pnl = calculatePnL(entry, closePrice, TradeSide.LONG);
          return pnl > 0;
        }
      ),
      { numRuns: 500 }
    );
  });
});
```

## Test Organization

```
src/
├── trade/
│   ├── shared/
│   │   ├── helpers/
│   │   │   ├── rr-calculation.ts
│   │   │   └── __tests__/
│   │   │       ├── unit.rr-calculation.spec.ts
│   │   │       └── pbt.rr-calculation.spec.ts
│   │   ├── constants/
│   │   │   ├── valid-transitions.ts
│   │   │   └── __tests__/
│   │   │       └── unit.valid-transitions.spec.ts
│   │   ├── types/
│   │   │   ├── trade-status.ts
│   │   │   └── __tests__/
│   │   │       └── unit.trade-status.spec.ts
│   │   └── mapper/
│   │       ├── trade.mapper.ts
│   │       └── __tests__/
│   │           └── unit.trade-mapper.spec.ts
│   └── repository/
│       ├── domain/
│       │   └── ports/
│       │       ├── trade-repository.port.ts
│       │       └── __tests__/
│       │           └── unit.trade-repository.port.spec.ts
│       ├── infrastructure/
│       │   └── adapters/
│       │       ├── sqlite-trade.adapter.ts
│       │       └── __tests__/
│       │           └── integration.sqlite-trade.adapter.spec.ts
│       └── application/
│           └── commands/
│               └── handlers/
│                   ├── save-trade.handler.ts
│                   └── __tests__/
│                       └── integration.save-trade.handler.spec.ts
│           └── queries/
│               └── handlers/
│                   ├── get-all-trades.handler.ts
│                   └── __tests__/
│                       └── integration.get-all-trades.handler.spec.ts

test/
└── e2e/
    └── e2e.trades.spec.ts
```

## Jest Configuration

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testMatch: ['**/__tests__/**/*.spec.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@trade/shared(|/.*)$': '<rootDir>/trade/shared/$1',
    '^@trade/repository(|/.*)$': '<rootDir>/trade/repository/$1',
  },
  collectCoverageFrom: [
    'trade/shared/**/*.ts',
    'trade/repository/**/*.ts',
    '!trade/**/*module.ts',
  ],
  coverageDirectory: '../coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  verbose: true,
  testTimeout: 10000,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
```

## NPM Dependencies

```bash
npm install --save-dev fast-check @types/fast-check
npm install --save-dev @nestjs/testing supertest
```

## Package.json Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:unit": "jest --testPathPattern=unit.spec.ts",
    "test:pbt": "jest --testPathPattern=pbt.spec.ts",
    "test:integration": "jest --testPathPattern=integration.spec.ts",
    "test:e2e": "jest --testPathPattern=e2e.spec.ts --config ./jest-e2e.config.js",
    "test:all": "jest && npm run test:e2e",
    "lint": "eslint \"{src,test}/**/*.ts\" --fix"
  }
}
```

## Running Tests

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests in src/ |
| `npm run test:watch` | Watch mode |
| `npm run test:cov` | Run with coverage |
| `npm run test:unit` | Unit tests only |
| `npm run test:pbt` | Property-based tests only |
| `npm run test:integration` | Integration tests only |
| `npm run test:e2e` | E2E tests only |

## Coverage Targets

| Layer | Target | Files |
|-------|--------|-------|
| Unit | 80% | helpers, constants, mappers |
| Integration | 70% | handlers, adapters |
| E2E | 50% | HTTP endpoints |

## Test Execution Order (CI)

```yaml
# .github/workflows/test.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:unit
      - run: npm run test:pbt
      - run: npm run test:integration
      - run: npm run test:e2e
      - run: npm run test:cov
```

## Next Steps

1. Install testing dependencies
2. Configure Jest
3. Write unit tests for `trade/shared/helpers`
4. Write unit tests for `trade/shared/constants`
5. Write property-based tests for `rr-calculation`
6. Write integration tests for `SqliteTradeAdapter`
7. Write integration tests for handlers
8. Write e2e tests for HTTP endpoints