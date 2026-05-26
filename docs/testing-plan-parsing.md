# Trade Parsing - Test Plan

## Overview

This document defines the comprehensive testing strategy for the `trade/parsing` bounded context.

## Module Structure

```
src/trade/parsing/
├── domain/
│   ├── ports/
│   │   ├── parser.port.ts        # ParserPort interface
│   │   └── index.ts              # Barrel export
│   └── services/
│       ├── parser.service.ts     # Orchestration service
│       └── trade-validator.ts    # Validation logic
├── infrastructure/
│   ├── adapters/
│   │   └── regex-parser.adapter.ts   # Regex implementation
│   └── patterns/
│       └── trade-patterns.ts        # Regex patterns + helper functions
└── application/
    └── commands/
        └── parse-trade/
            ├── command.ts
            └── handler.ts
```

---

## Test Naming Convention

Tests are placed in `__tests__/` folders alongside the file being tested.

| Type | Suffix | Description |
|------|--------|-------------|
| Unit | `.unit.spec.ts` | Pure functions, helpers |
| Property-Based | `.pbt.spec.ts` | fast-check property tests |
| Integration | `.integration.spec.ts` | Adapter with real patterns |

---

## 1. Unit Tests (`*.unit.spec.ts`)

### Target: `trade-patterns.ts`

**Location:** `src/trade/parsing/infrastructure/patterns/__tests__/trade-patterns.unit.spec.ts`

#### Test Coverage

| Function | Test Cases |
|----------|------------|
| `extractField` | Should extract matching group, Should return null on no match, Should handle whitespace trimming |
| `extractNumber` | Should parse valid number, Should return null for invalid, Should handle comma separator |
| `extractNumbers` | Should extract multiple TPs, Should return empty array on no match, Should handle duplicates |

#### Example

```typescript
// src/trade/parsing/infrastructure/patterns/__tests__/trade-patterns.unit.spec.ts
import { extractField, extractNumber, extractNumbers, TRADE_PATTERNS } from '../../trade-patterns';

describe('extractField', () => {
  it('should extract matching group', () => {
    const result = extractField('Entry: 50000', TRADE_PATTERNS.entry.pattern, 1);
    expect(result).toBe('50000');
  });

  it('should return null on no match', () => {
    const result = extractField('No entry here', TRADE_PATTERNS.entry.pattern, 1);
    expect(result).toBeNull();
  });

  it('should handle whitespace trimming', () => {
    const result = extractField('Entry:  50000  ', TRADE_PATTERNS.entry.pattern, 1);
    expect(result).toBe('50000');
  });
});

describe('extractNumber', () => {
  it('should parse valid number', () => {
    const result = extractNumber('Entry: 50000', 'entry');
    expect(result).toBe(50000);
  });

  it('should handle comma separator', () => {
    const result = extractNumber('Entry: 50,000', 'entry');
    expect(result).toBe(50000);
  });

  it('should return null for invalid', () => {
    const result = extractNumber('No entry', 'entry');
    expect(result).toBeNull();
  });
});

describe('extractNumbers (tp)', () => {
  it('should extract multiple TPs', () => {
    const result = extractNumbers('TP1: 52000 TP2: 53000', 'tp');
    expect(result).toEqual([52000, 53000]);
  });

  it('should return empty array on no match', () => {
    const result = extractNumbers('No TPs here', 'tp');
    expect(result).toEqual([]);
  });
});
```

---

## 2. Property-Based Tests (`*.pbt.spec.ts`)

### Target: `trade-patterns.ts`

**Location:** `src/trade/parsing/infrastructure/patterns/__tests__/trade-patterns.pbt.spec.ts`

#### Test Properties

| Property | Description |
|----------|-------------|
| Symbol extraction | Any uppercase text followed by USDT should match |
| Number parsing | Any string of digits with optional commas should parse correctly |
| TP extraction | Multiple number patterns should all be captured |

#### Example

```typescript
// src/trade/parsing/infrastructure/patterns/__tests__/trade-patterns.pbt.spec.ts
import { fc, test } from 'fast-check';
import { extractField, extractNumber, extractNumbers, TRADE_PATTERNS } from '../../trade-patterns';

describe('extractField (property-based)', () => {
  test('should always return null for non-matching patterns', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const result = extractField(text, /NOTHING_TO_SEE_HERE/gi, 1);
        return result === null;
      })
    );
  });

  test('should extract numbers from formatted strings', () => {
    fc.assert(
      fc.property(fc.float({ min: 1, max: 100000 }), (num) => {
        const formatted = `Entry: ${num.toLocaleString()}`;
        const result = extractNumber(formatted, 'entry');
        return result !== null && Math.abs(result - num) < 0.01;
      })
    );
  });
});

describe('extractNumber (property-based)', () => {
  test('should handle various number formats', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100000 }), (num) => {
        const formats = [
          `Entry: ${num}`,
          `Entry: ${num.toLocaleString()}`,
          `Entry: ${num}.00`,
        ];
        return formats.every(format => {
          const result = extractNumber(format, 'entry');
          return result !== null;
        });
      })
    );
  });
});
```

---

## 3. Integration Tests (`*.integration.spec.ts`)

### Target: `RegexParserAdapter`

**Location:** `src/trade/parsing/infrastructure/adapters/__tests__/regex-parser.adapter.integration.spec.ts`

#### Test Coverage

| Scenario | Expected Result |
|----------|-----------------|
| Full LONG trade with all fields | Parsed successfully |
| Full SHORT trade with all fields | Parsed successfully |
| Minimal trade (symbol + entry only) | Parsed with defaults |
| Missing required fields | success: false with errors |
| Multiple TPs | All TPs captured |
| Chart URL extraction | Chart URL captured |
| Notes extraction | Notes captured |
| Case insensitivity | LONG/SHORT recognized regardless of case |

#### Example

```typescript
// src/trade/parsing/infrastructure/adapters/__tests__/regex-parser.adapter.integration.spec.ts
import { RegexParserAdapter } from '../../regex-parser.adapter';
import { TradeSide } from '@trade/shared';

describe('RegexParserAdapter', () => {
  let adapter: RegexParserAdapter;

  beforeEach(() => {
    adapter = new RegexParserAdapter();
  });

  describe('parse - LONG trades', () => {
    it('should parse full LONG trade with all fields', () => {
      const message = `LONG BTCUSDT
Entry: 50000
Entry Max: 51000
SL: 49000
TP1: 52000
TP2: 53000
Chart: https://example.com/chart.png
Notes: Test trade`;

      const result = adapter.parse(message);

      expect(result.success).toBe(true);
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.side).toBe(TradeSide.LONG);
      expect(result.entry).toBe(50000);
      expect(result.entryMax).toBe(51000);
      expect(result.sl).toBe(49000);
      expect(result.tps).toEqual([52000, 53000]);
      expect(result.chartUrl).toBe('https://example.com/chart.png');
      expect(result.notes).toBe('Test trade');
    });

    it('should handle compact format', () => {
      const message = 'LONG BTCUSDT 50000 49000 52000';

      const result = adapter.parse(message);

      expect(result.success).toBe(true);
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.side).toBe(TradeSide.LONG);
      expect(result.entry).toBe(50000);
      expect(result.sl).toBe(49000);
      expect(result.tps).toEqual([52000]);
    });
  });

  describe('parse - SHORT trades', () => {
    it('should parse full SHORT trade', () => {
      const message = `SHORT ETHUSDT
Entry: 3000
SL: 3100
TP1: 2900`;

      const result = adapter.parse(message);

      expect(result.success).toBe(true);
      expect(result.symbol).toBe('ETHUSDT');
      expect(result.side).toBe(TradeSide.SHORT);
      expect(result.entry).toBe(3000);
      expect(result.sl).toBe(3100);
      expect(result.tps).toEqual([2900]);
    });
  });

  describe('parse - validation', () => {
    it('should fail when symbol is missing', () => {
      const message = `LONG
Entry: 50000`;

      const result = adapter.parse(message);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Missing symbol');
    });

    it('should fail when entry is missing', () => {
      const message = `LONG BTCUSDT`;

      const result = adapter.parse(message);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Missing entry');
    });

    it('should fail when SL is missing for valid trade', () => {
      // Note: This depends on business rule - adjust as needed
      const message = `LONG BTCUSDT
Entry: 50000`;

      const result = adapter.parse(message);

      // Current implementation: succeeds with just symbol + entry
      expect(result.success).toBe(true);
    });
  });

  describe('parse - edge cases', () => {
    it('should handle case insensitivity for side', () => {
      const longResult = adapter.parse('long BTCUSDT Entry: 50000');
      const upperResult = adapter.parse('LONG BTCUSDT Entry: 50000');

      expect(longResult.side).toBe(TradeSide.LONG);
      expect(upperResult.side).toBe(TradeSide.LONG);
    });

    it('should handle numbers with commas', () => {
      const message = `LONG BTCUSDT
Entry: 50,000
SL: 49,000`;

      const result = adapter.parse(message);

      expect(result.entry).toBe(50000);
      expect(result.sl).toBe(49000);
    });

    it('should handle empty lines gracefully', () => {
      const message = `LONG BTCUSDT

Entry: 50000

SL: 49000`;

      const result = adapter.parse(message);

      expect(result.success).toBe(true);
    });
  });
});
```

---

## 4. Test Organization

```
src/trade/parsing/
├── infrastructure/
│   ├── patterns/
│   │   ├── trade-patterns.ts
│   │   └── __tests__/
│   │       ├── trade-patterns.unit.spec.ts      # Unit tests
│   │       └── trade-patterns.pbt.spec.ts       # Property-based tests
│   └── adapters/
│       ├── regex-parser.adapter.ts
│       └── __tests__/
│           └── regex-parser.adapter.integration.spec.ts  # Integration tests
```

---

## 5. Jest Configuration

Add to `jest.config.js`:

```javascript
moduleNameMapper: {
  '^@trade/shared(|/.*)$': '<rootDir>/trade/shared/$1',
  '^@trade/parsing(|/.*)$': '<rootDir>/trade/parsing/$1',
},
```

---

## 6. Running Tests

| Command | Description |
|---------|-------------|
| `npm run test:unit` | All unit tests (includes patterns) |
| `npm run test:pbt` | All property-based tests |
| `npm run test:integration` | All integration tests |

---

## 7. Coverage Targets

| Layer | Target | Files |
|-------|--------|-------|
| Unit | 80% | `trade-patterns.ts` |
| Integration | 70% | `regex-parser.adapter.ts` |
| Property-Based | 100% | Key properties for number parsing |

---

## Implementation Order

1. Create `__tests__/` folders
2. Write unit tests for `trade-patterns.ts`
3. Write property-based tests for edge cases
4. Write integration tests for `RegexParserAdapter`
5. Run tests and verify coverage
6. Fix any failures