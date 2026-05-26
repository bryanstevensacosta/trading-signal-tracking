# Price Exchange

Responsibility: Manage exchange adapters (Binance, Bybit, KuCoin, etc.) with a generic interface.

> Uses types from `trade-shared.md`

## Directory Structure

```
src/price/exchange/
├── domain/
│   ├── ports/
│   │   └── ExchangePort
│   └── value-objects/
│       └── ExchangePrice
├── application/
│   └── commands/
└── infrastructure/
    └── adapters/
        ├── binance/
        ├── bybit/
        └── kucoin/
```

## Domain

### Value Objects

**ExchangeConfig**
- `name`: string
- `wsUrl`: string
- `restUrl`: string
- `reconnect`: boolean

Note: Uses `Price` from `trade-shared.md` - the `exchange` field is optional.

### Ports

**ExchangePort** (inbound)
- `connect(): Promise<void>`
- `disconnect(): void`
- `subscribe(symbols: string[]): void`
- `unsubscribe(symbols: string[]): void`
- `getName(): string`
- `isConnected(): boolean`

**ExchangePricePort** (outbound)
- `onPriceUpdate(callback: (price: ExchangePrice) => void): void`
- `onDisconnect(callback: () => void): void`
- `onError(callback: (error: Error) => void): void`

### Events

**ExchangeConnectedEvent**
**ExchangeDisconnectedEvent**
**ExchangeErrorEvent**
**ExchangePriceUpdateEvent**

## Application

### Commands

**ConnectExchangeCommand**
- Input: `exchangeName: string`
- Connects to specified exchange

**SubscribeSymbolsCommand**
- Input: `symbols: string[]`

**SwitchExchangeCommand**
- Input: `fromExchange`, `toExchange`
- Switches active exchange

## Infrastructure

### Adapters

**BinanceExchangeAdapter**
- Implements `ExchangePort`
- WebSocket: `wss://stream.binance.com:9443/ws` (Spot), `wss://fstream.binance.com/ws` (Futures)
- REST: `https://api.binance.com` (Spot), `https://fapi.binance.com` (Futures)
- Stream format: `<symbol>@ticker`
- See: `exchange-binance.md`

**BybitExchangeAdapter**
- Implements `ExchangePort`
- WebSocket: `wss://stream.bybit.com/v5/public/spot`
- Stream format: `tickers.<symbol>`

**KuCoinExchangeAdapter**
- Implements `ExchangePort`
- WebSocket: `wss://ws-api-spot.kucoin.com`
- Stream format: `/market/ticker:<symbol>`

## Supported Exchanges

| Exchange | Status | WebSocket URL |
|----------|--------|--------------|
| Binance | ✅ Primary | wss://stream.binance.com:9443/ws |
| Bybit | 🔄 Future | wss://stream.bybit.com/v5/public/spot |
| KuCoin | 🔄 Future | wss://ws-api-spot.kucoin.com |

## Exchange Adapter Template

```typescript
@Injectable()
export class BinanceExchangeAdapter implements ExchangePort {
  private ws: WebSocket;
  private connected = false;
  private subscriptions = new Set<string>();

  async connect(): Promise<void> {
    // Connect to WebSocket
  }

  disconnect(): void {
    this.ws.close();
    this.connected = false;
  }

  subscribe(symbols: string[]): void {
    // Send subscription message
  }

  unsubscribe(symbols: string[]): void {
    // Send unsubscription message
  }

  getName(): string {
    return 'binance';
  }

  isConnected(): boolean {
    return this.connected;
  }
}
```

## Usage in price/stream

```typescript
// Inject generic ExchangePort
constructor(
  @Inject('EXCHANGE_PORT') private exchange: ExchangePort
) {}

// Stream service uses exchange port - doesn't know which exchange
this.exchange.subscribe(['BTCUSDT', 'ETHUSDT']);
this.exchange.onPriceUpdate((price) => {
  this.emitter.emit('priceUpdate', price);
});
```

## Adding New Exchange

1. Create `src/price/exchange/infrastructure/adapters/[exchange-name]/`
2. Implement `ExchangePort`
3. Register in module
4. Add to config

## Configuration

```typescript
// config/exchanges.ts
export const exchanges = {
  binance: {
    name: 'binance',
    wsUrl: 'wss://stream.binance.com:9443/ws',
    enabled: true,
  },
  bybit: {
    name: 'bybit',
    wsUrl: 'wss://stream.bybit.com/v5/public/spot',
    enabled: false,
  },
};
```

## Notes

- All adapters must implement same interface
- Normalize price format across exchanges
- Handle exchange-specific message formats
- Implement reconnection in each adapter
- Rate limit handling per exchange