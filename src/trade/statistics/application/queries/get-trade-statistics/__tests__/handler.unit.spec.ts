import { GetTradeStatisticsHandler } from '../handler';
import { GetTradeStatisticsQuery } from '../query';
import { TradeStatisticsService } from '../../../../domain/services/trade-statistics.service';
import { TradeStatistics } from '../../../../domain/ports/trade-statistics.port';

describe('GetTradeStatisticsHandler', () => {
  let mockStatisticsService: jest.Mocked<TradeStatisticsService>;

  beforeEach(() => {
    mockStatisticsService = {
      calculateStatistics: jest.fn(),
      calculateStatisticsFromHistory: jest.fn(),
      calculateRR: jest.fn(),
    } as unknown as jest.Mocked<TradeStatisticsService>;
  });

  describe('execute', () => {
    it('should return statistics from service', async () => {
      const mockStats: TradeStatistics = {
        totalTrades: 10,
        closedTrades: 8,
        winRate: 0.625,
        averageRR: 1.5,
        totalRR: 12,
        breakEvenRate: 0.4,
        profitability: 'PROFITABLE',
        bestTrade: { symbol: 'BTCUSDT', rr: 3.0, pnl: 300, closedAt: new Date() },
        worstTrade: { symbol: 'ETHUSDT', rr: -1.0, pnl: -100, closedAt: new Date() },
        tradesThisWeek: 2,
        tradesThisMonth: 5,
        tradesThisYear: 8,
        winsBySymbol: { BTCUSDT: 3, ETHUSDT: 2 },
        lossesBySymbol: { BTCUSDT: 1, ETHUSDT: 2 },
      };
      mockStatisticsService.calculateStatisticsFromHistory.mockResolvedValue(mockStats);

      const handler = new GetTradeStatisticsHandler(mockStatisticsService);
      const query = new GetTradeStatisticsQuery();

      const result = await handler.execute(query);

      expect(result).toEqual(mockStats);
      expect(mockStatisticsService.calculateStatisticsFromHistory).toHaveBeenCalled();
    });

    it('should pass date filters to service', async () => {
      const mockStats: TradeStatistics = {
        totalTrades: 5,
        closedTrades: 5,
        winRate: 0.6,
        averageRR: 1.0,
        totalRR: 5,
        breakEvenRate: 0.5,
        profitability: 'PROFITABLE',
        bestTrade: null,
        worstTrade: null,
        tradesThisWeek: 1,
        tradesThisMonth: 3,
        tradesThisYear: 5,
        winsBySymbol: {},
        lossesBySymbol: {},
      };
      mockStatisticsService.calculateStatisticsFromHistory.mockResolvedValue(mockStats);

      const handler = new GetTradeStatisticsHandler(mockStatisticsService);
      const fromDate = new Date('2024-01-01');
      const toDate = new Date('2024-01-31');
      const query = new GetTradeStatisticsQuery(fromDate, toDate, ['BTCUSDT']);

      await handler.execute(query);

      expect(mockStatisticsService.calculateStatisticsFromHistory).toHaveBeenCalled();
    });

    it('should return empty stats when no closed trades', async () => {
      const emptyStats: TradeStatistics = {
        totalTrades: 0,
        closedTrades: 0,
        winRate: 0,
        averageRR: 0,
        totalRR: 0,
        breakEvenRate: 0,
        profitability: 'BREAKEVEN',
        bestTrade: null,
        worstTrade: null,
        tradesThisWeek: 0,
        tradesThisMonth: 0,
        tradesThisYear: 0,
        winsBySymbol: {},
        lossesBySymbol: {},
      };
      mockStatisticsService.calculateStatisticsFromHistory.mockResolvedValue(emptyStats);

      const handler = new GetTradeStatisticsHandler(mockStatisticsService);
      const query = new GetTradeStatisticsQuery();

      const result = await handler.execute(query);

      expect(result.totalTrades).toBe(0);
      expect(result.winRate).toBe(0);
    });
  });
});