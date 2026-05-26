import fc from 'fast-check';
import { extractField, extractNumber, extractNumbers, TRADE_PATTERNS } from '../trade-patterns';

describe('extractField (property-based)', () => {
  it('should always return null for non-matching patterns', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const result = extractField(text, /NOTHING_TO_SEE_HERE/gi, 1);
        return result === null;
      })
    );
  });

  it('should handle any string input without throwing', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const result = extractField(text, TRADE_PATTERNS.symbol.pattern, 0);
        return result === null || typeof result === 'string';
      })
    );
  });
});

describe('extractNumber (property-based)', () => {
  it('should handle various number formats', () => {
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

  it('should always return null for non-numeric text', () => {
    fc.assert(
      fc.property(fc.string().filter(s => !/\d/.test(s)), (text) => {
        const result = extractNumber(text, 'entry');
        return result === null;
      })
    );
  });

  it('should handle large numbers', () => {
    fc.assert(
      fc.property(fc.integer({ min: 100000, max: 1000000 }), (num) => {
        const formatted = `Entry: ${num.toLocaleString()}`;
        const result = extractNumber(formatted, 'entry');
        return result !== null;
      })
    );
  });

  it('should handle decimal numbers', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10000 }), (num) => {
        const formatted = `Entry: ${num}.99`;
        const result = extractNumber(formatted, 'entry');
        return result !== null && result > 0;
      })
    );
  });
});

describe('extractNumbers (property-based)', () => {
  it('should extract numbers from text with multiple numbers', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 1, max: 100000 }), { minLength: 1, maxLength: 5 }), (numbers) => {
        const text = numbers.map(n => `TP: ${n}`).join(' ');
        const result = extractNumbers(text, 'tp');
        return result.length === numbers.length;
      })
    );
  });

  it('should return empty array when no numbers present', () => {
    fc.assert(
      fc.property(fc.string().filter(s => !/\d/.test(s)), (text) => {
        const result = extractNumbers(text, 'tp');
        return result.length === 0;
      })
    );
  });
});

describe('TRADE_PATTERNS stability', () => {
  it('all patterns should be defined', () => {
    const patterns = TRADE_PATTERNS as Record<string, { pattern: RegExp; group: number }>;
    const expectedFields = ['symbol', 'side', 'entry', 'entryMax', 'sl', 'tp', 'chart', 'notes', 'quantity', 'leverage'];
    expectedFields.forEach(field => {
      expect(patterns[field]).toBeDefined();
      expect(patterns[field].pattern).toBeInstanceOf(RegExp);
      expect(patterns[field].group).toBeDefined();
    });
  });

  it('patterns should have valid group indices', () => {
    const patterns = TRADE_PATTERNS as Record<string, { pattern: RegExp; group: number }>;
    Object.values(patterns).forEach(pattern => {
      expect(pattern.group).toBeGreaterThanOrEqual(0);
    });
  });
});