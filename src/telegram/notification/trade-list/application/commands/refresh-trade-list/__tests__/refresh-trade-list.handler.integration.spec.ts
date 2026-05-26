import { RefreshTradeListHandler } from '../handler';
import { TradeDisplayService } from '../../../../domain/services/trade-display.service';
import { TradeListCacheService } from '../../../../domain/services/trade-list-cache.service';
import { RefreshTradeListCommand } from '../command';
import { Trade, TradeStatus, TradeSide, OrderType, Price } from '@trade/shared';

describe('RefreshTradeListHandler (unit)', () => {
  let handler: RefreshTradeListHandler;
  let cache: TradeListCacheService;
  let mockTelegram: {
    sendMessage: jest.Mock;
    editMessage: jest.Mock;
    deleteMessage: jest.Mock;
  };
  let mockRepository: {
    findAll: jest.Mock;
  };
  let mockPriceCache: {
    getBySymbols: jest.Mock;
  };

  const createTrade = (overrides: Partial<Trade> = {}): Trade => ({
    id: '1',
    symbol: 'BTCUSDT',
    side: TradeSide.LONG,
    orderType: OrderType.LIMIT,
    entry: 50000,
    entryMax: null,
    entryExecutedPrice: null,
    entryExecutedAt: null,
    sl: 49000,
    tps: [52000],
    chartUrl: null,
    notes: null,
    status: TradeStatus.PENDING,
    sourceMessage: '',
    sourceChat: null,
    tpsHit: [],
    notificationMessageId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
    ...overrides,
  });

  beforeEach(() => {
    mockTelegram = {
      sendMessage: jest.fn().mockResolvedValue(100),
      editMessage: jest.fn().mockResolvedValue(undefined),
      deleteMessage: jest.fn().mockResolvedValue(undefined),
    };

    mockRepository = {
      findAll: jest.fn(),
    };

    mockPriceCache = {
      getBySymbols: jest.fn().mockReturnValue([]),
    };

    const displayService = new TradeDisplayService();
    cache = new TradeListCacheService();

    handler = new RefreshTradeListHandler(
      mockRepository as any,
      mockPriceCache as any,
      displayService,
      cache,
      mockTelegram as any
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should send new message when cache exists (always sends new message for notifications)', async () => {
      cache.set(12345, 100, []);
      const trades = [createTrade()];
      mockRepository.findAll.mockResolvedValue(trades);

      const command = new RefreshTradeListCommand(12345);
      await handler.execute(command);

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(12345, expect.any(String), undefined, expect.any(Number));
      expect(mockTelegram.editMessage).not.toHaveBeenCalled();
    });

    it('should send new message when no cache exists', async () => {
      const trades = [createTrade()];
      mockRepository.findAll.mockResolvedValue(trades);

      const command = new RefreshTradeListCommand(12345);
      await handler.execute(command);

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(12345, expect.any(String), undefined, expect.any(Number));
    });

    it('should fetch fresh trades from repository', async () => {
      mockRepository.findAll.mockResolvedValue([]);

      const command = new RefreshTradeListCommand(12345);
      await handler.execute(command);

      expect(mockRepository.findAll).toHaveBeenCalled();
    });

    it('should fetch prices for trade symbols', async () => {
      const trades = [createTrade({ symbol: 'BTCUSDT' }), createTrade({ symbol: 'ETHUSDT' })];
      mockRepository.findAll.mockResolvedValue(trades);

      const mockPrices: Price[] = [
        { symbol: 'BTCUSDT', bid: 50000, ask: 50001, last: 50000.5, timestamp: new Date() },
        { symbol: 'ETHUSDT', bid: 3000, ask: 3001, last: 3000.5, timestamp: new Date() },
      ];
      mockPriceCache.getBySymbols.mockReturnValue(mockPrices);

      const command = new RefreshTradeListCommand(12345);
      await handler.execute(command);

      expect(mockPriceCache.getBySymbols).toHaveBeenCalledWith(['BTCUSDT', 'ETHUSDT']);
    });

    it('should update cache with new message after sending', async () => {
      const oldTrades = [createTrade({ symbol: 'OLD' })];
      const newTrades = [createTrade({ symbol: 'NEW' })];
      cache.set(12345, 100, oldTrades);
      mockRepository.findAll.mockResolvedValue(newTrades);

      const command = new RefreshTradeListCommand(12345);
      await handler.execute(command);

      const cached = cache.get(12345);
      expect(cached!.trades[0].symbol).toBe('NEW');
    });
  });
});