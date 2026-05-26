# trade/parsing Implementation Guide

Implementation details for `src/trade/parsing/` - extract trade data from text messages.

---

## Directory Structure

```
src/trade/parsing/
├── domain/
│   ├── ports/
│   │   ├── parser.port.ts              # Interface for parser
│   │   └── index.ts
│   ├── services/
│   │   ├── parser.service.ts           # Main parsing service
│   │   └── index.ts
│   └── errors/
│       └── parsing-errors.ts           # Custom exceptions
├── application/
│   ├── commands/
│   │   ├── parse-trade.command.ts
│   │   └── index.ts
│   ├── handlers/
│   │   └── parse-trade.handler.ts
│   └── index.ts
├── infrastructure/
│   └── adapters/
│       ├── regex-parser.adapter.ts     # Regex-based implementation
│       ├── nlp-enhancement.adapter.ts  # Optional NLP improvements
│       └── index.ts
├── patterns/
│   ├── trade-patterns.ts               # Regex patterns for each field
│   └── index.ts
├── validation/
│   ├── trade-validator.ts             # Business validation
│   └── index.ts
└── index.ts
```

---

## patterns/trade-patterns.ts

```typescript
export const TRADE_PATTERNS = {
  symbol: {
    // BTCUSDT, ETHUSDT, SOLUSDT, etc.
    pattern: /([A-Z]{2,10})(USDT|USD|BTC|ETH)/i,
    group: 0,
  },
  side: {
    // LONG, SHORT, SPOT
    pattern: /(?:^|\s)(LONG|SHORT|SPOT)(?:$|\s)/i,
    group: 1,
  },
  entry: {
    // Entry price: 50000, entry: 50000, entry: 50.5
    pattern: /(?:entry|entry price|buy price)[:\s]*([\d,.]+)/i,
    group: 1,
  },
  entryMax: {
    // Entry max, max entry, entry range
    pattern: /(?:entry\s*max|max\s*entry|entry\s*range)[:\s]*([\d,.]+)/i,
    group: 1,
  },
  sl: {
    // SL: 49000, stop loss: 49000, sl: 49.5
    pattern: /(?:sl|stop\s*loss)[:\s]*([\d,.]+)/i,
    group: 1,
  },
  tp: {
    // TP: 51000, take profit: 51000, tp1: 51000
    pattern: /(?:tp\d*|take\s*profit)[:\s]*([\d,.]+)/gi,
    group: 1,
  },
  chart: {
    // chart:, chart url:, !chart
    pattern: /(?:chart|chart\s*url|img|image)[:\s]*(https?:\/\/[^\s]+)/i,
    group: 1,
  },
  notes: {
    // notes:, comment:, reason:
    pattern: /(?:notes?|comment|reason)[:]\s*(.+)/i,
    group: 1,
  },
  quantity: {
    // Qty: 0.1, amount: 0.5, size: 1
    pattern: /(?:qty|quantity|amount|size)[:\s]*([\d,.]+)/i,
    group: 1,
  },
  leverage: {
    // 10x, 20x, leverage: 10
    pattern: /(\d+)\s*x|leverage[:\s]*(\d+)/i,
    group: 1,
  },
} as const;

export function extractField(
  text: string,
  pattern: RegExp,
  group: number = 1
): string | null {
  const match = text.match(pattern);
  if (match && match[group]) {
    return match[group].trim();
  }
  return null;
}
```

---

## validation/trade-validator.ts

```typescript
import { TradeSide, TradeStatus } from '../shared/types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class TradeValidator {
  validateSymbol(symbol: string | null): ValidationResult {
    if (!symbol) {
      return { valid: false, errors: ['Symbol is required'] };
    }
    
    const validPairs = ['USDT', 'USD', 'BTC', 'ETH'];
    const hasValidPair = validPairs.some(pair => 
      symbol.toUpperCase().endsWith(pair)
    );
    
    if (!hasValidPair) {
      return { valid: false, errors: ['Symbol must end with USDT, USD, BTC, or ETH'] };
    }
    
    return { valid: true, errors: [] };
  }

  validateEntry(entry: number | null): ValidationResult {
    if (entry === null) {
      return { valid: false, errors: ['Entry price is required'] };
    }
    
    if (entry <= 0) {
      return { valid: false, errors: ['Entry price must be positive'] };
    }
    
    return { valid: true, errors: [] };
  }

  validateSL(entry: number, sl: number | null): ValidationResult {
    if (sl === null) {
      return { valid: true, errors: [] }; // SL is optional
    }
    
    if (sl <= 0) {
      return { valid: false, errors: ['SL must be positive'] };
    }
    
    return { valid: true, errors: [] };
  }

  validateTPs(entry: number, tps: number[] | null): ValidationResult {
    if (!tps || tps.length === 0) {
      return { valid: true, errors: [] }; // TPs are optional
    }
    
    const errors: string[] = [];
    
    tps.forEach((tp, index) => {
      if (tp <= 0) {
        errors.push(`TP${index + 1} must be positive`);
      }
    });
    
    return { valid: errors.length === 0, errors };
  }

  validateTrade(
    symbol: string | null,
    side: TradeSide | null,
    entry: number | null,
    sl: number | null,
    tps: number[] | null
  ): ValidationResult {
    const errors: string[] = [];
    
    const symbolResult = this.validateSymbol(symbol);
    errors.push(...symbolResult.errors);
    
    if (!side) {
      errors.push('Side is required (LONG, SHORT, or SPOT)');
    }
    
    const entryResult = this.validateEntry(entry);
    errors.push(...entryResult.errors);
    
    if (entry && sl) {
      const slResult = this.validateSL(entry, sl);
      errors.push(...slResult.errors);
    }
    
    if (entry && tps) {
      const tpResult = this.validateTPs(entry, tps);
      errors.push(...tpResult.errors);
    }
    
    return { valid: errors.length === 0, errors };
  }
}
```

---

## domain/ports/parser.port.ts

```typescript
import { TradeSide } from '../../shared/types';

export interface ParseResult {
  success: boolean;
  symbol: string | null;
  side: TradeSide | null;
  entry: number | null;
  entryMax: number | null;
  sl: number | null;
  tps: number[] | null;
  chartUrl: string | null;
  notes: string | null;
  rawValues: Record<string, string>;
  errors: string[];
}

export interface ParserPort {
  parse(message: string): ParseResult;
}
```

---

## domain/services/parser.service.ts

```typescript
import { Injectable } from '@nestjs/common';
import { ParserPort, ParseResult } from '../ports/parser.port';
import { TradeValidator } from '../../validation/trade-validator';
import { TradeSide } from '../../shared/types';

@Injectable()
export class ParserService {
  constructor(private readonly validator: TradeValidator) {}

  async parse(message: string, parser: ParserPort): Promise<ParseResult> {
    const result = parser.parse(message);
    
    if (!result.success) {
      return result;
    }
    
    const validation = this.validator.validateTrade(
      result.symbol,
      result.side,
      result.entry,
      result.sl,
      result.tps
    );
    
    return {
      ...result,
      success: validation.valid,
      errors: [...result.errors, ...validation.errors],
    };
  }
}
```

---

## infrastructure/adapters/regex-parser.adapter.ts

```typescript
import { ParserPort, ParseResult } from '../../domain/ports/parser.port';
import { TRADE_PATTERNS, extractField } from '../../patterns/trade-patterns';
import { TradeSide } from '../../shared/types';

export class RegexParserAdapter implements ParserPort {
  parse(message: string): ParseResult {
    const rawValues: Record<string, string> = {};
    const errors: string[] = [];

    const symbol = this.extractSymbol(message, rawValues);
    const side = this.extractSide(message, rawValues);
    const entry = this.extractNumber(message, 'entry', rawValues, errors);
    const entryMax = this.extractNumber(message, 'entryMax', rawValues, errors);
    const sl = this.extractNumber(message, 'sl', rawValues, errors);
    const tps = this.extractNumbers(message, 'tp', rawValues, errors);
    const chartUrl = this.extractChart(message, rawValues);
    const notes = this.extractNotes(message, rawValues);

    const hasData = symbol || side || entry || sl || tps.length > 0;
    const hasErrors = errors.length > 0;

    return {
      success: hasData && !hasErrors,
      symbol,
      side,
      entry,
      entryMax,
      sl,
      tps: tps.length > 0 ? tps : null,
      chartUrl,
      notes,
      rawValues,
      errors,
    };
  }

  private extractSymbol(text: string, raw: Record<string, string>): string | null {
    const match = text.match(TRADE_PATTERNS.symbol.pattern);
    if (match) {
      const full = match[0].toUpperCase();
      raw['symbol'] = full;
      return full.replace(/USDT$/i, '').replace(/USD$/i, '') + 'USDT';
    }
    return null;
  }

  private extractSide(text: string, raw: Record<string, string>): TradeSide | null {
    const match = text.match(TRADE_PATTERNS.side.pattern);
    if (match) {
      const side = match[1].toUpperCase() as TradeSide;
      raw['side'] = side;
      return side;
    }
    return null;
  }

  private extractNumber(
    text: string,
    field: string,
    raw: Record<string, string>,
    errors: string[]
  ): number | null {
    const pattern = TRADE_PATTERNS[field as keyof typeof TRADE_PATTERNS];
    if (!pattern) return null;
    
    const value = extractField(text, pattern.pattern, pattern.group);
    if (value) {
      const num = this.parseNumber(value);
      if (num !== null) {
        raw[field] = value;
        return num;
      } else {
        errors.push(`Invalid ${field} value: ${value}`);
      }
    }
    return null;
  }

  private extractNumbers(
    text: string,
    field: string,
    raw: Record<string, string>,
    errors: string[]
  ): number[] {
    const pattern = TRADE_PATTERNS[field as keyof typeof TRADE_PATTERNS];
    if (!pattern) return [];
    
    const matches = text.matchAll(new RegExp(pattern.pattern, 'gi'));
    const numbers: number[] = [];
    
    for (const match of matches) {
      const value = match[pattern.group];
      const num = this.parseNumber(value);
      if (num !== null) {
        numbers.push(num);
      }
    }
    
    if (numbers.length > 0) {
      raw[field] = numbers.join(', ');
    }
    
    return numbers;
  }

  private extractChart(text: string, raw: Record<string, string>): string | null {
    const value = extractField(text, TRADE_PATTERNS.chart.pattern, TRADE_PATTERNS.chart.group);
    if (value) {
      raw['chart'] = value;
      return value;
    }
    return null;
  }

  private extractNotes(text: string, raw: Record<string, string>): string | null {
    const value = extractField(text, TRADE_PATTERNS.notes.pattern, TRADE_PATTERNS.notes.group);
    if (value) {
      raw['notes'] = value;
      return value;
    }
    return null;
  }

  private parseNumber(value: string): number | null {
    const cleaned = value.replace(/,/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
}
```

---

## application/commands/parse-trade.command.ts

```typescript
import { ICommand } from '@nestjs/cqrs';

export class ParseTradeCommand implements ICommand {
  constructor(public readonly message: string) {}
}
```

---

## application/handlers/parse-trade.handler.ts

```typescript
import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { ParseTradeCommand } from '../commands/parse-trade.command';
import { ParseResult } from '../../domain/ports/parser.port';
import { RegexParserAdapter } from '../../infrastructure/adapters/regex-parser.adapter';
import { ParserService } from '../../domain/services/parser.service';

@CommandHandler(ParseTradeCommand)
export class ParseTradeHandler implements ICommandHandler<ParseTradeCommand> {
  constructor(
    private readonly parserService: ParserService,
    private readonly regexParser: RegexParserAdapter,
  ) {}

  async execute(command: ParseTradeCommand): Promise<ParseResult> {
    return this.parserService.parse(command.message, this.regexParser);
  }
}
```

---

## domain/errors/parsing-errors.ts

```typescript
export class ParsingException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParsingException';
  }
}

export class ValidationException extends Error {
  constructor(errors: string[]) {
    super(`Validation failed: ${errors.join(', ')}`);
    this.name = 'ValidationException';
  }
}
```

---

## Module Configuration

```typescript
// trade.parsing.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { RegexParserAdapter } from './infrastructure/adapters/regex-parser.adapter';
import { TradeValidator } from './validation/trade-validator';
import { ParserService } from './domain/services/parser.service';
import { ParseTradeHandler } from './application/handlers/parse-trade.handler';

const CommandHandlers = [ParseTradeHandler];

@Module({
  imports: [CqrsModule],
  providers: [
    RegexParserAdapter,
    TradeValidator,
    ParserService,
    ...CommandHandlers,
  ],
  exports: [ParserService, RegexParserAdapter],
})
export class TradeParsingModule {}
```

---

## Usage Example

```typescript
import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ParseTradeCommand } from './commands/parse-trade.command';

@Injectable()
export class TradeIngestionService {
  constructor(private readonly commandBus: CommandBus) {}

  async onMessage(message: string) {
    const result = await this.commandBus.execute(
      new ParseTradeCommand(message)
    );

    if (result.success) {
      // Create trade
    } else {
      // Log errors or ask user to fix
      console.log('Parse errors:', result.errors);
    }
  }
}
```

---

## Example Messages

```
# Valid message
LONG BTCUSDT
Entry: 65000
SL: 64000
TP: 66000
TP: 67000

# With chart
SHORT ETHUSDT
Entry: 3500
SL: 3600
TP: 3400
Chart: https://example.com/chart.png

# With notes
LONG SOLUSDT
Entry: 180
SL: 170
TP: 200
Notes: Breakout from consolidation
```

---

## Dependencies

```json
{
  "@nestjs/common": "^10.0.0",
  "@nestjs/core": "^10.0.0",
  "@nestjs/cqrs": "^10.0.0"
}
```

No external parsing libraries needed - regex is sufficient for MVP.

---

## Next Context

After completing `trade/parsing`, proceed to **trade/ingestion** to receive messages from Telegram and trigger parsing.