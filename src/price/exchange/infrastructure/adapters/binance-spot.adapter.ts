import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { BinanceSpotPort } from '../../domain/ports/binance-spot.port';
import { ExchangeConfig } from '../../domain/value-objects/exchange-config.vo';
import { Price, MarketType } from '@trade/shared';
import { LoggerPort, LOGGER_PORT } from '@shared';
import { WebSocket } from 'ws';
import {
  ExchangeConnectionError,
  SymbolNotFoundError,
  ExchangeTimeoutError,
} from '../../domain/errors/exchange-errors';

interface BinanceSpotTickerResponse {
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

const SPOT_REST_URL = 'https://api.binance.com';
const SPOT_WS_URL = 'wss://stream.binance.com:9443/ws';
const SPOT_COMBINED_WS_URL = 'wss://stream.binance.com:9443/stream';

/**
 * Binance Spot exchange adapter implementing BinanceSpotPort.
 * Handles connections to Binance Spot REST API and WebSocket streams.
 */
@Injectable()
export class BinanceSpotAdapter implements BinanceSpotPort, OnModuleInit, OnModuleDestroy {
  private connected = false;
  private ws: WebSocket | null = null;
  private subscriptions = new Map<string, Set<(price: Price) => void>>();
  private batchSubscriptions = new Map<string, Set<(prices: Price[]) => void>>();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(@Inject(LOGGER_PORT) private readonly logger: LoggerPort) {}

  private readonly config: ExchangeConfig = {
    name: 'binance',
    restUrl: SPOT_REST_URL,
    wsUrl: SPOT_WS_URL,
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
        throw new ExchangeConnectionError(this.config.name, `HTTP ${response.status}`);
      }
      this.connected = true;
      this.startPingInterval();
      this.logger.info('Connected to Binance Spot API');
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
          throw new SymbolNotFoundError(upperSymbol, this.config.name);
        }
        throw new ExchangeConnectionError(this.config.name, `HTTP ${response.status}`);
      }

      const data = await response.json() as BinanceSpotTickerResponse;
      return this.normalizeSpotTicker(data);
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

  getConfig(): ExchangeConfig {
    return { ...this.config };
  }

  private getField(data: any, ...fields: string[]): string | undefined {
    for (const f of fields) {
      if (data[f] !== undefined) return data[f];
    }
    return undefined;
  }

  private normalizeSpotTicker(data: any): Price {
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

    this.ws = new WebSocket(SPOT_COMBINED_WS_URL);

    this.ws.onopen = () => {
      this.logger.info(`[BinanceSpot] WebSocket connected to ${SPOT_COMBINED_WS_URL}`);
      this.sendSubscription();
      this.startPingInterval();
    };

    this.ws.onmessage = (event: any) => {
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

  private handleMessage(message: { stream?: string; data?: any }): void {
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
}