# Trade Repository

Responsibility: Persist and retrieve trades from SQLite.

> Uses types from `trade-shared.md`

## Directory Structure

```
src/trade/repository/
├── domain/
│   ├── ports/
│   │   └── TradeRepositoryPort
│   └── events/
│       └── TradeCreatedEvent
├── application/
│   ├── commands/
│   │   └── SaveTradeCommand
│   │   └── UpdateTradeCommand
│   │   └── DeleteTradeCommand
│   └── queries/
│       └── GetTradeByIdQuery
│       └── GetAllTradesQuery
│       └── GetActiveTradesQuery
└── infrastructure/
    └── adapters/
        └── SQLiteTradeAdapter
```

## Domain

### Ports

**TradeRepositoryPort** (inbound)
```typescript
interface TradeRepositoryPort {
  save(trade: Trade): Promise<Trade>;
  findById(id: string): Promise<Trade | null>;
  findAll(): Promise<Trade[]>;
  findByStatus(status: TradeStatus): Promise<Trade[]>;
  findActive(): Promise<Trade[]>;
  update(trade: Trade): Promise<Trade>;
  delete(id: string): Promise<void>;
}
```

### Events

**TradeSavedEvent**
- Emitted when trade is saved
- Payload: `trade`

## Application

### Commands

**SaveTradeCommand**
- Input: `ParsedTradeData`, `source`
- Output: `Trade`

**UpdateTradeCommand**
- Input: `Trade`
- Output: `Trade`

**DeleteTradeCommand**
- Input: `id: string`
- Output: `void`

### Queries

**GetTradeByIdQuery**
- Input: `id: string`
- Output: `Trade | null`

**GetAllTradesQuery**
- Output: `Trade[]`

**GetActiveTradesQuery**
- Output: `Trade[]`

**GetTradesByStatusQuery**
- Input: `status: TradeStatus`
- Output: `Trade[]`

## Infrastructure

### Adapters

**SQLiteTradeAdapter**
- Implements `TradeRepositoryPort`
- Table: `trades`
- Auto-migrations

## Database Schema

```sql
CREATE TABLE trades (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  entry REAL NOT NULL,
  entry_max REAL,
  sl REAL,
  tps TEXT,  -- JSON array
  chart_url TEXT,
  notes TEXT,
  status TEXT NOT NULL,
  source_message TEXT,
  source_chat INTEGER,
  tps_hit TEXT,  -- JSON array of indices
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  closed_at TEXT
);
```

## Notes

- Uses `Trade` and `TradeStatus` from `trade-shared.md`
- Does NOT define TradeStatus locally - imports from shared
- Uses types from `trade-shared.md`