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

  describe('property-based: win rate bounds', () => {
    it('win rate should always be between 0 and 1', async () => {
      const allWins = [
        createMockTrade({ id: '1', status: TradeStatus.CLOSED_WIN }),
        createMockTrade({ id: '2', status: TradeStatus.CLOSED_WIN }),
      ];
      expect((await service.calculateStatistics(allWins)).winRate).toBe(1);

      const allLosses = [
        createMockTrade({ id: '3', status: TradeStatus.CLOSED_LOSS }),
        createMockTrade({ id: '4', status: TradeStatus.CLOSED_LOSS }),
      ];
      expect((await service.calculateStatistics(allLosses)).winRate).toBe(0);

      const mixed = [
        createMockTrade({ id: '5', status: TradeStatus.CLOSED_WIN }),
        createMockTrade({ id: '6', status: TradeStatus.CLOSED_LOSS }),
      ];
      expect((await service.calculateStatistics(mixed)).winRate).toBe(0.5);
    });

    it('win rate with no closed trades should be 0', async () => {
      const result = await service.calculateStatistics([]);
      expect(result.winRate).toBe(0);
    });
  });

  describe('property-based: closed trades count', () => {
    it('closedTrades should equal input length for closed trades', async () => {
      const trades = [
        createMockTrade({ id: '1', status: TradeStatus.CLOSED_WIN }),
        createMockTrade({ id: '2', status: TradeStatus.CLOSED_LOSS }),
        createMockTrade({ id: '3', status: TradeStatus.CLOSED_PARTIAL }),
      ];

      const result = await service.calculateStatistics(trades);

      expect(result.closedTrades).toBe(3);
      expect(result.totalTrades).toBe(3);
    });

    it('cancelled trades should be included as closed', async () => {
      const trades = [
        createMockTrade({ id: '1', status: TradeStatus.CANCELLED }),
        createMockTrade({ id: '2', status: TradeStatus.CLOSED_WIN }),
      ];

      const result = await service.calculateStatistics(trades);

      expect(result.closedTrades).toBe(2);
    });
  });

  describe('property-based: trades by period', () => {
    it('tradesThisWeek + tradesThisMonth + tradesThisYear should be monotonic', async () => {
      const now = new Date();
      const trades = [
        createMockTrade({ id: '1', createdAt: now }),
        createMockTrade({ id: '2', createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) }),
        createMockTrade({ id: '3', createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) }),
        createMockTrade({ id: '4', createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) }),
        createMockTrade({ id: '5', createdAt: new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000) }),
      ];

      const result = await service.calculateStatistics(trades);

      expect(result.tradesThisWeek).toBeLessThanOrEqual(result.tradesThisMonth);
      expect(result.tradesThisMonth).toBeLessThanOrEqual(result.tradesThisYear);
    });
  });

  describe('property-based: best/worst trade invariants', () => {
    it('bestTrade rr should be >= worstTrade rr when both exist', async () => {
      const trades = [
        createMockTrade({ id: '1', status: TradeStatus.CLOSED_WIN, entry: 50000, sl: 49000 }),
        createMockTrade({ id: '2', status: TradeStatus.CLOSED_LOSS, entry: 50000, sl: 49000 }),
        createMockTrade({ id: '3', status: TradeStatus.CLOSED_PARTIAL, entry: 50000, sl: 49000 }),
      ];

      const result = await service.calculateStatistics(trades);

      if (result.bestTrade && result.worstTrade) {
        expect(result.bestTrade.rr).toBeGreaterThanOrEqual(result.worstTrade.rr);
      }
    });

    it('bestTrade should be null when no trades', async () => {
      const result = await service.calculateStatistics([]);
      expect(result.bestTrade).toBeNull();
      expect(result.worstTrade).toBeNull();
    });
  });

  describe('property-based: RR calculation invariants', () => {
    it('calculateRR should return null when SL equals entry', () => {
      const trade = createMockTrade({ entry: 50000, sl: 50000, entryExecutedPrice: null });
      const result = service.calculateRR(trade);
      expect(result).toBeNull();
    });

    it('calculateRR should return null when risk is zero', () => {
      const trade = createMockTrade({ entry: 50000, sl: 50000, entryExecutedPrice: 50000 });
      const result = service.calculateRR(trade);
      expect(result).toBeNull();
    });

    it('calculateRR result should always have non-negative pnl for winning trades', () => {
      const winningTrade = createMockTrade({
        side: TradeSide.LONG,
        entry: 50000,
        sl: 49000,
        entryExecutedPrice: 51000,
      });

      const result = service.calculateRR(winningTrade);
      expect(result).not.toBeNull();
      expect(result!.pnl).toBeGreaterThan(0);
    });
  });

  describe('property-based: symbol aggregation', () => {
    it('winsBySymbol + lossesBySymbol should equal closed trades', async () => {
      const trades = [
        createMockTrade({ id: '1', symbol: 'BTCUSDT', status: TradeStatus.CLOSED_WIN }),
        createMockTrade({ id: '2', symbol: 'BTCUSDT', status: TradeStatus.CLOSED_LOSS }),
        createMockTrade({ id: '3', symbol: 'ETHUSDT', status: TradeStatus.CLOSED_WIN }),
      ];

      const result = await service.calculateStatistics(trades);

      const totalWins = Object.values(result.winsBySymbol).reduce((a, b) => a + b, 0);
      const totalLosses = Object.values(result.lossesBySymbol).reduce((a, b) => a + b, 0);
      expect(totalWins + totalLosses).toBe(result.closedTrades);
    });
  });
});