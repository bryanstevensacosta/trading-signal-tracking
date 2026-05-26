import { GetPriceHandler } from '../handler';
import { GetPriceQuery } from '../query';
import { BinanceSpotPort } from '@price/exchange/domain/ports/binance-spot.port';
import { Price, MarketType } from '@trade/shared';

describe('GetPriceHandler', () => {
  const mockGetTicker = jest.fn();
  const mockExchangePort = {
    connect: jest.fn(),
    disconnect: jest.fn(),
    isConnected: jest.fn(),
    getTicker: mockGetTicker,
    getMultipleTickers: jest.fn(),
    subscribeToTicker: jest.fn(),
    subscribeToMultipleTickers: jest.fn(),
    getConfig: jest.fn(),
    symbolExists: jest.fn(),
  } as unknown as BinanceSpotPort;

  const handler = new GetPriceHandler(mockExchangePort);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return price from exchange', async () => {
      const mockPrice: Price = {
        symbol: 'BTCUSDT',
        bid: 50000,
        ask: 50001,
        last: 50000.5,
        timestamp: new Date(),
        exchange: 'binance',
        marketType: MarketType.SPOT,
      };

      mockGetTicker.mockResolvedValue(mockPrice);

      const query = new GetPriceQuery('BTCUSDT');
      const result = await handler.execute(query);

      expect(result.price).toEqual(mockPrice);
      expect(mockGetTicker).toHaveBeenCalledWith('BTCUSDT');
    });

    it('should pass symbol to exchange', async () => {
      mockGetTicker.mockResolvedValue({} as Price);

      const query = new GetPriceQuery('ETHUSDT');
      await handler.execute(query);

      expect(mockGetTicker).toHaveBeenCalledWith('ETHUSDT');
    });
  });
});