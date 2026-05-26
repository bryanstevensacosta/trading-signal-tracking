import { UpdateTradeHandler } from '../handler';
import { UpdateTradeCommand } from '../command';
import { SqliteTradeAdapter } from '@trade/repository/infrastructure/adapters/sqlite-trade.adapter';
import { UpdateTradeInput, Trade, TradeStatus, TradeSide, OrderType } from '@trade/shared';

describe('UpdateTradeHandler', () => {
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
    status: TradeStatus.PENDING,
    sourceMessage: 'test',
    sourceChat: 123456,
    tpsHit: [],
    notificationMessageId: null,
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
    it('should call repository.update with id and input', async () => {
      const input: UpdateTradeInput = { sl: 48000 };
      mockRepository.update.mockResolvedValue({ ...mockTrade, sl: 48000 });
      const handler = new UpdateTradeHandler(mockRepository);
      const command = new UpdateTradeCommand('trade-123', input);

      await handler.execute(command);

      expect(mockRepository.update).toHaveBeenCalledWith('trade-123', input);
    });

    it('should return updated trade', async () => {
      const input: UpdateTradeInput = { entry: 51000 };
      const updatedTrade = { ...mockTrade, entry: 51000 };
      mockRepository.update.mockResolvedValue(updatedTrade);
      const handler = new UpdateTradeHandler(mockRepository);
      const command = new UpdateTradeCommand('trade-123', input);

      const result = await handler.execute(command);

      expect(result).toEqual(updatedTrade);
    });

    it('should return null when trade not found', async () => {
      const input: UpdateTradeInput = { sl: 48000 };
      mockRepository.update.mockResolvedValue(null);
      const handler = new UpdateTradeHandler(mockRepository);
      const command = new UpdateTradeCommand('non-existent', input);

      const result = await handler.execute(command);

      expect(result).toBeNull();
    });

    it('should pass through repository errors', async () => {
      const input: UpdateTradeInput = { sl: 48000 };
      const error = new Error('Database error');
      mockRepository.update.mockRejectedValue(error);
      const handler = new UpdateTradeHandler(mockRepository);
      const command = new UpdateTradeCommand('trade-123', input);

      await expect(handler.execute(command)).rejects.toThrow('Database error');
    });

    it('should handle multiple fields in input', async () => {
      const input: UpdateTradeInput = { entry: 51000, sl: 48000, tps: [52000, 53000] };
      mockRepository.update.mockResolvedValue({ ...mockTrade, ...input });
      const handler = new UpdateTradeHandler(mockRepository);
      const command = new UpdateTradeCommand('trade-123', input);

      await handler.execute(command);

      expect(mockRepository.update).toHaveBeenCalledWith('trade-123', input);
    });
  });
});