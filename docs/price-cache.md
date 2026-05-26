# Price Cache

Responsibility: In-memory cache for current prices, accessible by symbol.

> Uses types from `trade-shared.md`

## Directory Structure

```
src/price/cache/
├── domain/
│   ├── value-objects/
│   ├── ports/
│   └── events/
├── application/
│   ├── commands/
│   └── queries/
└── infrastructure/
```

## Domain

### Value Objects

See `trade-shared.md` for `Price` definition.

### Ports

**PriceCachePort** (inbound)
- `set(symbol: string, price: Price): void`
- `get(symbol: string): Price | null`
- `getAll(): Map<string, Price>`
- `has(symbol: string): boolean`
- `remove(symbol: string): void`

**PriceStreamPort** (outbound)
- `subscribeToPriceUpdates(callback: (price: Price) => void): void`

### Events

**PriceUpdatedEvent**
- Re-emitted from stream for caching

## Application

### Commands

**SetPriceCommand**
- Input: `symbol`, `price`

**RemovePriceCommand**
- Input: `symbol`

### Queries

**GetPriceQuery**
- Input: `symbol`
- Output: `Price | null`

**GetAllPricesQuery**
- Output: `Map<string, Price>`

## Infrastructure

### Adapters

**InMemoryPriceCache**
- Simple Map<string, Price>
- TTL not needed (prices update frequently)

## Usage

- Trade state uses cache to get current price
- Telegram command can query current price via cache
- Cache subscribes to price stream events

## Notes

- In-memory only (lost on restart)
- Prices update frequently so no need for TTL
- Thread-safe access (if needed)