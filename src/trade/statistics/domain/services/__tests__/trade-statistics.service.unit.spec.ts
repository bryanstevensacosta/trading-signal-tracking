import { TradeStatisticsService } from '../trade-statistics.service';
import { TradeHistoryService } from '../../../../history/domain/services/trade-history.service';
import { Trade, TradeStatus, TradeSide } from '@trade/shared/types';

describe('TradeStatisticsService', () => {
  let mockHistoryService: jest.Mocked<TradeHistoryService>;
  let service: TradeStatisticsService;

  const createMockTrade = (overrides: Partial<Trade> = {}): Trade => ({
    id: 'trade-1',
    symbol: 'BTCUSDT',
    side: TradeSide.LONG,
    orderType: 'LIMIT' as any,
    entry: 50000,
    entryMax: null,
    entryExecutedPrice: 51000,
    entryExecutedAt: new Date(),
    sl: 49000,
    tps: [52000, 53000],
    chartUrl: null,
    notes: null,
    status: TradeStatus.CLOSED_WIN,
    sourceMessage: 'test',
    sourceChat: 123456,
    tpsHit: [0],
    tradeAlertsMessageId: null,
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

    service = new TradeStatisticsService(mockHistoryService);
  });

  describe('calculateStatistics', () => {
    it('should calculate win rate correctly', async () => {
      const trades = [
        createMockTrade({ id: '1', status: TradeStatus.CLOSED_WIN }),
        createMockTrade({ id: '2', status: TradeStatus.CLOSED_WIN }),
        createMockTrade({ id: '3', status: TradeStatus.CLOSED_LOSS }),
        createMockTrade({ id: '4', status: TradeStatus.CLOSED_LOSS }),
      ];

      const result = await service.calculateStatistics(trades);

      expect(result.winRate).toBe(0.5);
      expect(result.closedTrades).toBe(4);
    });

    it('should return zero win rate when no trades', async () => {
      const trades: Trade[] = [];

      const result = await service.calculateStatistics(trades);

      expect(result.winRate).toBe(0);
      expect(result.closedTrades).toBe(0);
    });

    it('should count trades by period', async () => {
      const now = new Date();
      const trades = [
        createMockTrade({ id: '1', createdAt: now }),
        createMockTrade({ id: '2', createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) }),
        createMockTrade({ id: '3', createdAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000) }),
        createMockTrade({ id: '4', createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) }),
      ];

      const result = await service.calculateStatistics(trades);

      expect(result.tradesThisWeek).toBe(2);
      expect(result.tradesThisMonth).toBe(3);
    });

    it('should aggregate wins and losses by symbol', async () => {
      const trades = [
        createMockTrade({ id: '1', symbol: 'BTCUSDT', status: TradeStatus.CLOSED_WIN }),
        createMockTrade({ id: '2', symbol: 'BTCUSDT', status: TradeStatus.CLOSED_LOSS }),
        createMockTrade({ id: '3', symbol: 'ETHUSDT', status: TradeStatus.CLOSED_WIN }),
        createMockTrade({ id: '4', symbol: 'ETHUSDT', status: TradeStatus.CLOSED_LOSS }),
        createMockTrade({ id: '5', symbol: 'ETHUSDT', status: TradeStatus.CLOSED_WIN }),
      ];

      const result = await service.calculateStatistics(trades);

      expect(result.winsBySymbol['BTCUSDT']).toBe(1);
      expect(result.lossesBySymbol['BTCUSDT']).toBe(1);
      expect(result.winsBySymbol['ETHUSDT']).toBe(2);
      expect(result.lossesBySymbol['ETHUSDT']).toBe(1);
    });

    it('should identify best and worst trades by RR', async () => {
      const trades = [
        createMockTrade({ id: '1', status: TradeStatus.CLOSED_WIN, entry: 50000, sl: 49000 }),
        createMockTrade({ id: '2', status: TradeStatus.CLOSED_WIN, entry: 50000, sl: 49000 }),
        createMockTrade({ id: '3', status: TradeStatus.CLOSED_LOSS, entry: 50000, sl: 49000 }),
      ];

      const result = await service.calculateStatistics(trades);

      expect(result.bestTrade).not.toBeNull();
      expect(result.worstTrade).not.toBeNull();
    });
  });

  describe('calculateRR', () => {
    it('should calculate RR for LONG trade', () => {
      const trade = createMockTrade({
        side: TradeSide.LONG,
        entry: 50000,
        sl: 49000,
        entryExecutedPrice: 51000,
      });

      const result = service.calculateRR(trade);

      expect(result).not.toBeNull();
      expect(result!.rr).toBeGreaterThan(0);
    });

    it('should calculate RR for SHORT trade', () => {
      const trade = createMockTrade({
        side: TradeSide.SHORT,
        entry: 50000,
        sl: 51000,
        entryExecutedPrice: 50000,
        tps: [49000, 48000],
        tpsHit: [0],
      });

      const result = service.calculateRR(trade);

      expect(result).not.toBeNull();
      expect(result!.rr).toBeGreaterThan(0);
    });

    it('should return null when no SL', () => {
      const trade = createMockTrade({ sl: null });

      const result = service.calculateRR(trade);

      expect(result).toBeNull();
    });

    it('should return null when entry is zero', () => {
      const trade = createMockTrade({ entry: 0 });

      const result = service.calculateRR(trade);

      expect(result).toBeNull();
    });
  });

  describe('calculateStatisticsFromHistory', () => {
    it('should fetch closed trades from history service', async () => {
      const mockTrades = [createMockTrade()];
      mockHistoryService.findClosedTrades.mockResolvedValue(mockTrades);

      await service.calculateStatisticsFromHistory();

      expect(mockHistoryService.findClosedTrades).toHaveBeenCalled();
    });

    it('should pass fetched trades to calculateStatistics', async () => {
      const mockTrades = [createMockTrade({ id: 'fetched-trade' })];
      mockHistoryService.findClosedTrades.mockResolvedValue(mockTrades);

      const result = await service.calculateStatisticsFromHistory();

      expect(result.totalTrades).toBe(1);
    });
  });
});