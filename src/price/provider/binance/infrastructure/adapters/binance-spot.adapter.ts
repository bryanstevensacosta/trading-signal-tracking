import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { BinanceSpotPort } from '../../domain/ports/binance-spot.port';
import { ProviderConfig } from '@price/provider/shared';
import { Price, MarketType } from '@trade/shared';
import { LoggerPort, LOGGER_PORT } from '@shared';
import { WebSocket, MessageEvent } from 'ws';
import {
  BinanceConnectionError,
  BinanceSymbolNotFoundError,
  BinanceTimeoutError,
} from '../../domain/errors/binance-errors';
import {
  BINANCE_SPOT_REST_URL,
  BINANCE_SPOT_COMBINED_WS_URL,
} from '../../constants';

interface BinanceSpotTickerResponse {
  [key: string]: unknown;
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  lastPrice: string;
  bidPrice: string;
  askPrice: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  closeTime: number;
}

@Injectable()
export class BinanceSpotAdapter implements BinanceSpotPort, OnModuleInit, OnModuleDestroy {
  private connected = false;
  private ws: WebSocket | null = null;
  private subscriptions = new Map<string, Set<(price: Price) => void>>();
  private batchSubscriptions = new Map<string, Set<(prices: Price[]) => void>>();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(@Inject(LOGGER_PORT) private readonly logger: LoggerPort) {}

  private readonly config: ProviderConfig = {
    name: 'binance',
    restUrl: BINANCE_SPOT_REST_URL,
    wsUrl: BINANCE_SPOT_REST_URL,
    testnet: false,
    marketType: MarketType.SPOT,
  };

  async onModuleInit(): Promise<void> {
    try {
      await this.connect();
    } catch (error) {
      this.logger.warn(`Binance connection failed on init, will retry on demand: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      const response = await fetch(`${this.config.restUrl}/api/v3/ping`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        throw new BinanceConnectionError(`HTTP ${response.status}`);
      }
      this.connected = true;
      this.startPingInterval();
      this.logger.info('Connected to Binance Spot API');
    } catch (error) {
      this.connected = false;
      throw new BinanceConnectionError(
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  async disconnect(): Promise<void> {
    this.stopPingInterval();
    this.stopReconnectTimeout();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.subscriptions.clear();
    this.batchSubscriptions.clear();
    this.connected = false;
    this.logger.info('Disconnected from Binance Spot API');
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getTicker(symbol: string): Promise<Price> {
    if (!this.connected) {
      await this.connect();
    }

    const upperSymbol = symbol.toUpperCase();
    const url = `${this.config.restUrl}/api/v3/ticker/24hr?symbol=${upperSymbol}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        if (response.status === 404) {
          throw new BinanceSymbolNotFoundError(upperSymbol);
        }
        throw new BinanceConnectionError(`HTTP ${response.status}`);
      }

      const data = await response.json() as BinanceSpotTickerResponse;
      return this.normalizeSpotTicker(data);
    } catch (error) {
      if (error instanceof BinanceSymbolNotFoundError) throw error;
      if (error instanceof BinanceConnectionError) throw error;
      throw new BinanceTimeoutError('getTicker', 10000);
    }
  }

  async getMultipleTickers(symbols: string[]): Promise<Price[]> {
    if (symbols.length === 0) return [];

    const tickers = await Promise.all(
      symbols.map(s => this.getTicker(s).catch(() => null))
    );

    return tickers.filter((t): t is Price => t !== null);
  }

  async symbolExists(symbol: string): Promise<boolean> {
    try {
      const upperSymbol = symbol.toUpperCase();
      const url = `${this.config.restUrl}/api/v3/exchangeInfo?symbol=${upperSymbol}`;

      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  subscribeToTicker(symbol: string, callback: (price: Price) => void): () => void {
    const upperSymbol = symbol.toUpperCase();

    if (!this.subscriptions.has(upperSymbol)) {
      this.subscriptions.set(upperSymbol, new Set());
    }
    this.subscriptions.get(upperSymbol)!.add(callback);

    this.ensureWebSocket();

    return () => {
      const subs = this.subscriptions.get(upperSymbol);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscriptions.delete(upperSymbol);
          this.cleanupWebSocket();
        }
      }
    };
  }

  subscribeToMultipleTickers(symbols: string[], callback: (prices: Price[]) => void): () => void {
    const upperSymbols = symbols.map(s => s.toUpperCase());

    upperSymbols.forEach(s => {
      if (!this.subscriptions.has(s)) {
        this.subscriptions.set(s, new Set());
      }
    });

    const batchKey = upperSymbols.sort().join(',');
    if (!this.batchSubscriptions.has(batchKey)) {
      this.batchSubscriptions.set(batchKey, new Set());
    }
    this.batchSubscriptions.get(batchKey)!.add(callback);

    this.ensureWebSocket();

    return () => {
      this.batchSubscriptions.forEach((batchSubs, batchKey) => {
        if (batchSubs.has(callback)) {
          batchSubs.delete(callback);
          if (batchSubs.size === 0) {
            this.batchSubscriptions.delete(batchKey);
          }
        }
      });

      this.cleanupWebSocket();
    };
  }

  getConfig(): ProviderConfig {
    return { ...this.config };
  }

  private getField(data: BinanceSpotTickerResponse, ...fields: string[]): string | undefined {
    for (const f of fields) {
      const value = data[f];
      if (value !== undefined) return value as string;
    }
    return undefined;
  }

  private normalizeSpotTicker(data: BinanceSpotTickerResponse): Price {
    const symbol = this.getField(data, 's', 'symbol');
    const bid = this.getField(data, 'b', 'bidPrice');
    const ask = this.getField(data, 'a', 'askPrice');
    const last = this.getField(data, 'c', 'lastPrice');
    const closeTime = this.getField(data, 'E', 'closeTime');

    return {
      symbol: symbol || 'UNKNOWN',
      bid: parseFloat(bid || '0'),
      ask: parseFloat(ask || '0'),
      last: parseFloat(last || '0'),
      timestamp: new Date(closeTime || Date.now()),
      exchange: 'binance',
      marketType: MarketType.SPOT,
    };
  }

  private ensureWebSocket(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendSubscription();
      return;
    }

    this.ws = new WebSocket(BINANCE_SPOT_COMBINED_WS_URL);

    this.ws.onopen = () => {
      this.logger.info(`[BinanceSpot] WebSocket connected to ${BINANCE_SPOT_COMBINED_WS_URL}`);
      this.sendSubscription();
      this.startPingInterval();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const data = event.data;
        const message = typeof data === 'string' ? JSON.parse(data) : JSON.parse(data.toString('utf8'));
        this.logger.debug(`[BinanceSpot] Raw WS message: ${JSON.stringify(message).substring(0, 200)}`);
        this.handleMessage(message);
      } catch (e) {
        this.logger.warn(`[BinanceSpot] Failed to parse WS message: ${e}`);
      }
    };

    this.ws.onerror = (error) => {
      this.logger.warn(`[BinanceSpot] WebSocket error: ${JSON.stringify(error)}`);
      this.scheduleReconnect();
    };

    this.ws.onclose = () => {
      this.logger.info(`[BinanceSpot] WebSocket closed`);
      this.stopPingInterval();
      this.scheduleReconnect();
    };
  }

  private handleMessage(message: { stream?: string; data?: BinanceSpotTickerResponse }): void {
    if (!message.stream || !message.data) {
      return;
    }

    const symbol = message.stream.split('@')[0].toUpperCase();
    const price = this.normalizeSpotTicker(message.data);

    this.logger.debug(`[BinanceSpot] ${symbol} bid=${price.bid} ask=${price.ask}`);

    const subs = this.subscriptions.get(symbol);
    if (subs) {
      subs.forEach(cb => cb(price));
    }
  }

  private sendSubscription(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const streams: string[] = [];

    this.subscriptions.forEach((_, symbol) => {
      streams.push(`${symbol.toLowerCase()}@ticker`);
    });

    this.batchSubscriptions.forEach((_, batchKey) => {
      batchKey.split(',').forEach(symbol => {
        const lower = symbol.toLowerCase();
        if (!streams.includes(`${lower}@ticker`)) {
          streams.push(`${lower}@ticker`);
        }
      });
    });

    if (streams.length === 0) return;

    this.logger.info(`[BinanceSpot] Subscribing to ${streams.length} streams: ${streams.join(', ')}`);

    this.ws.send(JSON.stringify({
      method: 'SUBSCRIBE',
      params: streams,
      id: Date.now(),
    }));

    this.logger.debug(`Subscribed to ${streams.length} streams`);
  }

  private cleanupWebSocket(): void {
    if (this.subscriptions.size > 0 || this.batchSubscriptions.size > 0) return;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect(): void {
    this.stopReconnectTimeout();
    this.logger.info(`[BinanceSpot] Scheduling reconnect in 5s (subs: ${this.subscriptions.size}, batch: ${this.batchSubscriptions.size})`);
    this.reconnectTimeout = setTimeout(() => {
      if (this.subscriptions.size > 0 || this.batchSubscriptions.size > 0) {
        this.logger.info(`[BinanceSpot] Reconnecting...`);
        this.ensureWebSocket();
      }
    }, 5000);
  }

  private stopReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  async getKlines(
    symbol: string,
    interval: string = '1m',
    startTime?: number,
    endTime?: number,
    limit: number = 1440
  ): Promise<Array<{
    openTime: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    closeTime: number;
  }>> {
    if (!this.connected) {
      await this.connect();
    }

    const upperSymbol = symbol.toUpperCase();
    const params = new URLSearchParams({
      symbol: upperSymbol,
      interval,
      limit: limit.toString(),
    });

    if (startTime) params.append('startTime', startTime.toString());
    if (endTime) params.append('endTime', endTime.toString());

    const url = `${this.config.restUrl}/api/v3/klines?${params}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new BinanceConnectionError(`HTTP ${response.status}`);
      }

      const data = await response.json() as Array<Array<number | string>>;

      return data.map(kline => ({
        openTime: kline[0] as number,
        open: parseFloat(kline[1] as string),
        high: parseFloat(kline[2] as string),
        low: parseFloat(kline[3] as string),
        close: parseFloat(kline[4] as string),
        volume: parseFloat(kline[5] as string),
        closeTime: kline[6] as number,
      }));
    } catch (error) {
      if (error instanceof BinanceConnectionError) throw error;
      throw new BinanceTimeoutError('getKlines', 10000);
    }
  }
}