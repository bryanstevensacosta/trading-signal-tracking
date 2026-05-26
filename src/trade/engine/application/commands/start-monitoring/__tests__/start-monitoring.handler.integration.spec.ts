import { StartMonitoringHandler } from '../handler';
import { StartMonitoringCommand } from '../command';
import { TradingEngineService } from '../../../../domain/services/trading-engine.service';
import { SqliteTradeAdapter } from '@trade/repository/infrastructure/adapters/sqlite-trade.adapter';
import { Trade, TradeStatus, TradeSide, OrderType } from '@trade/shared';

describe('StartMonitoringHandler', () => {
  let handler: StartMonitoringHandler;
  let mockEngine: jest.Mocked<TradingEngineService>;
  let mockRepository: jest.Mocked<SqliteTradeAdapter>;

  beforeEach(() => {
    mockEngine = {
      startMonitoring: jest.fn(),
    } as any;

    mockRepository = {
      findById: jest.fn(),
    } as any;

    handler = new StartMonitoringHandler(mockEngine, mockRepository as any);
  });

  const createTrade = (id: string): Trade => ({
    id,
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
    sourceChat: null,
    tpsHit: [],
    notificationMessageId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
  });

  describe('execute', () => {
    it('should find trade by id', async () => {
      const tradeId = 'test-id';
      const trade = createTrade(tradeId);
      mockRepository.findById.mockResolvedValue(trade);

      const command = new StartMonitoringCommand(tradeId);
      await handler.execute(command);

      expect(mockRepository.findById).toHaveBeenCalledWith(tradeId);
    });

    it('should call engine.startMonitoring with trade', async () => {
      const tradeId = 'test-id';
      const trade = createTrade(tradeId);
      mockRepository.findById.mockResolvedValue(trade);

      const command = new StartMonitoringCommand(tradeId);
      await handler.execute(command);

      expect(mockEngine.startMonitoring).toHaveBeenCalledWith(trade);
    });

    it('should throw error when trade not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const command = new StartMonitoringCommand('non-existent');

      await expect(handler.execute(command)).rejects.toThrow('Trade non-existent not found');
    });

    it('should not call engine when trade not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const command = new StartMonitoringCommand('non-existent');

      await expect(handler.execute(command)).rejects.toThrow();
      expect(mockEngine.startMonitoring).not.toHaveBeenCalled();
    });
  });
});