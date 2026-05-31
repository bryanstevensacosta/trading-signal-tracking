import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { BinanceFuturesPort } from '../../domain/ports/binance-futures.port';
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
  BINANCE_FUTURES_REST_URL,
  BINANCE_FUTURES_COMBINED_WS_URL,
} from '../../constants';

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
  private symbolPrecisionCache = new Map<string, number>();
  private exchangeInfoLoaded = false;

  constructor(@Inject(LOGGER_PORT) private readonly logger: LoggerPort) {}

  private readonly config: ProviderConfig = {
    name: 'binance',
    restUrl: BINANCE_FUTURES_REST_URL,
    wsUrl: BINANCE_FUTURES_REST_URL,
    testnet: false,
    marketType: MarketType.FUTURES,
  };

  async onModuleInit(): Promise<void> {
    try {
      await this.connect();
      await this.loadExchangeInfo();
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
        throw new BinanceConnectionError(`HTTP ${response.status}`);
      }
      this.connected = true;
      this.startPingInterval();
      this.logger.info('Connected to Binance USD-M Futures API');
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
          throw new BinanceSymbolNotFoundError(upperSymbol);
        }
        throw new BinanceConnectionError(`HTTP ${response.status}`);
      }

      const data = await response.json() as BinanceFuturesTickerResponse;
      return this.normalizeFuturesTicker(data);
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
        throw new BinanceConnectionError(`HTTP ${response.status}`);
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
      throw new BinanceTimeoutError('getMarkPrice', 10000);
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

  getConfig(): ProviderConfig {
    return { ...this.config };
  }

  private normalizeFuturesTicker(data: BinanceFuturesTickerResponse): Price {
    const precision = this.getSymbolPrecision(data.symbol);
    const last = this.roundToPrecision(parseFloat(data.lastPrice), precision);
    
    return {
      symbol: data.symbol,
      bid: parseFloat(data.bidPrice),
      ask: parseFloat(data.askPrice),
      last,
      timestamp: new Date(data.closeTime || Date.now()),
      exchange: 'binance',
      marketType: MarketType.FUTURES,
    };
  }

  private ensureWebSocket(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.logger.debug(`[WebSocket Futures] Already connected, sending subscription`);
      this.sendSubscription();
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      this.logger.debug(`[WebSocket Futures] Already connecting, waiting...`);
      return;
    }

    // Build stream list and connect via URL (individual streams approach)
    // Use @depth20 stream instead of @ticker because @ticker doesn't receive data on Binance futures
    const streams: string[] = [];
    this.subscriptions.forEach((_, symbol) => {
      streams.push(`${symbol.toLowerCase()}@depth20`);
    });
    this.batchSubscriptions.forEach((_, batchKey) => {
      batchKey.split(',').forEach(symbol => {
        const lower = symbol.toLowerCase();
        if (!streams.includes(`${lower}@depth20`)) {
          streams.push(`${lower}@depth20`);
        }
      });
    });

    // Use combined stream URL with SUBSCRIBE - individual stream URLs don't work reliably
    if (streams.length > 0) {
      const streamParam = streams.join('/');
      const streamUrl = `${BINANCE_FUTURES_COMBINED_WS_URL}?streams=${streamParam}`;
      this.logger.info(`[WebSocket Futures] Using combined stream URL: ${streamUrl}`);
      this.ws = new WebSocket(streamUrl);
    } else {
      this.logger.debug(`[WebSocket Futures] No streams to subscribe to`);
      return;
    }

    this.ws.onopen = () => {
      this.logger.info(`[WebSocket Futures] Connection opened, readyState=${this.ws?.readyState}`);
      
      // Always send SUBSCRIBE - even for individual streams, Binance requires explicit subscription
      this.sendSubscription();
      
      this.startPingInterval();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        let messageStr: string;
        
        if (typeof event.data === 'string') {
          messageStr = event.data;
        } else if (event.data instanceof ArrayBuffer) {
          messageStr = new TextDecoder().decode(event.data);
          this.logger.info(`[WebSocket Futures] Received binary data, decoded: ${messageStr.substring(0, 300)}`);
        } else {
          messageStr = JSON.stringify(event.data);
        }
        
        this.logger.debug(`[WebSocket Futures] Raw message: ${messageStr.substring(0, 500)}`);
        
        const message = JSON.parse(messageStr);
        
        // Check if it's an error message
        if (message.error) {
          this.logger.error(`[WebSocket Futures] Error from Binance: ${JSON.stringify(message.error)}`);
          return;
        }
        
        // Check if it's a subscription confirmation (has "result" field)
        if (message.result !== undefined && message.id) {
          this.logger.info(`[WebSocket Futures] Subscription confirmed, id=${message.id}`);
          return;
        }
        
        this.handleMessage(message);
      } catch (err) {
        this.logger.warn(`[WebSocket Futures] Parse error: ${err}`);
      }
    };

    this.ws.onerror = (error) => {
      this.logger.error(`[WebSocket Futures] WebSocket error: ${JSON.stringify(error)}`);
      this.scheduleReconnect();
    };

    this.ws.onclose = (event) => {
      this.logger.warn(`[WebSocket Futures] WebSocket closed: code=${event.code}, reason=${event.reason}`);
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

    this.wsMarkPrice = new WebSocket(BINANCE_FUTURES_COMBINED_WS_URL);

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

  private handleMessage(message: { stream?: string; data?: BinanceFuturesTickerResponse | { e?: string; b?: string[][]; a?: string[][]; s?: string } } | BinanceFuturesTickerResponse | { lastUpdateId?: number; bids?: string[][]; asks?: string[][] }): void {
    // Check if it's a combined stream message (has stream and data)
    if ('stream' in message && 'data' in message && message.stream && message.data) {
      const symbol = message.stream.split('@')[0].toUpperCase();
      
      // Check if it's a depth update (has b/a arrays) or ticker data
      if ('b' in message.data && 'a' in message.data && Array.isArray(message.data.b) && Array.isArray(message.data.a)) {
        // This is a depth update
        const bestBid = message.data.b && message.data.b[0] ? parseFloat(message.data.b[0][0]) : 0;
        const bestAsk = message.data.a && message.data.a[0] ? parseFloat(message.data.a[0][0]) : 0;
        
        const price: Price = {
          symbol,
          bid: bestBid,
          ask: bestAsk,
          last: (bestBid + bestAsk) / 2,
          timestamp: new Date(),
          exchange: 'binance',
          marketType: MarketType.FUTURES,
        };
        
        this.logger.debug(`[WebSocket Futures] Depth update: symbol=${symbol}, bid=${bestBid}, ask=${bestAsk}`);
        
        const subs = this.subscriptions.get(symbol);
        if (subs) {
          subs.forEach(cb => cb(price));
        }
        return;
      }
      
      // It's ticker data
      const price = this.normalizeFuturesTicker(message.data as BinanceFuturesTickerResponse);

      this.logger.debug(`[WebSocket Futures] Price update (ticker): symbol=${symbol}, price=${price.last}, bid=${price.bid}, ask=${price.ask}`);

      const subs = this.subscriptions.get(symbol);
      if (subs) {
        subs.forEach(cb => cb(price));
      }
      return;
    }

    // Check if it's a depth update message (has bids/asks) - standalone format
    if ('bids' in message && 'asks' in message && message.bids && message.asks) {
      const bestBid = message.bids[0] ? parseFloat(message.bids[0][0]) : 0;
      const bestAsk = message.asks[0] ? parseFloat(message.asks[0][0]) : 0;
      
      for (const [symbol, cbs] of this.subscriptions) {
        const precision = this.getSymbolPrecision(symbol);
        const last = this.roundToPrecision((bestBid + bestAsk) / 2, precision);
        
        const price: Price = {
          symbol,
          bid: bestBid,
          ask: bestAsk,
          last,
          timestamp: new Date(),
          exchange: 'binance',
          marketType: MarketType.FUTURES,
        };
        
        this.logger.debug(`[WebSocket Futures] Depth update for ${symbol}: bid=${bestBid}, ask=${bestAsk}, last=${last}, precision=${precision}`);
        cbs.forEach(cb => cb(price));
      }
      return;
    }

    // Check if it's an individual stream message (has symbol directly)
    if ('symbol' in message && message.symbol) {
      const symbol = message.symbol.toUpperCase();
      const price = this.normalizeFuturesTicker(message as BinanceFuturesTickerResponse);

      this.logger.debug(`[WebSocket Futures] Price update (individual): symbol=${symbol}, price=${price.last}, bid=${price.bid}, ask=${price.ask}`);

      const subs = this.subscriptions.get(symbol);
      if (subs) {
        subs.forEach(cb => cb(price));
      }
      return;
    }

    this.logger.debug(`[WebSocket Futures] Ignoring message: ${JSON.stringify(message).substring(0, 100)}`);
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
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.logger.warn(`[WebSocket Futures] Cannot send subscription, readyState=${this.ws?.readyState}`);
      return;
    }

    const streams: string[] = [];

    this.subscriptions.forEach((_, symbol) => {
      streams.push(`${symbol.toLowerCase()}@depth20`);
    });

    this.batchSubscriptions.forEach((_, batchKey) => {
      batchKey.split(',').forEach(symbol => {
        const lower = symbol.toLowerCase();
        if (!streams.includes(`${lower}@depth20`)) {
          streams.push(`${lower}@depth20`);
        }
      });
    });

    if (streams.length === 0) {
      this.logger.debug(`[WebSocket Futures] No streams to subscribe to`);
      return;
    }

    this.logger.info(`[WebSocket Futures] Sending SUBSCRIBE for ${streams.join(', ')}`);
    this.ws.send(JSON.stringify({
      method: 'SUBSCRIBE',
      params: streams,
      id: Date.now(),
    }));

    this.logger.info(`[WebSocket Futures] Subscribed to ${streams.length} depth streams: ${streams.join(', ')}`);
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
        // Binance doesn't support JSON ping, use WebSocket ping frame instead
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

  private async loadExchangeInfo(): Promise<void> {
    if (this.exchangeInfoLoaded) return;
    
    try {
      const response = await fetch(`${this.config.restUrl}/fapi/v1/exchangeInfo`);
      const data = await response.json() as { symbols: Array<{ symbol: string; filters: Array<{ filterType: string; tickSize?: string }> }> };
      
      for (const symbol of data.symbols || []) {
        const priceFilter = symbol.filters.find(f => f.filterType === 'PRICE_FILTER');
        if (priceFilter?.tickSize) {
          const decimals = this.getDecimalsFromTickSize(priceFilter.tickSize);
          this.symbolPrecisionCache.set(symbol.symbol, decimals);
        }
      }
      
      this.exchangeInfoLoaded = true;
      this.logger.debug(`[BinanceFutures] Loaded precision for ${this.symbolPrecisionCache.size} symbols`);
    } catch (error) {
      this.logger.warn(`[BinanceFutures] Failed to load exchange info: ${error}`);
    }
  }

  private getDecimalsFromTickSize(tickSize: string): number {
    const parts = tickSize.split('.');
    if (parts.length === 1) return 0;
    return parts[1].replace(/0+$/, '').length || parts[1].length;
  }

  getSymbolPrecision(symbol: string): number {
    return this.symbolPrecisionCache.get(symbol) ?? 5;
  }

  roundToPrecision(value: number, precision: number): number {
    const multiplier = Math.pow(10, precision);
    return Math.round(value * multiplier) / multiplier;
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