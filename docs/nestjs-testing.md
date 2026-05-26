# NestJS Testing

NestJS provides comprehensive testing utilities with Jest integration.

## Setup

### Install Testing Dependencies

```bash
npm install --save-dev @nestjs/testing jest ts-jest @types/jest
```

### Jest Configuration

```javascript
// jest.config.js
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
```

## Unit Testing

### Testing a Service

```typescript
// trade-parsing.service.spec.ts
describe('TradeParsingService', () => {
  let service: TradeParsingService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [TradeParsingService],
    }).compile();

    service = module.get<TradeParsingService>(TradeParsingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('parse', () => {
    it('should parse valid LONG trade', () => {
      const input = `LONG BTCUSDT
Entry: 80000
SL: 70000
TP1: 95000`;

      const result = service.parse(input);

      expect(result.success).toBe(true);
      expect(result.data.symbol).toBe('BTCUSDT');
      expect(result.data.side).toBe('LONG');
      expect(result.data.entry).toBe(80000);
    });

    it('should parse compact format', () => {
      const result = service.parse('BTCUSDT 80000 70000 95000');

      expect(result.success).toBe(true);
      expect(result.data.symbol).toBe('BTCUSDT');
    });

    it('should reject invalid trade', () => {
      const result = service.parse('invalid message');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Missing symbol');
    });
  });
});
```

### Testing with Mocks

```typescript
// trade-repository.service.spec.ts
describe('TradeRepositoryService', () => {
  let service: TradeRepositoryService;
  let mockAdapter: jest.Mocked<SQLiteAdapter>;

  beforeEach(async () => {
    mockAdapter = {
      save: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      findActive: jest.fn(),
      delete: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        TradeRepositoryService,
        { provide: SQLiteAdapter, useValue: mockAdapter },
      ],
    }).compile();

    service = module.get<TradeRepositoryService>(TradeRepositoryService);
  });

  it('should create trade', async () => {
    const tradeData = { symbol: 'BTCUSDT', side: 'LONG' as const, entry: 80000 };
    mockAdapter.save.mockResolvedValue({ id: '1', ...tradeData });

    const result = await service.create(tradeData);

    expect(mockAdapter.save).toHaveBeenCalledWith(tradeData);
    expect(result.id).toBe('1');
  });
});
```

### Testing Command Handlers

```typescript
// create-trade.handler.spec.ts
describe('CreateTradeHandler', () => {
  let handler: CreateTradeHandler;
  let repository: jest.Mocked<TradeRepositoryService>;
  let eventBus: jest.Mocked<EventBus>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CreateTradeHandler,
        { provide: TradeRepositoryService, useValue: mockRepo },
        { provide: EventBus, useValue: mockEventBus },
      ],
    }).compile();

    handler = module.get<CreateTradeHandler>(CreateTradeHandler);
  });

  it('should create trade and publish event', async () => {
    const command = new CreateTradeCommand('BTCUSDT', 'LONG', 80000, 70000, [95000]);
    mockRepo.create.mockResolvedValue({ id: '1', ...trade });

    const result = await handler.execute(command);

    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.any(TradeCreatedEvent),
    );
  });
});
```

### Testing Guards

```typescript
// telegram-auth.guard.spec.ts
describe('TelegramAuthGuard', () => {
  let guard: TelegramAuthGuard;

  beforeEach(() => {
    guard = new TelegramAuthGuard();
  });

  it('should allow valid user', () => {
    const context = createMockExecutionContext({
      user: { id: '123' },
    });

    jest.spyOn(config, 'getAllowedUserId').mockReturnValue('123');

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny invalid user', () => {
    const context = createMockExecutionContext({
      user: { id: '456' },
    });

    jest.spyOn(config, 'getAllowedUserId').mockReturnValue('123');

    expect(guard.canActivate(context)).toBe(false);
  });
});
```

## E2E Testing

### Setup

```typescript
// test/app.e2e-spec.ts
describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/trades (GET)', () => {
    return request(app.getHttpServer())
      .get('/trades')
      .expect(200);
  });

  it('/trades (POST)', () => {
    return request(app.getHttpServer())
      .post('/trades')
      .send({ symbol: 'BTCUSDT', side: 'LONG', entry: 80000 })
      .expect(201);
  });
});
```

### Test Database

```typescript
// test/test.module.ts
@Module({
  imports: [TypeOrmModule.forRoot({
    type: 'better-sqlite3',
    database: ':memory:',
    entities: [Trade],
    synchronize: true,
  })],
})
export class TestModule {}
```

## Mocking Strategies

### Partial Mocks

```typescript
const mockService = {
  parse: jest.fn(),
  // Keep original implementation for other methods
  ...jest.requireActual(RealService),
};
```

### Spy on Methods

```typescript
jest.spyOn(service, 'parse').mockReturnValue({ success: true, data: {} });
```

### Mock Config

```typescript
jest.spyOn(config, 'getAllowedUserId').mockReturnValue('123');
```

## Coverage

### Run with Coverage

```bash
npm test -- --coverage
```

### Coverage Threshold

```javascript
// jest.config.js
module.exports = {
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

## Test Utilities

### createMockExecutionContext

```typescript
const context = createMockExecutionContext({
  body: { message: { text: '/start' } },
});
```

### createMockHttpArgumentsHost

```typescript
const ctx = createMockHttpArgumentsHost({
  headers: { 'x-telegram-bot-api-secret-token': 'secret' },
});
```

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
    ├── rr-calculation.unit.spec.ts
    └── rr-calculation.pbt.spec.ts

test/e2e/
└── trades.e2e.spec.ts
```

## Summary

| Test Type | Scope | Tool |
|-----------|-------|------|
| Unit | Service, Handler, Guard | Jest + Test.createTestingModule |
| Property-Based | Pure functions | fast-check |
| Integration | Multiple components | Jest + Test.createTestingModule + in-memory DB |
| E2E | Full HTTP flow | Jest + supertest |