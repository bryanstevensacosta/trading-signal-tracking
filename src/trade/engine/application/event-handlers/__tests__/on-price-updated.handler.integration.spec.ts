import { OnPriceUpdatedHandler } from '../on-price-updated.handler';
import { PriceUpdatedEvent } from '@price/stream/domain/events/price-updated.event';
import { TradingEngineService } from '../../../domain/services/trading-engine.service';
import { SqliteTradeAdapter } from '@trade/repository/infrastructure/adapters/sqlite-trade.adapter';
import { Trade, TradeStatus, TradeSide, Price, OrderType } from '@trade/shared';

describe('OnPriceUpdatedHandler', () => {
  let handler: OnPriceUpdatedHandler;
  let mockEngine: jest.Mocked<TradingEngineService>;
  let mockRepository: jest.Mocked<SqliteTradeAdapter>;

  beforeEach(() => {
    mockEngine = {
      onPriceUpdateForSymbol: jest.fn(),
    } as any;

    mockRepository = {
      findBySymbol: jest.fn(),
    } as any;

    handler = new OnPriceUpdatedHandler(mockEngine, mockRepository as any);
  });

  const createTrade = (id: string, status: TradeStatus = TradeStatus.ACTIVE): Trade => ({
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
    status,
    sourceMessage: 'test',
    sourceChat: null,
    tpsHit: [],
    notificationMessageId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
  });

  const createPrice = (symbol: string = 'BTCUSDT'): Price => ({
    symbol,
    bid: 50000,
    ask: 50001,
    last: 50000.5,
    timestamp: new Date(),
    exchange: 'binance',
  });

  describe('handle', () => {
    it('should find trades by symbol', async () => {
      const trades = [createTrade('1'), createTrade('2')];
      mockRepository.findBySymbol.mockResolvedValue(trades);

      const event = new PriceUpdatedEvent(createPrice());
      await handler.handle(event);

      expect(mockRepository.findBySymbol).toHaveBeenCalledWith('BTCUSDT');
    });

    it('should call onPriceUpdateForSymbol for each active trade', async () => {
      const trades = [
        createTrade('1', TradeStatus.ACTIVE),
        createTrade('2', TradeStatus.ACTIVE),
      ];
      mockRepository.findBySymbol.mockResolvedValue(trades);
      const price = createPrice();

      const event = new PriceUpdatedEvent(price);
      await handler.handle(event);

      expect(mockEngine.onPriceUpdateForSymbol).toHaveBeenCalledTimes(2);
      expect(mockEngine.onPriceUpdateForSymbol).toHaveBeenCalledWith('BTCUSDT', price);
    });

    it('should skip closed trades', async () => {
      const trades = [
        createTrade('1', TradeStatus.CLOSED_WIN),
        createTrade('2', TradeStatus.CLOSED_LOSS),
        createTrade('3', TradeStatus.CANCELLED),
      ];
      mockRepository.findBySymbol.mockResolvedValue(trades);

      const event = new PriceUpdatedEvent(createPrice());
      await handler.handle(event);

      expect(mockEngine.onPriceUpdateForSymbol).not.toHaveBeenCalled();
    });

    it('should process pending and active trades', async () => {
      const trades = [
        createTrade('1', TradeStatus.PENDING),
        createTrade('2', TradeStatus.ACTIVE),
        createTrade('3', TradeStatus.PARTIAL_TP),
        createTrade('4', TradeStatus.BREAKEVEN),
      ];
      mockRepository.findBySymbol.mockResolvedValue(trades);
      const price = createPrice();

      const event = new PriceUpdatedEvent(price);
      await handler.handle(event);

      expect(mockEngine.onPriceUpdateForSymbol).toHaveBeenCalledTimes(4);
    });

    it('should handle empty trades list', async () => {
      mockRepository.findBySymbol.mockResolvedValue([]);

      const event = new PriceUpdatedEvent(createPrice());
      await handler.handle(event);

      expect(mockEngine.onPriceUpdateForSymbol).not.toHaveBeenCalled();
    });

    it('should use correct symbol from price event', async () => {
      const trades = [createTrade('1')];
      mockRepository.findBySymbol.mockResolvedValue(trades);

      const price = createPrice('ETHUSDT');
      const event = new PriceUpdatedEvent(price);
      await handler.handle(event);

      expect(mockRepository.findBySymbol).toHaveBeenCalledWith('ETHUSDT');
    });
  });
});