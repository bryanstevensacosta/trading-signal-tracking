# Binance Exchange Adapter

Responsibility: Connect to Binance API for Spot and USD-M Futures (Perpetual).

## Important: Spot vs Futures

| side | marketType | Description |
|------|------------|-------------|
| `LONG` | `futures` | Long position in USD-M perpetual futures |
| `SHORT` | `futures` | Short position in USD-M perpetual futures |
| `BUY` | `spot` | Buy order in spot market |
| `SELL` | `spot` | Sell order in spot market |

**LONG/SHORT = Futures Perpetuos (USD-M)**
**BUY/SELL = Spot Market**

---

## Base URLs

| API | URL |
|-----|-----|
| Spot REST | `https://api.binance.com` |
| Spot WebSocket | `wss://stream.binance.com:9443/ws` |
| USD-M Futures REST | `https://fapi.binance.com` |
| USD-M Futures WebSocket | `wss://fstream.binance.com/ws` |
| Combined Stream (Spot) | `wss://stream.binance.com:9443/stream` |
| Combined Stream (Futures) | `wss://fstream.binance.com/stream` |
| Data-only Stream | `wss://data-stream.binance.vision/ws` |

---

## Spot API

### REST Endpoints

#### Market Data (Public)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v3/ticker/price` | GET | Current price |
| `/api/v3/ticker/bookTicker` | GET | Best bid/ask |
| `/api/v3/depth` | GET | Order book |
| `/api/v3/klines` | GET | Klines/candlesticks |
| `/api/v3/exchangeInfo` | GET | Exchange info |

#### Order Data (Private - Not implemented)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v3/order` | POST | Place order |
| `/api/v3/order` | DELETE | Cancel order |
| `/api/v3/orderBook` | GET | Order book |

### REST Examples

```bash
# Get current price
GET /api/v3/ticker/price?symbol=BTCUSDT

Response:
{
  "symbol": "BTCUSDT",
  "price": "50000.00000000"
}

# Get best bid/ask
GET /api/v3/ticker/bookTicker?symbol=BTCUSDT

Response:
{
  "symbol": "BTCUSDT",
  "bidPrice": "49999.00000000",
  "bidQty": "1.50000000",
  "askPrice": "50000.00000000",
  "askQty": "2.50000000"
}

# Get 24hr ticker
GET /api/v3/ticker/24hr?symbol=BTCUSDT

Response:
{
  "symbol": "BTCUSDT",
  "priceChange": "-100.00",
  "priceChangePercent": "-0.20",
  "lastPrice": "50000.00",
  "bidPrice": "49999.00",
  "askPrice": "50000.00",
  "openPrice": "50100.00",
  "highPrice": "50200.00",
  "lowPrice": "49900.00",
  "volume": "10000.00",
  "quoteVolume": "500000000.00"
}
```

### WebSocket Streams

| Stream | Description |
|--------|-------------|
| `<symbol>@ticker` | 24hr ticker |
| `<symbol>@trade` | Trade ticks (individual) |
| `<symbol>@aggTrade` | Aggregated trades |
| `<symbol>@depth` | Order book (1000 levels) |
| `<symbol>@depth@100ms` | Order book (100ms updates) |
| `<symbol>@kline_1m` | Klines (1 minute) |
| `<symbol>@kline_5m` | Klines (5 minutes) |

### WebSocket Example

```javascript
// Single stream
const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@ticker');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
};

// Combined stream (multiple symbols, single connection)
const ws = new WebSocket('wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/ethusdt@ticker');

// Response format (combined stream)
{
  "stream": "btcusdt@ticker",
  "data": {
    "e": "24hrTicker",
    "s": "BTCUSDT",
    "c": "50000.00",
    "b": "49999.00",
    "a": "50000.00",
    "v": "10000.00"
  }
}
```

---

## USD-M Futures API

### REST Endpoints

#### Market Data (Public)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/fapi/v1/ticker/24hr` | GET | 24hr ticker |
| `/fapi/v1/ticker/price` | GET | Current price |
| `/fapi/v1/ticker/bookTicker` | GET | Best bid/ask |
| `/fapi/v1/depth` | GET | Order book |
| `/fapi/v1/klines` | GET | Klines |
| `/fapi/v1/exchangeInfo` | GET | Exchange info |
| `/fapi/v1/premiumIndexPrice` | GET | Mark price |
| `/fapi/v1/fundingRate` | GET | Current funding rate |

### REST Examples

```bash
# Get 24hr ticker (Futures)
GET /fapi/v1/ticker/24hr?symbol=BTCUSDT

Response:
{
  "symbol": "BTCUSDT",
  "priceChange": "-100.00",
  "priceChangePercent": "-0.20",
  "lastPrice": "50000.00",
  "bidPrice": "49999.00",
  "askPrice": "50000.00",
  "openPrice": "50100.00",
  "highPrice": "50200.00",
  "lowPrice": "49900.00",
  "volume": "10000.00",
  "quoteVolume": "500000000.00"
}

# Get mark price (for funding calculation)
GET /fapi/v1/premiumIndexPrice?symbol=BTCUSDT

Response:
{
  "symbol": "BTCUSDT",
  "markPrice": "50000.00",
  "indexPrice": "49995.00",
  "estimatedSettlePrice": "50000.00",
  "lastFundingRate": "0.0001",
  "nextFundingTime": "1704067200000"
}

# Get funding rate
GET /fapi/v1/fundingRate?symbol=BTCUSDT

Response:
{
  "symbol": "BTCUSDT",
  "fundingRate": "0.0001",
  "fundingTime": "1704067200000"
}
```

### WebSocket Streams

| Stream | Description |
|--------|-------------|
| `<symbol>@ticker` | 24hr ticker |
| `<symbol>@aggTrade` | Aggregated trades |
| `<symbol>@trade` | Trade ticks |
| `<symbol>@depth` | Order book |
| `<symbol>@depth@100ms` | Order book (100ms updates) |
| `<symbol>@kline_1m` | Klines |
| `<symbol>@markPrice` | Mark price updates |
| `<symbol>@markPrice@1s` | Mark price (1s updates) |
| `!forceOrder@arr` | Liquidation orders |

### WebSocket Example

```javascript
// USD-M Futures WebSocket
const ws = new WebSocket('wss://fstream.binance.com/ws/btcusdt@ticker');

// Combined stream (futures)
const ws = new WebSocket('wss://fstream.binance.com/stream?streams=btcusdt@ticker/btcusdt@markPrice');

// Mark price stream
const ws = new WebSocket('wss://fstream.binance.com/ws/btcusdt@markPrice');

// Liquidation stream (all symbols)
const ws = new WebSocket('wss://fstream.binance.com/ws/!forceOrder@arr');
```

---

## Order Types (Enums)

From: https://developers.binance.com/docs/binance-spot-api-docs/enums

### Order Types (orderTypes, type)

| Type | Description |
|------|-------------|
| `LIMIT` | Limit order |
| `MARKET` | Market order |
| `STOP_LOSS` | Stop loss order |
| `STOP_LOSS_LIMIT` | Stop loss limit order |
| `TAKE_PROFIT` | Take profit order |
| `TAKE_PROFIT_LIMIT` | Take profit limit order |
| `LIMIT_MAKER` | Limit maker order |

### Order Side (side)

| Side | Description |
|------|-------------|
| `BUY` | Buy order (Spot) |
| `SELL` | Sell order (Spot) |

### Time in Force (timeInForce)

| Status | Description |
|--------|-------------|
| `GTC` | Good Til Canceled - Order stays on book until canceled |
| `IOC` | Immediate Or Cancel - Fill as much as possible, cancel rest |
| `FOK` | Fill or Kill - Entire order must fill or cancel |

### Execution Types (status)

| Status | Description |
|--------|-------------|
| `NEW` | Order accepted into engine |
| `CANCELED` | Order canceled by user |
| `REPLACED` | Order amended |
| `REJECTED` | Order rejected, not processed |
| `TRADE` | Part or all of order filled |
| `EXPIRED` | Order expired (FOK with no fill, IOC partial, maintenance cancel) |
| `TRADE_PREVENTION` | Order expired due to STP |

---

## Rate Limits

### Spot Rate Limits

| Rate Limit Type | Interval | Limit |
|-----------------|----------|-------|
| `REQUEST_WEIGHT` | MINUTE | 6,000 |
| `ORDERS` | SECOND | 10 |
| `ORDERS` | DAY | 200,000 |
| `RAW_REQUESTS` | MINUTE | 6,100 |

### Futures USD-M Rate Limits

| Rate Limit Type | Interval | Limit |
|-----------------|----------|-------|
| `REQUEST_WEIGHT` | MINUTE | 6,000 |
| `ORDERS` | SECOND | 10 |
| `ORDERS` | MINUTE | 1,200 |
| `RAW_REQUESTS` | 5 MINUTE | 61,000 |

### WebSocket Limits

| Type | Limit |
|------|-------|
| Streams per connection | 1,024 |
| Messages per second (inbound) | 5 |
| Connection duration | 24 hours (reconnect required) |

---

## Connection Management

### WebSocket Lifecycle

```typescript
class BinanceWebSocket {
  private ws: WebSocket;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.getUrl());

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.subscribe();
        resolve();
      };

      this.ws.onclose = () => {
        this.handleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };
    });
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      this.connect();
    }, delay);
  }
}
```

### Subscribe/Unsubscribe

```typescript
// Subscribe to streams
this.ws.send(JSON.stringify({
  method: 'SUBSCRIBE',
  params: ['btcusdt@ticker', 'ethusdt@ticker'],
  id: Date.now()
}));

// Unsubscribe from streams
this.ws.send(JSON.stringify({
  method: 'UNSUBSCRIBE',
  params: ['btcusdt@ticker'],
  id: Date.now()
}));

// Response format
// Success: {"result":null,"id":123456789}
// Error: {"error": {"code": -1005, "msg": "Invalid stream name"}, "id": 123456789}
```

---

## Error Codes

### Common Spot Errors

| Code | Message |
|------|---------|
| -1000 | Unknown error |
| -1001 | Internal error |
| -1002 | Unauthorized |
| -1003 | Too many requests |
| -1015 | Rate limit exceeded |
| -1020 | Invalid signature |
| -1103 | Invalid parameter |
| -2019 | Balance insufficient |
| -2010 | Account has insufficient balance |
| -2015 | Unauthorized access |

### Common Futures Errors

| Code | Message |
|------|---------|
| -1000 | Unknown error |
| -1001 | Internal error |
| -1111 | Precision is over the maximum defined for this asset |
| -2019 | Margin is insufficient |
| -2020 | Order would immediately trigger and breach |
| -2021 | Reduce only order failed |

---

## Symbol Format

| Type | Format | Example |
|------|--------|---------|
| Spot | `<base><quote>` | BTCUSDT, ETHUSDT |
| Futures USD-M | `<base><quote>` | BTCUSDT, ETHUSDT |

**Note:** Most symbols use same format across spot and futures, but not all symbols exist in both markets.

### Symbol Validation

```typescript
// Check if symbol exists in spot
GET /api/v3/exchangeInfo?symbol=BTCUSDT

// Check if symbol exists in futures
GET /fapi/v1/exchangeInfo?symbol=BTCUSDT

// Returns 400 if symbol not found
```

---

## Unified Price Format

```typescript
interface ExchangePrice {
  symbol: string;
  bid: number;      // Best bid price
  ask: number;      // Best ask price
  last: number;     // Last price
  timestamp: Date;
  exchange: 'binance';
  marketType: 'spot' | 'futures';
}
```

### Normalization

```typescript
// Spot response (24hr ticker)
{
  "s": "BTCUSDT",  // symbol
  "b": "49999.00", // best bid
  "a": "50000.00", // best ask
  "c": "50000.00"  // last price (close)
}
// → { symbol: "BTCUSDT", bid: 49999, ask: 50000, last: 50000, marketType: "spot" }

// Futures response (24hr ticker)
{
  "s": "BTCUSDT",
  "b": "49999.00",
  "a": "50000.00",
  "c": "50000.00"
}
// → { symbol: "BTCUSDT", bid: 49999, ask: 50000, last: 50000, marketType: "futures" }
```

---

## Market Detection

```typescript
enum TradeSide {
  BUY = 'BUY',     // Spot buy
  SELL = 'SELL',   // Spot sell
  LONG = 'LONG',   // Futures long
  SHORT = 'SHORT', // Futures short
}

function getMarketType(side: TradeSide): 'spot' | 'futures' {
  return (side === 'LONG' || side === 'SHORT') ? 'futures' : 'spot';
}

// For legacy trades without side:
// - Check if symbol exists in spot vs futures
// - If exists in both, default to futures (common for trading signals)
```

---

## Notes

- WebSocket preferred over REST for real-time prices
- Use combined streams for multiple symbols (single connection, up to 1024 streams)
- Implement heartbeat/ping-pong for connection health
- Handle rate limits with exponential backoff
- Futures and Spot have separate rate limits
- Mark price from futures is used for funding calculations
- Liquidation stream (`!forceOrder@arr`) notifies of force liquidations