# price/exchange Implementation Guide

Implementation details for `src/price/exchange/` - exchange adapters (Binance first, extensible to Bybit/KuCoin).

---

## Directory Structure

```
src/price/exchange/
├── domain/
│   ├── ports/
│   │   ├── exchange.port.ts             # Interface for exchange operations
│   │   └── index.ts
│   ├── value-objects/
│   │   ├── exchange-config.vo.ts       # Exchange configuration
│   │   ├── ticker.vo.ts                 # Price ticker
│   │   └── index.ts
│   └── errors/
│       └── exchange-errors.ts
├── application/
│   ├── commands/
│   │   ├── connect-exchange.command.ts
│   │   ├── disconnect-exchange.command.ts
│   │   └── index.ts
│   └── index.ts
├── infrastructure/
│   └── adapters/
│       ├── binance/
│       │   ├── binance-exchange.adapter.ts
│       │   ├── binance-rest.client.ts
│       │   └── binance-ws.client.ts
│       ├── bybit/
│       │   └── bybit-exchange.adapter.ts
│       ├── kucoin/
│       │   └── kucoin-exchange.adapter.ts
│       └── index.ts
├── config/
│   ├── exchange-config.ts
│   └── index.ts
└── index.ts
```

---

## domain/value-objects/exchange-config.vo.ts

```typescript
export type ExchangeName = 'binance' | 'bybit' | 'kucoin';

export interface ExchangeConfig {
  name: ExchangeName;
  restUrl: string;
  wsUrl: string;
  apiKey?: string;
  apiSecret?: string;
  testnet: boolean;
}

export const BINANCE_CONFIG: ExchangeConfig = {
  name: 'binance',
  restUrl: 'https://api.binance.com',
  wsUrl: 'wss://stream.binance.com:9443',
  testnet: false,
};

export const BINANCE_TESTNET_CONFIG: ExchangeConfig = {
  name: 'binance',
  restUrl: 'https://testnet.binance.vision',
  wsUrl: 'wss://testnet.binance.vision',
  testnet: true,
};
```

---

## domain/value-objects/ticker.vo.ts

```typescript
export interface Ticker {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume24h: number;
  timestamp: Date;
}

export function createTicker(data: any, symbol: string): Ticker {
  return {
    symbol: symbol.toUpperCase(),
    bid: parseFloat(data.bidPrice || data.b),
    ask: parseFloat(data.askPrice || data.a),
    last: parseFloat(data.lastPrice || data.c),
    volume24h: parseFloat(data.volume || data.v),
    timestamp: new Date(data.closeTime || Date.now()),
  };
}
```

---

## domain/ports/exchange.port.ts

```typescript
import { Ticker, ExchangeConfig } from '../value-objects/exchange-config.vo';
import { Price } from '../../trade/shared/types';

export interface ExchangePort {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  
  getTicker(symbol: string): Promise<Price>;
  getMultipleTickers(symbols: string[]): Promise<Price[]>;
  
  subscribeToTicker(symbol: string, callback: (price: Price) => void): () => void;
  subscribeToMultipleTickers(symbols: string[], callback: (prices: Price[]) => void): () => void;
  
  getConfig(): ExchangeConfig;
}

export interface ExchangeFactoryPort {
  create(name: string, config?: Partial<ExchangeConfig>): ExchangePort;
  getSupportedExchanges(): string[];
}
```

---

## domain/errors/exchange-errors.ts

```typescript
export class ExchangeConnectionError extends Error {
  constructor(exchange: string, message: string) {
    super(`Failed to connect to ${exchange}: ${message}`);
    this.name = 'ExchangeConnectionError';
  }
}

export class SymbolNotFoundError extends Error {
  constructor(symbol: string, exchange: string) {
    super(`Symbol ${symbol} not found on ${exchange}`);
    this.name = 'SymbolNotFoundError';
  }
}

export class SubscriptionError extends Error {
  constructor(symbol: string, message: string) {
    super(`Failed to subscribe to ${symbol}: ${message}`);
    this.name = 'SubscriptionError';
  }
}
```

---

## infrastructure/adapters/binance/binance-rest.client.ts

```typescript
import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ExchangeConfig, ExchangeName } from '../../domain/value-objects/exchange-config.vo';
import { Price } from '../../../trade/shared/types';

@Injectable()
export class BinanceRestClient {
  private client: AxiosInstance;

  constructor(private config: ExchangeConfig) {
    this.client = axios.create({
      baseURL: config.restUrl,
      timeout: 10000,
    });
  }

  async getTicker(symbol: string): Promise<Price> {
    const response = await this.client.get('/api/v3/ticker/bookTicker', {
      params: { symbol: symbol.toUpperCase() },
    });

    const data = response.data;
    return {
      symbol: symbol.toUpperCase(),
      bid: parseFloat(data.bidPrice),
      ask: parseFloat(data.askPrice),
      last: (parseFloat(data.bidPrice) + parseFloat(data.askPrice)) / 2,
      timestamp: new Date(),
      exchange: 'binance',
    };
  }

  async getMultipleTickers(symbols: string[]): Promise<Price[]> {
    const response = await this.client.get('/api/v3/ticker/bookTicker', {
      params: { symbols: JSON.stringify(symbols.map(s => s.toUpperCase())) },
    });

    return response.data.map((data: any) => ({
      symbol: data.symbol,
      bid: parseFloat(data.bidPrice),
      ask: parseFloat(data.askPrice),
      last: (parseFloat(data.bidPrice) + parseFloat(data.askPrice)) / 2,
      timestamp: new Date(),
      exchange: 'binance',
    }));
  }

  async getKlines(symbol: string, interval: string, limit: number = 100) {
    const response = await this.client.get('/api/v3/klines', {
      params: {
        symbol: symbol.toUpperCase(),
        interval,
        limit,
      },
    });
    return response.data;
  }
}
```

---

## infrastructure/adapters/binance/binance-ws.client.ts

```typescript
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import WebSocket from 'ws';
import { Price } from '../../../trade/shared/types';

type PriceCallback = (price: Price) => void;

@Injectable()
export class BinanceWsClient implements OnModuleDestroy {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, Set<PriceCallback>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  async connect(wsUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        console.log('Binance WebSocket connected');
        this.reconnectAttempts = 0;
        this.resubscribe();
        resolve();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('error', (error) => {
        console.error('Binance WebSocket error:', error);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('Binance WebSocket closed');
        this.handleDisconnect();
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  subscribe(symbol: string, callback: PriceCallback): () => void {
    const upperSymbol = symbol.toUpperCase();
    
    if (!this.subscriptions.has(upperSymbol)) {
      this.subscriptions.set(upperSymbol, new Set());
    }
    
    this.subscriptions.get(upperSymbol)!.add(callback);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscribe([`${lowerSymbol}@ticker`]);
    }

    return () => {
      const callbacks = this.subscriptions.get(upperSymbol);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(upperSymbol);
          this.sendUnsubscribe([`${lowerSymbol}@ticker`]);
        }
      }
    };
  }

  private sendSubscribe(streams: string[]) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        method: 'SUBSCRIBE',
        params: streams,
        id: Date.now(),
      }));
    }
  }

  private sendUnsubscribe(streams: string[]) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        method: 'UNSUBSCRIBE',
        params: streams,
        id: Date.now(),
      }));
    }
  }

  private handleMessage(data: string) {
    try {
      const message = JSON.parse(data);

      if (message.e === '24hrTicker') {
        const price: Price = {
          symbol: message.s,
          bid: parseFloat(message.b),
          ask: parseFloat(message.a),
          last: parseFloat(message.c),
          timestamp: new Date(message.E),
          exchange: 'binance',
        };

        const callbacks = this.subscriptions.get(message.s);
        if (callbacks) {
          callbacks.forEach(cb => cb(price));
        }
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  private resubscribe() {
    const symbols = Array.from(this.subscriptions.keys());
    if (symbols.length > 0) {
      const streams = symbols.map(s => `${s.toLowerCase()}@ticker`);
      this.sendSubscribe(streams);
    }
  }

  private handleDisconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Reconnecting to Binance (attempt ${this.reconnectAttempts})...`);
      }, 1000 * this.reconnectAttempts);
    }
  }

  onModuleDestroy() {
    this.disconnect();
  }
}
```

---

## infrastructure/adapters/binance/binance-exchange.adapter.ts

```typescript
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ExchangePort } from '../../domain/ports/exchange.port';
import { ExchangeConfig, BINANCE_CONFIG } from '../../domain/value-objects/exchange-config.vo';
import { Price } from '../../../trade/shared/types';
import { BinanceRestClient } from './binance-rest.client';
import { BinanceWsClient } from './binance-ws.client';

@Injectable()
export class BinanceExchangeAdapter implements ExchangePort, OnModuleDestroy {
  private connected = false;

  constructor(
    private readonly restClient: BinanceRestClient,
    private readonly wsClient: BinanceWsClient,
    private config: ExchangeConfig = BINANCE_CONFIG,
  ) {}

  async connect(): Promise<void> {
    await this.wsClient.connect(this.config.wsUrl);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    await this.wsClient.disconnect();
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getTicker(symbol: string): Promise<Price> {
    return this.restClient.getTicker(symbol);
  }

  async getMultipleTickers(symbols: string[]): Promise<Price[]> {
    return this.restClient.getMultipleTickers(symbols);
  }

  subscribeToTicker(symbol: string, callback: (price: Price) => void): () => void {
    return this.wsClient.subscribe(symbol, callback);
  }

  subscribeToMultipleTickers(symbols: string[], callback: (prices: Price[]) => void): () => void {
    const unsubscribers: (() => void)[] = [];
    
    symbols.forEach(symbol => {
      const unsub = this.wsClient.subscribe(symbol, (price) => {
        const existing = this.getCachedPrice(symbol);
        if (existing) {
          callback([...existing, price]);
        } else {
          callback([price]);
        }
      });
      unsubscribers.push(unsub);
    });

    return () => unsubscribers.forEach(unsub => unsub());
  }

  getConfig(): ExchangeConfig {
    return this.config;
  }

  private cachedPrices: Map<string, Price> = new Map();

  private getCachedPrice(symbol: string): Price[] {
    const price = this.cachedPrices.get(symbol.toUpperCase());
    return price ? [price] : [];
  }
}
```

---

## infrastructure/adapters/bybit/bybit-exchange.adapter.ts

```typescript
import { Injectable } from '@nestjs/common';
import { ExchangePort } from '../../domain/ports/exchange.port';
import { ExchangeConfig } from '../../domain/value-objects/exchange-config.vo';
import { Price } from '../../../trade/shared/types';

@Injectable()
export class BybitExchangeAdapter implements ExchangePort {
  private connected = false;
  private config: ExchangeConfig = {
    name: 'bybit',
    restUrl: 'https://api.bybit.com',
    wsUrl: 'wss://stream.bybit.com/v5/public/spot',
    testnet: false,
  };

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getTicker(symbol: string): Promise<Price> {
    throw new Error('Not implemented - use REST client');
  }

  async getMultipleTickers(symbols: string[]): Promise<Price[]> {
    throw new Error('Not implemented - use REST client');
  }

  subscribeToTicker(symbol: string, callback: (price: Price) => void): () => void {
    throw new Error('Not implemented - WebSocket client needed');
  }

  subscribeToMultipleTickers(symbols: string[], callback: (prices: Price[]) => void): () => void {
    throw new Error('Not implemented - WebSocket client needed');
  }

  getConfig(): ExchangeConfig {
    return this.config;
  }
}
```

---

## application/commands/connect-exchange.command.ts

```typescript
import { ICommand } from '@nestjs/cqrs';
import { ExchangeName } from '../../domain/value-objects/exchange-config.vo';

export class ConnectExchangeCommand implements ICommand {
  constructor(
    public readonly exchangeName: ExchangeName,
    public readonly testnet?: boolean,
  ) {}
}
```

---

## Module Configuration

```typescript
// price.exchange.module.ts
import { Module } from '@nestjs/common';
import { BinanceExchangeAdapter } from './infrastructure/adapters/binance/binance-exchange.adapter';
import { BinanceRestClient } from './infrastructure/adapters/binance/binance-rest.client';
import { BinanceWsClient } from './infrastructure/adapters/binance/binance-ws.client';
import { BybitExchangeAdapter } from './infrastructure/adapters/bybit/bybit-exchange.adapter';

@Module({
  providers: [
    BinanceRestClient,
    BinanceWsClient,
    BinanceExchangeAdapter,
    BybitExchangeAdapter,
  ],
  exports: [
    BinanceExchangeAdapter,
    BybitExchangeAdapter,
  ],
})
export class PriceExchangeModule {}
```

---

## Usage Example

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { BinanceExchangeAdapter } from './adapters/binance/binance-exchange.adapter';
import { Price } from '../../trade/shared/types';

@Injectable()
export class PriceService implements OnModuleInit {
  private unsubscribe: (() => void) | null = null;

  constructor(private readonly binance: BinanceExchangeAdapter) {}

  async onModuleInit() {
    await this.binance.connect();
  }

  async getPrice(symbol: string): Promise<Price> {
    return this.binance.getTicker(symbol);
  }

  subscribeToSymbol(symbol: string, callback: (price: Price) => void) {
    this.unsubscribe = this.binance.subscribeToTicker(symbol, callback);
  }

  onModuleDestroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this.binance.disconnect();
  }
}
```

---

## Event Flow

```
price/exchange (this context)
       │
       ├── BinanceExchangeAdapter ──► price/stream (uses ExchangePort)
       │
       ├── BybitExchangeAdapter ──► future: price/stream
       │
       └── KuCoinExchangeAdapter ──► future: price/stream
```

---

## Dependencies

```json
{
  "@nestjs/common": "^10.0.0",
  "@nestjs/core": "^10.0.0",
  "@nestjs/cqrs": "^10.0.0",
  "axios": "^1.6.0",
  "ws": "^8.14.0"
}
```

---

## Next Context

After completing `price/exchange`, proceed to **price/stream** to stream prices using exchange adapter.