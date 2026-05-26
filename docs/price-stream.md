# Price Stream

Responsibility: Manage WebSocket connections to Binance and stream real-time prices.

> Uses types from `trade-shared.md`

## Directory Structure

```
src/price/stream/
├── domain/
│   ├── value-objects/
│   ├── services/
│   ├── ports/
│   └── events/
├── application/
│   ├── commands/
│   └── queries/
└── infrastructure/
    └── adapters/
```

## Domain

### Value Objects

See `trade-shared.md` for `Price` definition.

### Services

**WebSocketService**
- Manages WebSocket connections
- Handles subscriptions/unsubscriptions
- Implements reconnection logic
- Rate limiting

### Ports

**PriceStreamPort** (inbound)
- `subscribe(symbols: string[]): void`
- `unsubscribe(symbols: string[]): void`

**PriceCachePort** (outbound)
- `setPrice(symbol: string, price: Price): void`

### Events

**PriceUpdatedEvent**
- Emitted when price changes
- Payload: `symbol`, `price`, `timestamp`

## Application

### Commands

**SubscribeSymbolsCommand**
- Input: `symbols: string[]`

**UnsubscribeSymbolsCommand**
- Input: `symbols: string[]`

### Queries

**GetSubscribedSymbolsQuery**
- Output: `string[]`

## Infrastructure

### Adapters

Uses exchange adapters from `price-exchange`:
- `BinanceExchangeAdapter` (see `exchange-binance.md`)
- Can switch between exchanges via configuration

### Integration with Exchange

```
price/stream
    ↓ uses
price/exchange → ExchangePort
    ↓ implements
BinanceExchangeAdapter
```

The stream service uses `ExchangePort` from `price-exchange` - it doesn't know which exchange is being used.

## WebSocket Connection

### Binance Streams
```
wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/ethusdt@ticker
```

### Connection Flow
```
1. Connect to WebSocket
2. Subscribe to symbols
3. Listen for price updates
4. On price update → emit PriceUpdatedEvent
5. On disconnect → reconnect
```

### Reconnection Strategy
- Initial delay: 1s
- Max delay: 30s
- Backoff multiplier: 2x

## Notes

- One WebSocket connection for all symbols
- Emit PriceUpdatedEvent on every tick
- Handle rate limits from Binance
- Monitor connection health