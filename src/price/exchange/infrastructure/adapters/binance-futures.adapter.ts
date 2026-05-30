import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { BinanceFuturesPort } from '../../domain/ports/binance-futures.port';
import { ExchangeConfig } from '../../domain/value-objects/exchange-config.vo';
import { Price, MarketType } from '@trade/shared';
import { LoggerPort, LOGGER_PORT } from '@shared';
import { WebSocket, MessageEvent } from 'ws';
import {
  ExchangeConnectionError,
  SymbolNotFoundError,
  ExchangeTimeoutError,
} from '../../domain/errors/exchange-errors';

interface BinanceFuturesTickerResponse {
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

interface BinanceFuturesMarkPriceResponse {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  estimatedSettlePrice: string;
  lastFundingRate: string;
  nextFundingTime: number;
}

interface BinanceFuturesFundingRateResponse {
  symbol: string;
  fundingRate: string;
  fundingTime: number;
}

const FUTURES_REST_URL = 'https://fapi.binance.com';
const FUTURES_WS_URL = 'wss://fstream.binance.com/ws';
const FUTURES_COMBINED_WS_URL = 'wss://fstream.binance.com/stream';

/**
 * Binance USD-M Futures exchange adapter implementing BinanceFuturesPort.
 * Handles connections to Binance USD-M Perpetual Futures API and WebSocket streams.
 */
@Injectable()
export class BinanceFuturesAdapter implements BinanceFuturesPort, OnModuleInit, OnModuleDestroy {
  private connected = false;
  private ws: WebSocket | null = null;
  private wsMarkPrice: WebSocket | null = null;
  private subscriptions = new Map<string, Set<(price: Price) => void>>();
  private markPriceSubscriptions = new Map<string, Set<(markPrice: number) => void>>();
  private batchSubscriptions = new Map<string, Set<(prices: Price[]) => void>>();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(@Inject(LOGGER_PORT) private readonly logger: LoggerPort) {}

  private readonly config: ExchangeConfig = {
    name: 'binance',
    restUrl: FUTURES_REST_URL,
    wsUrl: FUTURES_WS_URL,
    testnet: false,
    marketType: MarketType.FUTURES,
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
      const response = await fetch(`${this.config.restUrl}/fapi/v1/ping`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        throw new ExchangeConnectionError(this.config.name, `HTTP ${response.status}`);
      }
      this.connected = true;
      this.startPingInterval();
      this.logger.info('Connected to Binance USD-M Futures API');
    } catch (error) {
      this.connected = false;
      throw new ExchangeConnectionError(
        this.config.name,
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

    if (this.wsMarkPrice) {
      this.wsMarkPrice.close();
      this.wsMarkPrice = null;
    }

    this.subscriptions.clear();
    this.markPriceSubscriptions.clear();
    this.batchSubscriptions.clear();
    this.connected = false;
    this.logger.info('Disconnected from Binance USD-M Futures API');
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getTicker(symbol: string): Promise<Price> {
    if (!this.connected) {
      await this.connect();
    }

    const upperSymbol = symbol.toUpperCase();
    const url = `${this.config.restUrl}/fapi/v1/ticker/24hr?symbol=${upperSymbol}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        if (response.status === 404) {
          throw new SymbolNotFoundError(upperSymbol, this.config.name);
        }
        throw new ExchangeConnectionError(this.config.name, `HTTP ${response.status}`);
      }

      const data = await response.json() as BinanceFuturesTickerResponse;
      return this.normalizeFuturesTicker(data);
    } catch (error) {
      if (error instanceof SymbolNotFoundError) throw error;
      if (error instanceof ExchangeConnectionError) throw error;
      throw new ExchangeTimeoutError(this.config.name, 'getTicker', 10000);
    }
  }

  async getMultipleTickers(symbols: string[]): Promise<Price[]> {
    if (symbols.length === 0) return [];

    const tickers = await Promise.all(
      symbols.map(s => this.getTicker(s).catch(() => null))
    );

    return tickers.filter((t): t is Price => t !== null);
  }

  async getMarkPrice(symbol: string): Promise<{ markPrice: number; indexPrice: number; fundingRate: number }> {
    if (!this.connected) {
      await this.connect();
    }

    const upperSymbol = symbol.toUpperCase();
    const url = `${this.config.restUrl}/fapi/v1/premiumIndexPrice?symbol=${upperSymbol}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new ExchangeConnectionError(this.config.name, `HTTP ${response.status}`);
      }

      const data = await response.json() as BinanceFuturesMarkPriceResponse;

      const fundingUrl = `${this.config.restUrl}/fapi/v1/fundingRate?symbol=${upperSymbol}`;
      const fundingResponse = await fetch(fundingUrl, { signal: controller.signal });
      let fundingRate = 0;
      if (fundingResponse.ok) {
        const fundingData = await fundingResponse.json() as BinanceFuturesFundingRateResponse;
        fundingRate = parseFloat(fundingData.fundingRate);
      }

      return {
        markPrice: parseFloat(data.markPrice),
        indexPrice: parseFloat(data.indexPrice),
        fundingRate,
      };
    } catch (error) {
      throw new ExchangeTimeoutError(this.config.name, 'getMarkPrice', 10000);
    }
  }

  async symbolExists(symbol: string): Promise<boolean> {
    try {
      const upperSymbol = symbol.toUpperCase();
      const url = `${this.config.restUrl}/fapi/v1/exchangeInfo?symbol=${upperSymbol}`;

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

  subscribeToMarkPrice(symbol: string, callback: (markPrice: number) => void): () => void {
    const upperSymbol = symbol.toUpperCase();

    if (!this.markPriceSubscriptions.has(upperSymbol)) {
      this.markPriceSubscriptions.set(upperSymbol, new Set());
    }
    this.markPriceSubscriptions.get(upperSymbol)!.add(callback);

    this.ensureMarkPriceWebSocket();

    return () => {
      const subs = this.markPriceSubscriptions.get(upperSymbol);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.markPriceSubscriptions.delete(upperSymbol);
          this.cleanupMarkPriceWebSocket();
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

  getConfig(): ExchangeConfig {
    return { ...this.config };
  }

  private normalizeFuturesTicker(data: BinanceFuturesTickerResponse): Price {
    return {
      symbol: data.symbol,
      bid: parseFloat(data.bidPrice),
      ask: parseFloat(data.askPrice),
      last: parseFloat(data.lastPrice),
      timestamp: new Date(data.closeTime || Date.now()),
      exchange: 'binance',
      marketType: MarketType.FUTURES,
    };
  }

  private ensureWebSocket(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendSubscription();
      return;
    }

    this.ws = new WebSocket(FUTURES_COMBINED_WS_URL);

    this.ws.onopen = () => {
      this.sendSubscription();
      this.startPingInterval();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const data = event.data;
        const message = typeof data === 'string' ? JSON.parse(data) : JSON.parse(data.toString('utf8'));
        this.handleMessage(message);
      } catch {
        // Ignore parse errors
      }
    };

    this.ws.onerror = () => {
      this.scheduleReconnect();
    };

    this.ws.onclose = () => {
      this.stopPingInterval();
      this.scheduleReconnect();
    };
  }

  private ensureMarkPriceWebSocket(): void {
    if (this.markPriceSubscriptions.size === 0) return;

    if (this.wsMarkPrice && this.wsMarkPrice.readyState === WebSocket.OPEN) {
      this.sendMarkPriceSubscription();
      return;
    }

    this.wsMarkPrice = new WebSocket(FUTURES_COMBINED_WS_URL);

    this.wsMarkPrice.onopen = () => {
      this.sendMarkPriceSubscription();
    };

    this.wsMarkPrice.onmessage = (event: MessageEvent) => {
      try {
        const data = event.data;
        const message = typeof data === 'string' ? JSON.parse(data) : JSON.parse(data.toString('utf8'));
        this.handleMarkPriceMessage(message);
      } catch {
        // Ignore parse errors
      }
    };

    this.wsMarkPrice.onerror = () => {
      // Handle silently
    };

    this.wsMarkPrice.onclose = () => {
      // Reconnect if needed
      if (this.markPriceSubscriptions.size > 0) {
        setTimeout(() => this.ensureMarkPriceWebSocket(), 5000);
      }
    };
  }

  private handleMessage(message: { stream?: string; data?: BinanceFuturesTickerResponse }): void {
    if (!message.stream || !message.data) return;

    const symbol = message.stream.split('@')[0].toUpperCase();
    const price = this.normalizeFuturesTicker(message.data);

    const subs = this.subscriptions.get(symbol);
    if (subs) {
      subs.forEach(cb => cb(price));
    }
  }

  private handleMarkPriceMessage(message: { stream?: string; data?: { s: string; p: string } }): void {
    if (!message.stream || !message.data) return;

    if (!message.stream.includes('@markPrice')) return;

    const symbol = message.stream.split('@')[0].toUpperCase();
    const markPrice = parseFloat(message.data.p);

    const subs = this.markPriceSubscriptions.get(symbol);
    if (subs) {
      subs.forEach(cb => cb(markPrice));
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

    this.ws.send(JSON.stringify({
      method: 'SUBSCRIBE',
      params: streams,
      id: Date.now(),
    }));

    this.logger.debug(`Subscribed to ${streams.length} ticker streams`);
  }

  private sendMarkPriceSubscription(): void {
    if (!this.wsMarkPrice || this.wsMarkPrice.readyState !== WebSocket.OPEN) return;
    if (this.markPriceSubscriptions.size === 0) return;

    const streams: string[] = [];
    this.markPriceSubscriptions.forEach((_, symbol) => {
      streams.push(`${symbol.toLowerCase()}@markPrice`);
    });

    this.wsMarkPrice.send(JSON.stringify({
      method: 'SUBSCRIBE',
      params: streams,
      id: Date.now(),
    }));

    this.logger.debug(`Subscribed to ${streams.length} mark price streams`);
  }

  private cleanupWebSocket(): void {
    if (this.subscriptions.size > 0 || this.batchSubscriptions.size > 0) return;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private cleanupMarkPriceWebSocket(): void {
    if (this.markPriceSubscriptions.size > 0) return;

    if (this.wsMarkPrice) {
      this.wsMarkPrice.close();
      this.wsMarkPrice = null;
    }
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ method: 'ping' }));
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
    this.reconnectTimeout = setTimeout(() => {
      if (this.subscriptions.size > 0 || this.batchSubscriptions.size > 0) {
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

    const url = `${this.config.restUrl}/fapi/v1/klines?${params}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new ExchangeConnectionError(this.config.name, `HTTP ${response.status}`);
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
      if (error instanceof ExchangeConnectionError) throw error;
      throw new ExchangeTimeoutError(this.config.name, 'getKlines', 10000);
    }
  }
}