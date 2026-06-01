import { Injectable, Inject } from '@nestjs/common';
import { BinanceInfoPort, BINANCE_INFO_PORT } from '@price/provider/binance/domain/ports/binance-info.port';
import { TradeSide } from '@trade/shared';

export interface BinanceInfoData {
  price: string;
  change24h: string;
  volume: string;
  high: string;
  low: string;
}

@Injectable()
export class BinanceInfoService {
  constructor(
    @Inject(BINANCE_INFO_PORT) private readonly binancePort: BinanceInfoPort,
  ) {}

  async getSymbolInfo(symbol: string, side: TradeSide): Promise<BinanceInfoData> {
    const isFutures = side === TradeSide.LONG || side === TradeSide.SHORT;
    const ticker = await this.binancePort.getTickerInfo(symbol, isFutures);

    return {
      price: ticker.price.toFixed(4),
      change24h: this.formatPercent(ticker.change24hPercent),
      volume: this.formatVolume(ticker.volume24h),
      high: ticker.high24h.toFixed(4),
      low: ticker.low24h.toFixed(4),
    };
  }

  private formatPercent(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  }

  private formatVolume(volume: number): string {
    if (volume >= 1_000_000) {
      return `$${(volume / 1_000_000).toFixed(2)}M`;
    }
    if (volume >= 1_000) {
      return `$${(volume / 1_000).toFixed(2)}K`;
    }
    return `$${volume.toFixed(2)}`;
  }
}