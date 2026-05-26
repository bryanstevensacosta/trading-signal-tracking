import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradeEntity } from '@trade/repository/infrastructure/persistence/trade.entity';
import { SqliteTradeAdapter } from '@trade/repository/infrastructure/adapters/sqlite-trade.adapter';
import { TradeListFormatterService } from '@telegram/notification/trade-list/domain/services/trade-list-formatter.service';
import { TradeListCacheService } from '@telegram/notification/trade-list/domain/services/trade-list-cache.service';
import { OrderType, TradeStatus, TradeSide } from '@trade/shared';

describe('Telegram Notification Trade List (e2e)', () => {
  let adapter: SqliteTradeAdapter;
  let formatter: TradeListFormatterService;
  let cache: TradeListCacheService;

  beforeAll(async () => {
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
        TradeListFormatterService,
        TradeListCacheService,
      ],
    }).compile();

    adapter = module.get<SqliteTradeAdapter>(SqliteTradeAdapter);
    formatter = module.get<TradeListFormatterService>(TradeListFormatterService);
    cache = module.get<TradeListCacheService>(TradeListCacheService);
  });

  afterAll(async () => {
    jest.clearAllMocks();
  });

  describe('Trade List Notification Flow', () => {
    it('should create a trade', async () => {
      const result = await adapter.save({
        symbol: 'BTCUSDT',
        side: TradeSide.LONG,
        entry: 50000,
        sl: 49000,
        tps: [52000, 53000],
        sourceChat: 12345,
      });

      expect(result.id).toBeDefined();
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.status).toBe(TradeStatus.PENDING);
    });

    it('should update trade status to active', async () => {
      const trades = await adapter.findAll();
      const trade = trades[0];

      const updated = await adapter.update(trade.id, {
        status: TradeStatus.ACTIVE,
      });

      expect(updated!.status).toBe(TradeStatus.ACTIVE);
    });

    it('should query active trades', async () => {
      const activeTrades = await adapter.findActive();

      expect(activeTrades.length).toBeGreaterThan(0);
      expect(activeTrades.every((t) => t.status === TradeStatus.ACTIVE)).toBe(true);
    });

    it('should format trade list with active trades', () => {
      const formatted = formatter.format([{
        id: '1',
        symbol: 'BTCUSDT',
        side: TradeSide.LONG,
        orderType: OrderType.MARKET,
        entry: 50000,
        entryMax: null,
        entryExecutedPrice: null,
        entryExecutedAt: null,
        sl: 49000,
        tps: [52000],
        chartUrl: null,
        notes: null,
        status: TradeStatus.ACTIVE,
        sourceMessage: '',
        sourceChat: 12345,
        tpsHit: [],
        notificationMessageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        closedAt: null,
      }]);

      expect(formatted).toContain('TRADES');
      expect(formatted).toContain('BTCUSDT');
      expect(formatted).toContain('Active:');
    });

    it('should close a trade', async () => {
      const activeTrades = await adapter.findActive();
      const trade = activeTrades[0];

      const closed = await adapter.update(trade.id, {
        status: TradeStatus.CLOSED_WIN,
        closedAt: new Date(),
      });

      expect(closed!.status).toBe(TradeStatus.CLOSED_WIN);
    });

    it('should have no active trades after closing', async () => {
      const activeTrades = await adapter.findActive();

      expect(activeTrades).toHaveLength(0);
    });

    it('should find all trades including closed', async () => {
      const allTrades = await adapter.findAll();

      expect(allTrades.length).toBeGreaterThan(0);
    });

    it('should cache trade list for chatId', async () => {
      const trades = await adapter.findAll();
      cache.set(12345, 100, trades);
      const cached = cache.get(12345);
      expect(cached).not.toBeNull();
      expect(cached!.chatId).toBe(12345);
      expect(cached!.messageId).toBe(100);
    });
  });
});