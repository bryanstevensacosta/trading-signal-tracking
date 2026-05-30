import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { CommandBus, EventBus, QueryBus } from '@nestjs/cqrs';
import { TradeEntity } from '@trade/repository/infrastructure/persistence/trade.entity';
import { SqliteTradeAdapter } from '@trade/repository/infrastructure/adapters/sqlite-trade.adapter';
import { SendConfirmationHandler } from '@telegram/notification/trade-approval/application/commands/send-confirmation/handler';
import { ApproveTradeHandler } from '@telegram/notification/trade-approval/application/commands/approve-trade/handler';
import { CancelTradeHandler } from '@telegram/notification/trade-approval/application/commands/cancel-trade/handler';
import { EditTradeFieldHandler } from '@telegram/notification/trade-approval/application/commands/edit-trade-field/handler';
import { SendConfirmationCommand } from '@telegram/notification/trade-approval/application/commands/send-confirmation/command';
import { ApproveTradeCommand } from '@telegram/notification/trade-approval/application/commands/approve-trade/command';
import { CancelTradeConfirmationCommand } from '@telegram/notification/trade-approval/application/commands/cancel-trade/command';
import { EditTradeFieldCommand } from '@telegram/notification/trade-approval/application/commands/edit-trade-field/command';
import { TradeStatus, TradeSide, OrderType, ParsedTradeData } from '@trade/shared';

// eslint-disable-next-line jest/no-disabled-tests
describe.skip('Trade Confirmation (e2e)', () => {
  let commandBus: CommandBus;
  let queryBus: QueryBus;
  let tradeAdapter: SqliteTradeAdapter;
  let mockTelegram: { sendMessage: jest.Mock; editMessage: jest.Mock };

  const mockLogger = {
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockPriceCache = {
    getBySymbols: jest.fn().mockReturnValue([]),
  };

  beforeAll(async () => {
    mockTelegram = {
      sendMessage: jest.fn().mockResolvedValue(100),
      editMessage: jest.fn().mockResolvedValue(undefined),
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
        CqrsModule.forRoot(),
      ],
      providers: [
        SqliteTradeAdapter,
        {
          provide: 'TELEGRAM_PORT',
          useValue: mockTelegram,
        },
        {
          provide: 'LOGGER_PORT',
          useValue: mockLogger,
        },
        {
          provide: 'PRICE_CACHE_PORT',
          useValue: mockPriceCache,
        },
        {
          provide: 'TELEGRAM_PORT',
          useValue: mockTelegram,
        },
        {
          provide: 'BINANCE_INFO_PORT',
          useValue: {
            getTickerInfo: jest.fn().mockResolvedValue({
              price: 50000,
              change24hPercent: 5,
              volume: '1000',
              high: '51000',
              low: '49000',
            }),
          },
        },
        {
          provide: 'TRADE_REPOSITORY_PORT',
          useValue: null,
        },
        CommandBus,
        EventBus,
        QueryBus,
        SendConfirmationHandler,
        ApproveTradeHandler,
        CancelTradeHandler,
        EditTradeFieldHandler,
      ],
    }).compile();

    commandBus = module.get<CommandBus>(CommandBus);
    queryBus = module.get<QueryBus>(QueryBus);
    tradeAdapter = module.get<SqliteTradeAdapter>(SqliteTradeAdapter);
  });

  afterAll(async () => {
    jest.clearAllMocks();
  });

  describe('Full confirmation flow', () => {
    it('should save trade with PENDING status', async () => {
      const parsedTrade: ParsedTradeData = {
        symbol: 'BTCUSDT',
        side: TradeSide.LONG,
        orderType: OrderType.LIMIT,
        entry: 50000,
        entryMax: null,
        sl: 49000,
        tps: [52000],
        chartUrl: null,
        notes: null,
      };

      const command = new SendConfirmationCommand(parsedTrade, 123456, 'LONG BTCUSDT 50000 SL 49000 TP 52000');

      const tradeId = await commandBus.execute(command);

      const trade = await tradeAdapter.findById(tradeId as string);
      expect(trade).toBeDefined();
      expect(trade!.symbol).toBe('BTCUSDT');
      expect(trade!.status).toBe(TradeStatus.PENDING);
    });

    it('should update trade status to ACTIVE on approve', async () => {
      const pendingTrades = await tradeAdapter.findByStatus(TradeStatus.PENDING);
      const trade = pendingTrades[0];

      const approveCommand = new ApproveTradeCommand(trade.id, 123456);
      await commandBus.execute(approveCommand);

      const updatedTrade = await tradeAdapter.findById(trade.id);
      expect(updatedTrade!.status).toBe(TradeStatus.ACTIVE);
    });

    it('should find active trades after approval', async () => {
      const activeTrades = await tradeAdapter.findActive();
      expect(activeTrades.length).toBeGreaterThan(0);
    });

    it('should cancel trade and update status to CANCELLED', async () => {
      const parsedTrade: ParsedTradeData = {
        symbol: 'ETHUSDT',
        side: TradeSide.SHORT,
        orderType: OrderType.LIMIT,
        entry: 3000,
        entryMax: null,
        sl: 3100,
        tps: [2900],
        chartUrl: null,
        notes: null,
      };

      const command = new SendConfirmationCommand(parsedTrade, 123456, 'SHORT ETHUSDT 3000 SL 3100 TP 2900');
      const tradeId = await commandBus.execute(command);

      const cancelCommand = new CancelTradeConfirmationCommand(tradeId as string, 123456);
      await commandBus.execute(cancelCommand);

      const cancelledTrade = await tradeAdapter.findById(tradeId as string);
      expect(cancelledTrade!.status).toBe(TradeStatus.CANCELLED);
    });

    it('should edit trade field before approval', async () => {
      const parsedTrade: ParsedTradeData = {
        symbol: 'BNBUSDT',
        side: TradeSide.LONG,
        orderType: OrderType.LIMIT,
        entry: 300,
        entryMax: null,
        sl: 290,
        tps: [310],
        chartUrl: null,
        notes: null,
      };

      const command = new SendConfirmationCommand(parsedTrade, 123456, 'LONG BNBUSDT 300 SL 290 TP 310');
      const tradeId = await commandBus.execute(command);

      const editCommand = new EditTradeFieldCommand(tradeId as string, 'entry', '305', 123456);
      await commandBus.execute(editCommand);

      const editedTrade = await tradeAdapter.findById(tradeId as string);
      expect(editedTrade!.entry).toBe(305);
    });

    it('should cancel edited trade', async () => {
      const pendingTrades = await tradeAdapter.findByStatus(TradeStatus.PENDING);
      const trade = pendingTrades[pendingTrades.length - 1];

      const cancelCommand = new CancelTradeConfirmationCommand(trade.id, 123456);
      await commandBus.execute(cancelCommand);

      const cancelledTrade = await tradeAdapter.findById(trade.id);
      expect(cancelledTrade!.status).toBe(TradeStatus.CANCELLED);
    });
  });

  describe('Data persistence', () => {
    it('should persist all trade fields', async () => {
      const parsedTrade: ParsedTradeData = {
        symbol: 'ADAUSDT',
        side: TradeSide.SHORT,
        orderType: OrderType.MARKET,
        entry: 0.50,
        entryMax: 0.52,
        sl: 0.55,
        tps: [0.45, 0.40, 0.35],
        chartUrl: 'https://example.com/chart',
        notes: 'Test signal',
      };

      const command = new SendConfirmationCommand(parsedTrade, 999888, 'SHORT ADAUSDT 0.50 SL 0.55 TP 0.45 0.40 0.35');
      const tradeId = await commandBus.execute(command);

      const trade = await tradeAdapter.findById(tradeId as string);
      expect(trade!.symbol).toBe('ADAUSDT');
      expect(trade!.side).toBe(TradeSide.SHORT);
      expect(trade!.entry).toBe(0.50);
      expect(trade!.entryMax).toBe(0.52);
      expect(trade!.sl).toBe(0.55);
      expect(trade!.tps).toEqual([0.45, 0.40, 0.35]);
      expect(trade!.sourceChat).toBe(999888);
    });

    it('should find all trades including cancelled', async () => {
      const allTrades = await tradeAdapter.findAll();
      expect(allTrades.length).toBeGreaterThan(0);
    });
  });
});