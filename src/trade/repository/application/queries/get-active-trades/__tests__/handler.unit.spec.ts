import { GetActiveTradesHandler } from '../handler';
import { GetActiveTradesQuery } from '../query';
import { SqliteTradeAdapter } from '@trade/repository/infrastructure/adapters/sqlite-trade.adapter';
import { Trade, TradeStatus, TradeSide, OrderType } from '@trade/shared';

describe('GetActiveTradesHandler', () => {
  let mockRepository: jest.Mocked<SqliteTradeAdapter>;

  const mockTrades: Trade[] = [
    {
      id: 'trade-1',
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
      status: TradeStatus.ACTIVE,
      sourceMessage: 'test1',
      sourceChat: 123456,
      tpsHit: [],
      tradeAlertsMessageId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      closedAt: null,
    },
    {
      id: 'trade-2',
      symbol: 'ETHUSDT',
      side: TradeSide.SHORT,
      orderType: OrderType.LIMIT,
      entry: 3000,
      entryMax: null,
      entryExecutedPrice: null,
      entryExecutedAt: null,
      sl: 3100,
      tps: [2900],
      chartUrl: null,
      notes: null,
      status: TradeStatus.PENDING,
      sourceMessage: 'test2',
      sourceChat: 789012,
      tpsHit: [],
      tradeAlertsMessageId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      closedAt: null,
    },
  ];

  beforeEach(() => {
    mockRepository = {
      repository: {} as any,
      save: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      findActive: jest.fn(),
      findPending: jest.fn(),
      findByStatus: jest.fn(),
      findBySymbol: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<SqliteTradeAdapter>;
  });

describe('execute', () => {
    it('should call repository.findActive with no arguments', async () => {
      mockRepository.findActive.mockResolvedValue(mockTrades);
      const handler = new GetActiveTradesHandler(mockRepository);

      await handler.execute();

      expect(mockRepository.findActive).toHaveBeenCalledWith();
    });

    it('should return array of active trades', async () => {
      mockRepository.findActive.mockResolvedValue(mockTrades);
      const handler = new GetActiveTradesHandler(mockRepository);

      const result = await handler.execute();

      expect(result).toEqual(mockTrades);
    });

    it('should return empty array when no active trades', async () => {
      mockRepository.findActive.mockResolvedValue([]);
      const handler = new GetActiveTradesHandler(mockRepository);

      const result = await handler.execute();

      expect(result).toEqual([]);
    });

    it('should pass through repository errors', async () => {
      const error = new Error('Database error');
      mockRepository.findActive.mockRejectedValue(error);
      const handler = new GetActiveTradesHandler(mockRepository);

      await expect(handler.execute()).rejects.toThrow('Database error');
    });

    it('should handle large number of trades', async () => {
      const manyTrades = Array.from({ length: 100 }, (_, i) => ({
        ...mockTrades[0],
        id: `trade-${i}`,
      }));
      mockRepository.findActive.mockResolvedValue(manyTrades);
      const handler = new GetActiveTradesHandler(mockRepository);

      const result = await handler.execute();

      expect(result).toHaveLength(100);
    });
  });

});