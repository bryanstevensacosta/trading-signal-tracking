import { GetTradeByIdHandler } from '../handler';
import { GetTradeByIdQuery } from '../query';
import { SqliteTradeAdapter } from '@trade/repository/infrastructure/adapters/sqlite-trade.adapter';
import { Trade, TradeStatus, TradeSide, OrderType } from '@trade/shared';

describe('GetTradeByIdHandler', () => {
  let mockRepository: jest.Mocked<SqliteTradeAdapter>;

  const mockTrade: Trade = {
    id: 'test-id',
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
    sourceMessage: 'test',
    sourceChat: 123456,
    tpsHit: [],
    tradeAlertsMessageId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
  };

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
    it('should call repository.findById with query id', async () => {
      mockRepository.findById.mockResolvedValue(mockTrade);
      const handler = new GetTradeByIdHandler(mockRepository);
      const query = new GetTradeByIdQuery('test-id');

      await handler.execute(query);

      expect(mockRepository.findById).toHaveBeenCalledWith('test-id');
    });

    it('should return trade when found', async () => {
      mockRepository.findById.mockResolvedValue(mockTrade);
      const handler = new GetTradeByIdHandler(mockRepository);
      const query = new GetTradeByIdQuery('test-id');

      const result = await handler.execute(query);

      expect(result).toBe(mockTrade);
    });

    it('should return null when trade not found', async () => {
      mockRepository.findById.mockResolvedValue(null);
      const handler = new GetTradeByIdHandler(mockRepository);
      const query = new GetTradeByIdQuery('non-existent');

      const result = await handler.execute(query);

      expect(result).toBeNull();
    });

    it('should pass through repository errors', async () => {
      const error = new Error('Database error');
      mockRepository.findById.mockRejectedValue(error);
      const handler = new GetTradeByIdHandler(mockRepository);
      const query = new GetTradeByIdQuery('test-id');

      await expect(handler.execute(query)).rejects.toThrow('Database error');
    });

    it('should handle different id formats', async () => {
      mockRepository.findById.mockResolvedValue(null);
      const handler = new GetTradeByIdHandler(mockRepository);

      await handler.execute(new GetTradeByIdQuery('trade-uuid-123'));
      expect(mockRepository.findById).toHaveBeenCalledWith('trade-uuid-123');

      await handler.execute(new GetTradeByIdQuery('123e4567-e89b-12d3-a456-426614174000'));
      expect(mockRepository.findById).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
    });
  });
});