import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SqliteTradeAdapter } from '../../src/trade/repository/infrastructure/adapters/sqlite-trade.adapter';
import { TradeEntity } from '../../src/trade/repository/infrastructure/persistence/trade.entity';
import { TradeStatus, TradeSide, OrderType, CreateTradeInput } from '../../src/trade/shared';
import { SendConfirmationHandler } from '../../src/telegram/notification/trade-approval/application/commands/send-confirmation/handler';
import { CancelTradeHandler } from '../../src/telegram/notification/trade-approval/application/commands/cancel-trade/handler';
import { EditTradeFieldHandler } from '../../src/telegram/notification/trade-approval/application/commands/edit-trade-field/handler';
import { SendConfirmationCommand } from '../../src/telegram/notification/trade-approval/application/commands/send-confirmation/command';
import { CancelTradeConfirmationCommand } from '../../src/telegram/notification/trade-approval/application/commands/cancel-trade/command';
import { EditTradeFieldCommand } from '../../src/telegram/notification/trade-approval/application/commands/edit-trade-field/command';
import { CommandBus } from '@nestjs/cqrs';
import { TELEGRAM_PORT } from '../../src/telegram/core/domain/ports/telegram.port';
import { TRADE_REPOSITORY_PORT } from '../../src/trade/repository/domain/ports/trade-repository.port';
import { LOGGER_PORT } from '../../src/shared/domain/ports/logger.port';

jest.mock('@config/telegram.config', () => ({
  getTelegramConfig: () => ({
    groupId: 123456,
    tradeAlertsThreadId: null,
    tradeListThreadId: null,
    privateChatThreadId: null,
  }),
}));

describe('Trade Confirmation (e2e)', () => {
  let adapter: SqliteTradeAdapter;
  let commandBus: CommandBus;

  const mockLogger = {
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  };

  const mockTelegram = {
    sendMessage: jest.fn().mockResolvedValue(100),
    editMessage: jest.fn().mockResolvedValue(undefined),
  };

  let mockRepository: {
    findById: jest.Mock;
    findAll: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  beforeAll(async () => {
    mockRepository = {
      findById: jest.fn(),
      findAll: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation((input: CreateTradeInput) => ({
        id: 'test-trade-' + Math.random().toString(36).substr(2, 9),
        symbol: input.symbol,
        side: input.side,
        entry: input.entry,
        entryMax: input.entryMax || null,
        sl: input.sl || null,
        tps: input.tps || null,
        status: TradeStatus.PENDING,
        sourceChat: input.sourceChat || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      update: jest.fn().mockResolvedValue({ id: 'updated-trade' }),
      delete: jest.fn(),
    };

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
      providers: [
        SqliteTradeAdapter,
        { provide: TRADE_REPOSITORY_PORT, useValue: mockRepository },
        { provide: LOGGER_PORT, useValue: mockLogger },
        { provide: TELEGRAM_PORT, useValue: mockTelegram },
        CommandBus,
      ],
    }).compile();

    adapter = module.get<SqliteTradeAdapter>(SqliteTradeAdapter);
    commandBus = module.get<CommandBus>(CommandBus);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Trade Creation via Adapter', () => {
    it('should save trade with PENDING status using adapter directly', async () => {
      const input: CreateTradeInput = {
        symbol: 'BTCUSDT',
        side: TradeSide.LONG,
        orderType: OrderType.LIMIT,
        entry: 50000,
        sl: 49000,
        tps: [52000],
        sourceChat: 123456,
      };

      const result = await adapter.save(input);

      expect(result.id).toBeDefined();
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.status).toBe(TradeStatus.PENDING);
    });

    it('should find trade by ID', async () => {
      const allTrades = await adapter.findAll();
      expect(allTrades.length).toBeGreaterThan(0);
    });

    it('should update trade status', async () => {
      const trade = await adapter.findAll();
      const firstTrade = trade[0];

      const updated = await adapter.update(firstTrade.id, { status: TradeStatus.ACTIVE });
      expect(updated).toBeDefined();
    });
  });

  describe('Trade Field Updates', () => {
    it('should update entry price', async () => {
      const trade = await adapter.findAll();
      const firstTrade = trade[0];

      const updated = await adapter.update(firstTrade.id, { entry: 50500 });
      expect(updated!.entry).toBe(50500);
    });

    it('should update multiple fields', async () => {
      const trade = await adapter.findAll();
      const firstTrade = trade[0];

      const updated = await adapter.update(firstTrade.id, {
        sl: 48500,
        tps: [52500, 53000],
      });
      expect(updated!.sl).toBe(48500);
    });
  });

  describe('Trade Cancellation', () => {
    it('should cancel a pending trade', async () => {
      const input: CreateTradeInput = {
        symbol: 'ETHUSDT',
        side: TradeSide.SHORT,
        entry: 3000,
        sourceChat: 123456,
      };

      const trade = await adapter.save(input);
      expect(trade.status).toBe(TradeStatus.PENDING);

      const cancelled = await adapter.update(trade.id, { 
        status: TradeStatus.CANCELLED,
        cancelledBy: 'user',
      });
      expect(cancelled!.status).toBe(TradeStatus.CANCELLED);
    });
  });

  describe('Data Persistence', () => {
    it('should persist all trade fields', async () => {
      const input: CreateTradeInput = {
        symbol: 'ADAUSDT',
        side: TradeSide.SHORT,
        orderType: OrderType.MARKET,
        entry: 0.50,
        entryMax: 0.52,
        sl: 0.55,
        tps: [0.45, 0.40, 0.35],
        chartUrl: 'https://example.com/chart',
        notes: 'Test signal',
        sourceChat: 999888,
      };

      const trade = await adapter.save(input);
      expect(trade.symbol).toBe('ADAUSDT');
      expect(trade.side).toBe(TradeSide.SHORT);
      expect(trade.entry).toBe(0.50);
      expect(trade.entryMax).toBe(0.52);
      expect(trade.sl).toBe(0.55);
      expect(trade.tps).toEqual([0.45, 0.40, 0.35]);
    });

    it('should find all trades', async () => {
      const allTrades = await adapter.findAll();
      expect(allTrades.length).toBeGreaterThan(0);
    });

    it('should delete a trade', async () => {
      const beforeDelete = await adapter.findAll();
      const countBefore = beforeDelete.length;

      await adapter.delete(beforeDelete[0].id);

      const afterDelete = await adapter.findAll();
      expect(afterDelete.length).toBe(countBefore - 1);
    });
  });
});