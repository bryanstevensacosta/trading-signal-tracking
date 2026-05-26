import { extractField, extractNumber, extractNumbers, TRADE_PATTERNS } from '../trade-patterns';

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

  it('should extract symbol', () => {
    const result = extractField('BTCUSDT', TRADE_PATTERNS.symbol.pattern, 0);
    expect(result).toBe('BTCUSDT');
  });

  it('should extract side', () => {
    const result = extractField('LONG BTCUSDT', TRADE_PATTERNS.side.pattern, 1);
    expect(result).toBe('LONG');
  });

  it('should handle case insensitive side', () => {
    const result = extractField('long btcusdt', TRADE_PATTERNS.side.pattern, 1);
    expect(result).toBe('long');
  });

  it('should extract chart url', () => {
    const result = extractField('Chart: https://example.com/chart.png', TRADE_PATTERNS.chart.pattern, 1);
    expect(result).toBe('https://example.com/chart.png');
  });

  it('should extract notes', () => {
    const result = extractField('Notes: Test trade', TRADE_PATTERNS.notes.pattern, 1);
    expect(result).toBe('Test trade');
  });

  it('should extract quantity', () => {
    const result = extractField('Qty: 0.1', TRADE_PATTERNS.quantity.pattern, 1);
    expect(result).toBe('0.1');
  });

  it('should extract leverage', () => {
    const result = extractField('10x leverage', TRADE_PATTERNS.leverage.pattern, 1);
    expect(result).toBe('10');
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

  it('should return null for non-number text', () => {
    const result = extractNumber('Entry: abc', 'entry');
    expect(result).toBeNull();
  });

  it('should parse SL', () => {
    const result = extractNumber('SL: 49000', 'sl');
    expect(result).toBe(49000);
  });

  it('should parse entryMax', () => {
    const result = extractNumber('Entry Max: 51000', 'entryMax');
    expect(result).toBe(51000);
  });

  it('should return null for unknown field', () => {
    const result = extractNumber('Value: 100', 'unknown' as any);
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

  it('should handle comma-separated numbers in multiple TPs', () => {
    const result = extractNumbers('TP1: 52,000 TP2: 53,000', 'tp');
    expect(result).toEqual([52000, 53000]);
  });

  it('should handle TP without number prefix', () => {
    const result = extractNumbers('Take profit: 52000', 'tp');
    expect(result).toEqual([52000]);
  });

  it('should return empty array for unknown field', () => {
    const result = extractNumbers('Value: 100', 'unknown' as any);
    expect(result).toEqual([]);
  });

  it('should handle decimal values', () => {
    const result = extractNumbers('TP1: 52000.50 TP2: 53000.75', 'tp');
    expect(result).toEqual([52000.5, 53000.75]);
  });

  it('should skip invalid number values', () => {
    const result = extractNumbers('TP1: 52000 TP: abc', 'tp');
    expect(result).toEqual([52000]);
  });
});