import { ExchangePort } from '../../domain/ports/exchange.port';
import { ExchangeConfig, getExchangeConfig } from '../../domain/value-objects/exchange-config.vo';
import { Price } from '@trade/shared';
import {
  ExchangeConnectionError,
  SymbolNotFoundError,
  ExchangeTimeoutError,
} from '../../domain/errors/exchange-errors';

interface BinanceTickerResponse {
  symbol: string;
  bidPrice: string;
  askPrice: string;
  lastPrice: string;
  volume: string;
  closeTime: number;
}

/**
 * Binance exchange adapter implementing the ExchangePort interface.
 * Handles connections to Binance REST API and WebSocket streams.
 * 
 * @example
 * const adapter = new BinanceExchangeAdapter();
 * await adapter.connect();
 * const price = await adapter.getTicker('BTCUSDT');
 * const unsubscribe = adapter.subscribeToTicker('ETHUSDT', (p) => console.log(p));
 */
export class BinanceExchangeAdapter implements ExchangePort {
  private config: ExchangeConfig;
  private connected = false;
  private ws: WebSocket | null = null;
  private subscriptions = new Map<string, Set<(price: Price) => void>>();
  private batchSubscriptions = new Map<string, Set<(prices: Price[]) => void>>();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config?: ExchangeConfig) {
    this.config = config || getExchangeConfig('binance', false);
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      const response = await fetch(`${this.config.restUrl}/api/v3/ping`);
      if (!response.ok) {
        throw new ExchangeConnectionError(this.config.name, `HTTP ${response.status}`);
      }
      this.connected = true;
      this.startPingInterval();
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

      const data = await response.json() as BinanceTickerResponse;

      return this.normalizeTicker(data);
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

  private ensureConnected(): void {
    if (!this.connected) {
      throw new ExchangeConnectionError(this.config.name, 'Not connected. Call connect() first.');
    }
  }

  private ensureWebSocket(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(`${this.config.wsUrl}/stream`);

    this.ws.onopen = () => {
      this.sendSubscription();
      this.startPingInterval();
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
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
  }

  private handleMessage(message: { stream?: string; data?: BinanceTickerResponse }): void {
    if (!message.stream || !message.data) return;

    const symbol = message.stream.split('@')[0].toUpperCase();
    const price = this.normalizeTicker(message.data);

    const subs = this.subscriptions.get(symbol);
    if (subs) {
      subs.forEach(cb => cb(price));
    }
  }

  private normalizeTicker(data: BinanceTickerResponse): Price {
    return {
      symbol: data.symbol,
      bid: parseFloat(data.bidPrice),
      ask: parseFloat(data.askPrice),
      last: parseFloat(data.lastPrice),
      timestamp: new Date(data.closeTime || Date.now()),
      exchange: this.config.name,
    };
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
}