import { SendTradeListHandler } from '../handler';
import { TradeDisplayService } from '../../../../domain/services/trade-display.service';
import { TradeListCacheService } from '../../../../domain/services/trade-list-cache.service';
import { SendTradeListCommand } from '../command';
import { Trade, TradeStatus, TradeSide, OrderType, Price } from '@trade/shared';

describe('SendTradeListHandler (unit)', () => {
  let handler: SendTradeListHandler;
  let cache: TradeListCacheService;
  let mockTelegram: {
    sendMessage: jest.Mock;
    editMessage: jest.Mock;
    deleteMessage: jest.Mock;
  };
  let mockRepository: {
    findActive: jest.Mock;
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
      findActive: jest.fn(),
    };

    mockPriceCache = {
      getBySymbols: jest.fn().mockReturnValue([]),
    };

    const displayService = new TradeDisplayService();
    cache = new TradeListCacheService();

    handler = new SendTradeListHandler(
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
    it('should send new message when no cached list exists', async () => {
      const trades = [createTrade(), createTrade({ symbol: 'ETHUSDT' })];
      mockRepository.findActive.mockResolvedValue(trades);

      const command = new SendTradeListCommand(12345);
      await handler.execute(command);

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(12345, expect.any(String), { parse_mode: 'HTML' }, 0);
      expect(cache.get(12345)).not.toBeNull();
      expect(cache.get(12345)!.messageId).toBe(100);
    });

    it('should send new message even when cache exists (always sends new message)', async () => {
      const trades = [createTrade()];
      mockRepository.findActive.mockResolvedValue(trades);
      cache.set(12345, 100, []);

      const command = new SendTradeListCommand(12345);
      await handler.execute(command);

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(12345, expect.any(String), { parse_mode: 'HTML' }, 0);
      expect(mockTelegram.editMessage).not.toHaveBeenCalled();
    });

    it('should fetch trades from repository', async () => {
      mockRepository.findActive.mockResolvedValue([]);

      const command = new SendTradeListCommand(12345);
      await handler.execute(command);

      expect(mockRepository.findActive).toHaveBeenCalled();
    });

    it('should fetch prices for trade symbols', async () => {
      const trades = [createTrade({ symbol: 'BTCUSDT' }), createTrade({ symbol: 'ETHUSDT' })];
      mockRepository.findActive.mockResolvedValue(trades);

      const mockPrices: Price[] = [
        { symbol: 'BTCUSDT', bid: 50000, ask: 50001, last: 50000.5, timestamp: new Date() },
        { symbol: 'ETHUSDT', bid: 3000, ask: 3001, last: 3000.5, timestamp: new Date() },
      ];
      mockPriceCache.getBySymbols.mockReturnValue(mockPrices);

      const command = new SendTradeListCommand(12345);
      await handler.execute(command);

      expect(mockPriceCache.getBySymbols).toHaveBeenCalledWith(['BTCUSDT', 'ETHUSDT']);
    });

    it('should update cache after sending message', async () => {
      const trades = [createTrade({ symbol: 'BTCUSDT' })];
      mockRepository.findActive.mockResolvedValue(trades);

      const command = new SendTradeListCommand(12345);
      await handler.execute(command);

      const cached = cache.get(12345);
      expect(cached!.trades).toHaveLength(1);
      expect(cached!.trades[0].symbol).toBe('BTCUSDT');
    });
  });
});