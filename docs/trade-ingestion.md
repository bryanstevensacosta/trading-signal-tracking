# Trade Ingestion

Responsibility: Receive and preprocess trade messages from Telegram (direct and forwarded).

> Uses types from `trade-shared.md`

## Sources

- Direct messages from user
- Forwarded messages from channels
- Forwarded messages from groups

## Directory Structure

```
src/trade/ingestion/
├── domain/
│   ├── entities/
│   ├── ports/
│   ├── value-objects/
│   ├── services/
│   └── events/
├── application/
│   ├── commands/
│   ├── event-handlers/
│   └── queries/
└── infrastructure/
```

## Dependencies

- **trade-parsing**: Uses `ParserPort` to extract trade data from text

## Services

**MessageFilterService**
- Filters empty messages
- Filters non-trade content (commands, bot responses)
- Pre-validates message format before parsing

## Domain

### Entities

**IncomingMessage**
- `messageId`: string
- `text`: string
- `from`: User | Channel | Group
- `forwardedFrom`: Channel | Group | null
- `timestamp`: Date

### Value Objects

**MessageSource**
- `type`: 'direct' | 'forwarded_channel' | 'forwarded_group'
- `chatId`: number
- `messageId`: number

See `trade-parsing.md` for parsed data structure

### Events

See `trade-shared.md` for common event definitions.

**TradeReceivedEvent**
- Emitted when a valid trade message is received
- Payload: `IncomingMessage`, `ParsedTradeData`

**InvalidMessageEvent**
- Emitted when message cannot be parsed (malformed data)
- Payload: `IncomingMessage`, `error: string`

**MessageNotATradeEvent**
- Emitted when message is valid but not a trade (filtered out)
- Payload: `IncomingMessage`

## Application

### Commands

**IngestMessageCommand**
- Input: `IncomingMessage`
- Output: `TradeReceivedEvent` | `InvalidMessageEvent`

### Event Handlers

**OnTradeReceived**
- Calls parser
- Validates parsed data
- Emits `TradeReceivedEvent` to be consumed by other contexts

## Infrastructure

### Adapters

**TelegramIngestionAdapter**
- Listens to Telegram Bot API updates (private, groups, channels)
- Converts Telegram messages to `IncomingMessage`
- Filters non-trade messages

See `trade-parsing.md` for supported formats and validation rules