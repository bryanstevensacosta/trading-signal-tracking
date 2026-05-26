import { TradeHistoryService } from '../trade-history.service';
import { TradeHistoryPort, HistoryFilters } from '../../ports/trade-history.port';
import { Trade, TradeStatus, TradeSide } from '../../../../shared/types';

describe('TradeHistoryService', () => {
  let mockPort: jest.Mocked<TradeHistoryPort>;
  let service: TradeHistoryService;

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
    mockPort = {
      findClosed: jest.fn(),
      findById: jest.fn(),
      count: jest.fn(),
    } as unknown as jest.Mocked<TradeHistoryPort>;

    service = new TradeHistoryService(mockPort);
  });

  describe('findClosedTrades', () => {
    it('should delegate to port.findClosed with filters', async () => {
      const mockTrades = [createMockTrade()];
      const filters: HistoryFilters = { symbols: ['BTCUSDT'], limit: 10 };
      mockPort.findClosed.mockResolvedValue(mockTrades);

      const result = await service.findClosedTrades(filters);

      expect(mockPort.findClosed).toHaveBeenCalledWith(filters);
      expect(result).toEqual(mockTrades);
    });

    it('should delegate to port.findClosed without filters', async () => {
      const mockTrades = [createMockTrade(), createMockTrade({ id: 'trade-2' })];
      mockPort.findClosed.mockResolvedValue(mockTrades);

      const result = await service.findClosedTrades();

      expect(mockPort.findClosed).toHaveBeenCalledWith(undefined);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no closed trades', async () => {
      mockPort.findClosed.mockResolvedValue([]);

      const result = await service.findClosedTrades();

      expect(result).toEqual([]);
    });
  });

  describe('getTradeById', () => {
    it('should delegate to port.findById', async () => {
      const mockTrade = createMockTrade({ id: 'trade-123' });
      mockPort.findById.mockResolvedValue(mockTrade);

      const result = await service.getTradeById('trade-123');

      expect(mockPort.findById).toHaveBeenCalledWith('trade-123');
      expect(result).toEqual(mockTrade);
    });

    it('should return null for non-existent trade', async () => {
      mockPort.findById.mockResolvedValue(null);

      const result = await service.getTradeById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getClosedTradesCount', () => {
    it('should delegate to port.count with filters', async () => {
      mockPort.count.mockResolvedValue(5);

      const result = await service.getClosedTradesCount({ symbols: ['BTCUSDT'] });

      expect(mockPort.count).toHaveBeenCalledWith({ symbols: ['BTCUSDT'] });
      expect(result).toBe(5);
    });

    it('should delegate to port.count without filters', async () => {
      mockPort.count.mockResolvedValue(10);

      const result = await service.getClosedTradesCount();

      expect(mockPort.count).toHaveBeenCalledWith(undefined);
      expect(result).toBe(10);
    });
  });

  describe('getClosedTradesBySymbols', () => {
    it('should call findClosed with symbols and limit', async () => {
      const mockTrades = [createMockTrade({ symbol: 'BTCUSDT' })];
      mockPort.findClosed.mockResolvedValue(mockTrades);

      const result = await service.getClosedTradesBySymbols(['BTCUSDT'], 5);

      expect(mockPort.findClosed).toHaveBeenCalledWith({ symbols: ['BTCUSDT'], limit: 5 });
      expect(result).toHaveLength(1);
    });

    it('should call findClosed with symbols only', async () => {
      mockPort.findClosed.mockResolvedValue([]);

      await service.getClosedTradesBySymbols(['ETHUSDT']);

      expect(mockPort.findClosed).toHaveBeenCalledWith({ symbols: ['ETHUSDT'], limit: undefined });
    });
  });

  describe('getRecentClosedTrades', () => {
    it('should call findClosed with default limit 10', async () => {
      const mockTrades = Array(10).fill(null).map((_, i) => createMockTrade({ id: `trade-${i}` }));
      mockPort.findClosed.mockResolvedValue(mockTrades);

      const result = await service.getRecentClosedTrades();

      expect(mockPort.findClosed).toHaveBeenCalledWith({ limit: 10 });
      expect(result).toHaveLength(10);
    });

    it('should call findClosed with custom limit', async () => {
      mockPort.findClosed.mockResolvedValue([]);

      await service.getRecentClosedTrades(5);

      expect(mockPort.findClosed).toHaveBeenCalledWith({ limit: 5 });
    });
  });

  describe('getClosedTradesByDateRange', () => {
    it('should call findClosed with from and to dates', async () => {
      const fromDate = new Date('2024-01-01');
      const toDate = new Date('2024-01-31');
      mockPort.findClosed.mockResolvedValue([]);

      await service.getClosedTradesByDateRange(fromDate, toDate);

      expect(mockPort.findClosed).toHaveBeenCalledWith({ fromDate, toDate });
    });
  });
});