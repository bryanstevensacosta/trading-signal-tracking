import { GetAllTradesHandler } from '../handler';
import { GetAllTradesQuery } from '../query';
import { SqliteTradeAdapter } from '@trade/repository/infrastructure/adapters/sqlite-trade.adapter';
import { Trade, TradeStatus, TradeSide, OrderType } from '@trade/shared';

describe('GetAllTradesHandler', () => {
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
      notificationMessageId: null,
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
      status: TradeStatus.CLOSED_WIN,
      sourceMessage: 'test2',
      sourceChat: 789012,
      tpsHit: [0],
      notificationMessageId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      closedAt: new Date(),
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
    it('should call repository.findAll with no arguments', async () => {
      mockRepository.findAll.mockResolvedValue(mockTrades);
      const handler = new GetAllTradesHandler(mockRepository);

      await handler.execute();

      expect(mockRepository.findAll).toHaveBeenCalledWith();
    });

    it('should return all trades', async () => {
      mockRepository.findAll.mockResolvedValue(mockTrades);
      const handler = new GetAllTradesHandler(mockRepository);

      const result = await handler.execute();

      expect(result).toEqual(mockTrades);
    });

    it('should return empty array when no trades', async () => {
      mockRepository.findAll.mockResolvedValue([]);
      const handler = new GetAllTradesHandler(mockRepository);

      const result = await handler.execute();

      expect(result).toEqual([]);
    });

    it('should pass through repository errors', async () => {
      const error = new Error('Database error');
      mockRepository.findAll.mockRejectedValue(error);
      const handler = new GetAllTradesHandler(mockRepository);

      await expect(handler.execute()).rejects.toThrow('Database error');
    });

    it('should handle trades with various statuses', async () => {
      const variousStatusTrades = [
        { ...mockTrades[0], status: TradeStatus.PENDING },
        { ...mockTrades[0], status: TradeStatus.ACTIVE },
        { ...mockTrades[0], status: TradeStatus.PARTIAL_TP },
        { ...mockTrades[0], status: TradeStatus.CLOSED_WIN },
        { ...mockTrades[0], status: TradeStatus.CLOSED_LOSS },
      ] as Trade[];
      mockRepository.findAll.mockResolvedValue(variousStatusTrades);
      const handler = new GetAllTradesHandler(mockRepository);

      const result = await handler.execute();

      expect(result).toHaveLength(5);
    });
  });
});