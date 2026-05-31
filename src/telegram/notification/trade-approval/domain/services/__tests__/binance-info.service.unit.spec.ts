import { BinanceInfoService, BinanceInfoData } from '../binance-info.service';
import { BinanceInfo } from '@price/provider/binance/domain/ports/binance-info.port';
import { TradeSide } from '@trade/shared';

describe('BinanceInfoService', () => {
  let service: BinanceInfoService;
  let mockPort: { getTickerInfo: jest.Mock };

  beforeEach(() => {
    mockPort = {
      getTickerInfo: jest.fn(),
    };
    service = new BinanceInfoService(mockPort as any);
  });

  describe('getSymbolInfo', () => {
    it('should format ticker data correctly', async () => {
      const mockTicker: BinanceInfo = {
        symbol: 'BTCUSDT',
        price: 50123.456789,
        change24hPercent: 1.5,
        volume24h: 1500000000,
        high24h: 51000,
        low24h: 49000,
      };
      mockPort.getTickerInfo.mockResolvedValue(mockTicker);

      const result = await service.getSymbolInfo('BTCUSDT', TradeSide.LONG);

      expect(result.price).toBe('50123.4568');
      expect(result.change24h).toBe('+1.50%');
      expect(result.volume).toBe('$1500.00M');
      expect(result.high).toBe('51000.0000');
      expect(result.low).toBe('49000.0000');
    });

    it('should handle negative change', async () => {
      const mockTicker: BinanceInfo = {
        symbol: 'ETHUSDT',
        price: 3000,
        change24hPercent: -2.5,
        volume24h: 500000000,
        high24h: 3100,
        low24h: 2900,
      };
      mockPort.getTickerInfo.mockResolvedValue(mockTicker);

      const result = await service.getSymbolInfo('ETHUSDT', TradeSide.SHORT);

      expect(result.change24h).toBe('-2.50%');
    });

    it('should format millions volume correctly', async () => {
      const mockTicker: BinanceInfo = {
        symbol: 'BNBUSDT',
        price: 300,
        change24hPercent: 0,
        volume24h: 1500000,
        high24h: 310,
        low24h: 290,
      };
      mockPort.getTickerInfo.mockResolvedValue(mockTicker);

      const result = await service.getSymbolInfo('BNBUSDT', TradeSide.LONG);

      expect(result.volume).toBe('$1.50M');
    });

    it('should format thousands volume correctly', async () => {
      const mockTicker: BinanceInfo = {
        symbol: 'TESTUSDT',
        price: 1.5,
        change24hPercent: 0,
        volume24h: 5000,
        high24h: 2,
        low24h: 1,
      };
      mockPort.getTickerInfo.mockResolvedValue(mockTicker);

      const result = await service.getSymbolInfo('TESTUSDT', TradeSide.SHORT);

      expect(result.volume).toBe('$5.00K');
    });

    it('should format small volume correctly', async () => {
      const mockTicker: BinanceInfo = {
        symbol: 'MICROUSDT',
        price: 0.001,
        change24hPercent: 0,
        volume24h: 500,
        high24h: 0.002,
        low24h: 0.0005,
      };
      mockPort.getTickerInfo.mockResolvedValue(mockTicker);

      const result = await service.getSymbolInfo('MICROUSDT', TradeSide.LONG);

      expect(result.volume).toBe('$500.00');
    });

    it('should pass symbol to port', async () => {
      const mockTicker: BinanceInfo = {
        symbol: 'BTCUSDT',
        price: 50000,
        change24hPercent: 0,
        volume24h: 0,
        high24h: 0,
        low24h: 0,
      };
      mockPort.getTickerInfo.mockResolvedValue(mockTicker);

      await service.getSymbolInfo('BTCUSDT', TradeSide.LONG);

      expect(mockPort.getTickerInfo).toHaveBeenCalledWith('BTCUSDT', true);
    });

    it('should handle zero change', async () => {
      const mockTicker: BinanceInfo = {
        symbol: 'USDCUSDT',
        price: 1,
        change24hPercent: 0,
        volume24h: 0,
        high24h: 1.001,
        low24h: 0.999,
      };
      mockPort.getTickerInfo.mockResolvedValue(mockTicker);

      const result = await service.getSymbolInfo('USDCUSDT', TradeSide.LONG);

      expect(result.change24h).toBe('+0.00%');
    });

    it('should use spot API for SPOT side', async () => {
      const mockTicker: BinanceInfo = {
        symbol: 'BTCUSDT',
        price: 50000,
        change24hPercent: 0,
        volume24h: 0,
        high24h: 0,
        low24h: 0,
      };
      mockPort.getTickerInfo.mockResolvedValue(mockTicker);

      await service.getSymbolInfo('BTCUSDT', TradeSide.SPOT);

      expect(mockPort.getTickerInfo).toHaveBeenCalledWith('BTCUSDT', false);
    });
  });
});