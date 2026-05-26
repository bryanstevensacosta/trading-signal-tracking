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

  describe('property-based: service delegates all operations to port', () => {
    it('findClosedTrades should always delegate with same arguments', async () => {
      const filters: HistoryFilters = { limit: 50 };
      const mockTrades = [createMockTrade()];
      mockPort.findClosed.mockResolvedValue(mockTrades);

      await service.findClosedTrades(filters);

      expect(mockPort.findClosed).toHaveBeenCalledWith(filters);
    });

    it('getTradeById should always delegate with same id', async () => {
      const id = 'test-id-123';
      mockPort.findById.mockResolvedValue(null);

      await service.getTradeById(id);

      expect(mockPort.findById).toHaveBeenCalledWith(id);
    });

    it('getClosedTradesCount should always delegate to count', async () => {
      mockPort.count.mockResolvedValue(0);

      await service.getClosedTradesCount();

      expect(mockPort.count).toHaveBeenCalled();
    });
  });

  describe('property-based: filter combinations are passed through', () => {
    const filterCombinations: HistoryFilters[] = [
      { symbols: ['BTCUSDT'] },
      { sides: [TradeSide.LONG] },
      { limit: 10 },
      { limit: 100, offset: 20 },
      { fromDate: new Date(), toDate: new Date() },
      { symbols: ['BTCUSDT', 'ETHUSDT'], limit: 5 },
    ];

    test.each(filterCombinations)('filters %p should be passed to port', async (filters) => {
      mockPort.findClosed.mockResolvedValue([]);

      await service.findClosedTrades(filters);

      expect(mockPort.findClosed).toHaveBeenCalledWith(filters);
    });
  });

  describe('property-based: closed trades are always from history port', () => {
    it('should always return trades from port', async () => {
      const expectedTrades = [
        createMockTrade({ id: '1' }),
        createMockTrade({ id: '2', status: TradeStatus.CLOSED_LOSS }),
      ];
      mockPort.findClosed.mockResolvedValue(expectedTrades);

      const result = await service.findClosedTrades();

      expect(result).toBe(expectedTrades);
      expect(mockPort.findClosed).toHaveBeenCalled();
    });
  });
});