# Trade Parsing

Responsibility: Extract trade data from text messages using regex and basic NLP.

> Uses types from `trade-shared.md`

## Directory Structure

```
src/trade/parsing/
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
├── infrastructure/
│   └── adapters/
```

## Domain

### Value Objects

See `trade-shared.md` for `ParsedTradeData` and `ParseResult` definitions.

### Ports

**ParserPort** (inbound)
- `parse(text: string): ParseResult`

### Services

**TradeParserService**
- Regex-based extraction
- Handles format variations
- Validates numeric values
- Normalizes symbol format

## Application

### Commands

**ParseTradeCommand**
- Input: `text: string`
- Output: `ParseResult`

## Infrastructure

### Adapters

**RegexParserAdapter**
- Primary implementation
- Regex patterns for: symbol, side, entry, SL, TPs
- Also extracts: chartUrl (from URL or `chart:` prefix), notes (from `note:`/`notes:` prefix)
- Handles format variations: A, B, C

**NLPEnhancementAdapter** (optional)
- Fallback for complex cases
- Improves fuzzy matching

## Supported Formats

### Format A: Full Text
```
LONG BTCUSDT
Entry: 105000
SL: 103800
TP1: 106500
TP2: 108000

SHORT ETHUSDT
Entry: 3200
SL: 3150
TP: 3300

SPOT BNBUSDT
Entry: 680
```

### Format B: Single Line (Compact)
```
BTCUSDT 80000 70000 95000 100000.55 100344.3
```
- Order: symbol, entry, SL, TP1, TP2, ...
- Side inferred: SL < entry = LONG/SPOT, SL > entry = SHORT

### Format C: With Chart URL & Notes
```
LONG BTCUSDT
Entry: 80000
SL: 70000
TP1: 95000
TP2: 100000
chart: https://tradingview.com/xxx
note: Waiting for trend confirmation
```

## Validation Rules

1. Must contain symbol (e.g., BTCUSDT)
2. Must contain side (LONG/SHORT/SPOT) - or infer from SL position
3. Must contain entry (price)
4. SL and TP are optional
5. Entry must be valid number
6. SL must be below entry (LONG/SPOT) or above (SHORT)
7. In compact format: SL is required to infer side

## Notes

- Entry is required; SL and TP are optional
- TP supports multiple (TP1, TP2, TP3, ...)
- Entry can be range (entry_min - entry_max) or single price
- Symbol normalization: uppercase, remove spaces
- Chart URL: extracted from standalone URL or `chart:` prefix
- Notes: extracted from `note:` or `notes:` prefix
- URL normalization: validate format, remove tracking params