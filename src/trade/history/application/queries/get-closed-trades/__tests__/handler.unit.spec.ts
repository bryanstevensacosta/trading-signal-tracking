import { GetClosedTradesHandler } from '../handler';
import { GetClosedTradesQuery } from '../query';
import { TradeHistoryService } from '../../../../domain/services/trade-history.service';
import { Trade, TradeStatus, TradeSide } from '@trade/shared';

describe('GetClosedTradesHandler', () => {
  let mockHistoryService: jest.Mocked<TradeHistoryService>;

  const createMockTrade = (overrides: Partial<Trade> = {}): Trade => ({
    id: 'trade-1',
    symbol: 'BTCUSDT',
    side: TradeSide.LONG,
    orderType: 'LIMIT' as any,
    entry: 50000,
    entryMax: null,
    entryExecutedPrice: null,
    entryExecutedAt: null,
    sl: 49000,
    tps: [52000],
    chartUrl: null,
    notes: null,
    status: TradeStatus.CLOSED_WIN,
    sourceMessage: 'test',
    sourceChat: 123456,
    tpsHit: [],
    notificationMessageId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    mockHistoryService = {
      findClosedTrades: jest.fn(),
      getTradeById: jest.fn(),
      getClosedTradesCount: jest.fn(),
      getClosedTradesBySymbols: jest.fn(),
      getRecentClosedTrades: jest.fn(),
      getClosedTradesByDateRange: jest.fn(),
    } as unknown as jest.Mocked<TradeHistoryService>;
  });

  describe('execute', () => {
    it('should return trades and total count', async () => {
      const mockTrades = [createMockTrade(), createMockTrade({ id: 'trade-2' })];
      mockHistoryService.findClosedTrades.mockResolvedValue(mockTrades);
      mockHistoryService.getClosedTradesCount.mockResolvedValue(2);

      const handler = new GetClosedTradesHandler(mockHistoryService);
      const query = new GetClosedTradesQuery({ limit: 10 });

      const result = await handler.execute(query);

      expect(result.trades).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should call historyService.findClosedTrades with filters', async () => {
      const mockTrades = [createMockTrade()];
      mockHistoryService.findClosedTrades.mockResolvedValue(mockTrades);
      mockHistoryService.getClosedTradesCount.mockResolvedValue(1);

      const handler = new GetClosedTradesHandler(mockHistoryService);
      const filters = { symbols: ['BTCUSDT'], limit: 5 };
      const query = new GetClosedTradesQuery(filters);

      await handler.execute(query);

      expect(mockHistoryService.findClosedTrades).toHaveBeenCalledWith(filters);
    });

    it('should return empty when no closed trades', async () => {
      mockHistoryService.findClosedTrades.mockResolvedValue([]);
      mockHistoryService.getClosedTradesCount.mockResolvedValue(0);

      const handler = new GetClosedTradesHandler(mockHistoryService);
      const query = new GetClosedTradesQuery();

      const result = await handler.execute(query);

      expect(result.trades).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should handle includeStats flag', async () => {
      const mockTrades = [createMockTrade()];
      mockHistoryService.findClosedTrades.mockResolvedValue(mockTrades);
      mockHistoryService.getClosedTradesCount.mockResolvedValue(1);

      const handler = new GetClosedTradesHandler(mockHistoryService);
      const query = new GetClosedTradesQuery({}, true);

      const result = await handler.execute(query);

      expect(result.trades).toHaveLength(1);
    });
  });
});