import { Injectable, Inject } from '@nestjs/common';
import { BinanceInfoPort, BinanceInfo } from '../../domain/ports/binance-info.port';
import { LoggerPort, LOGGER_PORT } from '@shared';

interface Binance24hrResponse {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  lastPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
}

@Injectable()
export class BinanceInfoAdapter implements BinanceInfoPort {
  private readonly logger: LoggerPort;

  constructor(@Inject(LOGGER_PORT) logger: LoggerPort) {
    this.logger = logger;
  }

  async getTickerInfo(symbol: string, isFutures: boolean): Promise<BinanceInfo> {
    const upperSymbol = symbol.toUpperCase().replace(/USDT$/, '');
    const baseUrl = isFutures ? 'https://fapi.binance.com/fapi/v1' : 'https://api.binance.com/api/v3';
    const url = `${baseUrl}/ticker/24hr?symbol=${upperSymbol}USDT`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status}`);
      }

      const data = await response.json() as Binance24hrResponse;

      return {
        price: parseFloat(data.lastPrice),
        change24hPercent: parseFloat(data.priceChangePercent),
        volume24h: parseFloat(data.quoteVolume),
        high24h: parseFloat(data.highPrice),
        low24h: parseFloat(data.lowPrice),
        symbol: data.symbol,
      };
    } catch (error) {
      this.logger.error(`Failed to get ticker info for ${symbol}:`, error as Error);
      return {
        price: 0,
        change24hPercent: 0,
        volume24h: 0,
        high24h: 0,
        low24h: 0,
        symbol: upperSymbol,
      };
    }
  }
}