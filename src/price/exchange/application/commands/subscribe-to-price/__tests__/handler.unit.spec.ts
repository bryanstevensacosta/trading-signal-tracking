import { SubscribeToPriceHandler, SubscribeToMultiplePricesHandler } from '../handler';
import { SubscribeToPriceCommand, SubscribeToMultiplePricesCommand } from '../command';
import { BinanceSpotPort } from '@price/exchange/domain/ports/binance-spot.port';

describe('SubscribeToPriceHandler', () => {
  const mockSubscribeToTicker = jest.fn();
  const mockExchangePort = {
    connect: jest.fn(),
    disconnect: jest.fn(),
    isConnected: jest.fn(),
    getTicker: jest.fn(),
    getMultipleTickers: jest.fn(),
    subscribeToTicker: mockSubscribeToTicker,
    subscribeToMultipleTickers: jest.fn(),
    getConfig: jest.fn(),
    symbolExists: jest.fn(),
  } as unknown as BinanceSpotPort;

  const handler = new SubscribeToPriceHandler(mockExchangePort);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should call subscribeToTicker with symbol and callback', async () => {
      const callback = jest.fn();
      mockSubscribeToTicker.mockReturnValue(() => {});

      const command = new SubscribeToPriceCommand('BTCUSDT', callback);
      const result = await handler.execute(command);

      expect(mockSubscribeToTicker).toHaveBeenCalledWith('BTCUSDT', callback);
      expect(result.unsubscribe).toBeDefined();
    });

    it('should return unsubscribe function', async () => {
      const unsubscribe = jest.fn();
      const callback = jest.fn();
      mockSubscribeToTicker.mockReturnValue(unsubscribe);

      const command = new SubscribeToPriceCommand('ETHUSDT', callback);
      const result = await handler.execute(command);

      result.unsubscribe();
      expect(unsubscribe).toHaveBeenCalled();
    });
  });
});

describe('SubscribeToMultiplePricesHandler', () => {
  const mockSubscribeToMultipleTickers = jest.fn();
  const mockExchangePort = {
    connect: jest.fn(),
    disconnect: jest.fn(),
    isConnected: jest.fn(),
    getTicker: jest.fn(),
    getMultipleTickers: jest.fn(),
    subscribeToTicker: jest.fn(),
    subscribeToMultipleTickers: mockSubscribeToMultipleTickers,
    getConfig: jest.fn(),
    symbolExists: jest.fn(),
  } as unknown as BinanceSpotPort;

  const handler = new SubscribeToMultiplePricesHandler(mockExchangePort);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should call subscribeToMultipleTickers with symbols and callback', async () => {
      const callback = jest.fn();
      mockSubscribeToMultipleTickers.mockReturnValue(() => {});

      const command = new SubscribeToMultiplePricesCommand(['BTCUSDT', 'ETHUSDT'], callback);
      const result = await handler.execute(command);

      expect(mockSubscribeToMultipleTickers).toHaveBeenCalledWith(
        ['BTCUSDT', 'ETHUSDT'],
        callback
      );
      expect(result.unsubscribe).toBeDefined();
    });

    it('should return unsubscribe function', async () => {
      const unsubscribe = jest.fn();
      const callback = jest.fn();
      mockSubscribeToMultipleTickers.mockReturnValue(unsubscribe);

      const command = new SubscribeToMultiplePricesCommand(['BTCUSDT'], callback);
      const result = await handler.execute(command);

      result.unsubscribe();
      expect(unsubscribe).toHaveBeenCalled();
    });

    it('should handle empty symbols array', async () => {
      const callback = jest.fn();
      mockSubscribeToMultipleTickers.mockReturnValue(() => {});

      const command = new SubscribeToMultiplePricesCommand([], callback);
      await handler.execute(command);

      expect(mockSubscribeToMultipleTickers).toHaveBeenCalledWith([], callback);
    });
  });
});