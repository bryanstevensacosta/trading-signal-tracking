import { SaveTradeHandler } from '../handler';
import { SaveTradeCommand } from '../command';
import { SqliteTradeAdapter } from '@trade/repository/infrastructure/adapters/sqlite-trade.adapter';
import { CreateTradeInput, Trade, TradeStatus, TradeSide, OrderType } from '@trade/shared';

describe('SaveTradeHandler', () => {
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
    sourceMessage: 'LONG BTCUSDT Entry: 50000 SL: 49000 TP: 52000',
    sourceChat: 123456,
    tpsHit: [],
    notificationMessageId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
  };

  const mockInput: CreateTradeInput = {
    symbol: 'BTCUSDT',
    side: TradeSide.LONG,
    entry: 50000,
    entryMax: undefined,
    sl: 49000,
    tps: [52000],
    chartUrl: undefined,
    notes: undefined,
    sourceMessage: 'LONG BTCUSDT Entry: 50000 SL: 49000 TP: 52000',
    sourceChat: 123456,
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
    it('should call repository.save with command input', async () => {
      mockRepository.save.mockResolvedValue(mockTrade);
      const handler = new SaveTradeHandler(mockRepository);
      const command = new SaveTradeCommand(mockInput);

      await handler.execute(command);

      expect(mockRepository.save).toHaveBeenCalledWith(mockInput);
    });

    it('should return the saved trade', async () => {
      mockRepository.save.mockResolvedValue(mockTrade);
      const handler = new SaveTradeHandler(mockRepository);
      const command = new SaveTradeCommand(mockInput);

      const result = await handler.execute(command);

      expect(result).toBe(mockTrade);
    });

    it('should pass through repository errors', async () => {
      const error = new Error('Database error');
      mockRepository.save.mockRejectedValue(error);
      const handler = new SaveTradeHandler(mockRepository);
      const command = new SaveTradeCommand(mockInput);

      await expect(handler.execute(command)).rejects.toThrow('Database error');
    });

    it('should handle different input variations', async () => {
      const inputNoSL: CreateTradeInput = { ...mockInput, sl: undefined };
      const inputMultipleTPs: CreateTradeInput = { ...mockInput, tps: [51000, 52000, 53000] };

      mockRepository.save.mockResolvedValue(mockTrade);
      const handler = new SaveTradeHandler(mockRepository);

      await handler.execute(new SaveTradeCommand(inputNoSL));
      expect(mockRepository.save).toHaveBeenCalledWith(inputNoSL);

      await handler.execute(new SaveTradeCommand(inputMultipleTPs));
      expect(mockRepository.save).toHaveBeenCalledWith(inputMultipleTPs);
    });
  });
});