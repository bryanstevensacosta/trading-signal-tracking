import { RegexParserAdapter } from '../regex-parser.adapter';
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
      expect(result.data?.symbol).toBe('BTCUSDT');
      expect(result.data?.side).toBe(TradeSide.LONG);
      expect(result.data?.entry).toBe(50000);
      expect(result.data?.entryMax).toBe(51000);
      expect(result.data?.sl).toBe(49000);
      expect(result.data?.tps).toEqual([52000, 53000]);
      expect(result.data?.chartUrl).toBe('https://example.com/chart.png');
      expect(result.data?.notes).toBe('Test trade');
    });

    it('should parse minimal LONG trade', () => {
      const message = `LONG BTCUSDT
Entry: 50000`;

      const result = adapter.parse(message);

      expect(result.success).toBe(true);
      expect(result.data?.symbol).toBe('BTCUSDT');
      expect(result.data?.side).toBe(TradeSide.LONG);
      expect(result.data?.entry).toBe(50000);
    });

    it('should handle multiple TPs', () => {
      const message = `LONG BTCUSDT
Entry: 50000
SL: 49000
TP1: 52000
TP2: 53000
TP3: 54000`;

      const result = adapter.parse(message);

      expect(result.data?.tps).toEqual([52000, 53000, 54000]);
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
      expect(result.data?.symbol).toBe('ETHUSDT');
      expect(result.data?.side).toBe(TradeSide.SHORT);
      expect(result.data?.entry).toBe(3000);
      expect(result.data?.sl).toBe(3100);
      expect(result.data?.tps).toEqual([2900]);
    });

    it('should parse SHORT with entry range', () => {
      const message = `SHORT SOLUSDT
Entry: 150
Entry Max: 155
SL: 160
TP1: 140`;

      const result = adapter.parse(message);

      expect(result.success).toBe(true);
      expect(result.data?.side).toBe(TradeSide.SHORT);
      expect(result.data?.entry).toBe(150);
      expect(result.data?.entryMax).toBe(155);
    });
  });

  describe('parse - SPOT trades', () => {
    it('should parse SPOT trade', () => {
      const message = `SPOT BTCUSDT
Entry: 50000
SL: 49000
TP1: 52000`;

      const result = adapter.parse(message);

      expect(result.success).toBe(true);
      expect(result.data?.side).toBe(TradeSide.SPOT);
    });
  });

  describe('parse - case insensitivity', () => {
    it('should handle lowercase side', () => {
      const result = adapter.parse('long BTCUSDT Entry: 50000');
      expect(result.data?.side).toBe(TradeSide.LONG);
    });

    it('should handle uppercase side', () => {
      const result = adapter.parse('LONG BTCUSDT Entry: 50000');
      expect(result.data?.side).toBe(TradeSide.LONG);
    });

    it('should handle mixed case side', () => {
      const result = adapter.parse('Long BTCUSDT Entry: 50000');
      expect(result.data?.side).toBe(TradeSide.LONG);
    });

    it('should normalize symbol to uppercase', () => {
      const result = adapter.parse('LONG btcusdt Entry: 50000');
      expect(result.data?.symbol).toBe('BTCUSDT');
    });
  });

  describe('parse - numbers with commas', () => {
    it('should handle entry with comma', () => {
      const message = `LONG BTCUSDT
Entry: 50,000`;

      const result = adapter.parse(message);

      expect(result.data?.entry).toBe(50000);
    });

    it('should handle all prices with commas', () => {
      const message = `LONG BTCUSDT
Entry: 50,000
SL: 49,000
TP1: 52,000`;

      const result = adapter.parse(message);

      expect(result.data?.entry).toBe(50000);
      expect(result.data?.sl).toBe(49000);
      expect(result.data?.tps).toEqual([52000]);
    });
  });

  describe('parse - optional fields', () => {
    it('should handle missing entryMax', () => {
      const message = `LONG BTCUSDT
Entry: 50000
SL: 49000`;

      const result = adapter.parse(message);

      expect(result.data?.entryMax).toBeNull();
    });

    it('should handle missing SL', () => {
      const message = `LONG BTCUSDT
Entry: 50000
TP1: 52000`;

      const result = adapter.parse(message);

      expect(result.data?.sl).toBeNull();
    });

    it('should handle missing TPs', () => {
      const message = `LONG BTCUSDT
Entry: 50000
SL: 49000`;

      const result = adapter.parse(message);

      expect(result.data?.tps).toBeNull();
    });

    it('should handle missing chart and notes', () => {
      const message = `LONG BTCUSDT
Entry: 50000
SL: 49000`;

      const result = adapter.parse(message);

      expect(result.data?.chartUrl).toBeNull();
      expect(result.data?.notes).toBeNull();
    });
  });

  describe('parse - edge cases', () => {
    it('should handle empty lines gracefully', () => {
      const message = `LONG BTCUSDT

Entry: 50000

SL: 49000`;

      const result = adapter.parse(message);

      expect(result.success).toBe(true);
    });

    it('should handle extra whitespace', () => {
      const message = `LONG   BTCUSDT   
Entry:   50000   
SL:   49000`;

      const result = adapter.parse(message);

      expect(result.success).toBe(true);
    });

    it('should handle various entry label formats', () => {
      const formats = [
        'Entry: 50000',
        'entry price: 50000',
        'buy price: 50000',
        'ENTRY: 50000',
      ];

      formats.forEach(format => {
        const result = adapter.parse(`LONG BTCUSDT\n${format}`);
      expect(result.data?.entry).toBe(50000);
      });
    });

    it('should handle various SL label formats', () => {
      const formats = [
        'SL: 49000',
        'stop loss: 49000',
        'sl: 49000',
      ];

      formats.forEach(format => {
        const result = adapter.parse(`LONG BTCUSDT\nEntry: 50000\n${format}`);
        expect(result.data?.sl).toBe(49000);
      });
    });

    it('should handle TP label variations', () => {
      const formats = [
        'TP1: 52000',
        'tp: 52000',
        'take profit: 52000',
      ];

      formats.forEach(format => {
        const result = adapter.parse(`LONG BTCUSDT\nEntry: 50000\n${format}`);
        expect(result.data?.tps).toEqual([52000]);
      });
    });
  });

  // describe('parse - raw values', () => {
  //   it('should capture raw values', () => {
  //     const message = `LONG BTCUSDT
  // Entry: 50000
  // SL: 49000`;
  //
  //     const result = adapter.parse(message);
  //
  //     expect(result.rawValues?.symbol).toBe('BTCUSDT');
  //     expect(result.rawValues?.side).toBe('LONG');
  //     expect(result.rawValues?.entry).toBe('50000');
  //     expect(result.rawValues?.sl).toBe('49000');
  //   });
  // });

  describe('parse - validation errors', () => {
    it('should succeed with just entry and symbol', () => {
      const message = 'LONG BTCUSDT Entry: 50000';

      const result = adapter.parse(message);

      expect(result.success).toBe(true);
      expect(result.data?.entry).toBe(50000);
    });

    it('should include errors when entry is missing', () => {
      const message = `LONG BTCUSDT
SL: 49000`;

      const result = adapter.parse(message);

      expect(result.data).toBeNull();
    });

    it('should have empty errors for valid trade', () => {
      const message = `LONG BTCUSDT
Entry: 50000
SL: 49000`;

      const result = adapter.parse(message);

      expect(result.errors).toEqual([]);
    });
  });

  describe('parse - symbol variations', () => {
    it('should handle BTCUSDT', () => {
      const result = adapter.parse('LONG BTCUSDT Entry: 50000');
      expect(result.data?.symbol).toBe('BTCUSDT');
    });

    it('should handle ETHUSDT', () => {
      const result = adapter.parse('LONG ETHUSDT Entry: 3000');
      expect(result.data?.symbol).toBe('ETHUSDT');
    });

    it('should handle SOLUSDT', () => {
      const result = adapter.parse('LONG SOLUSDT Entry: 150');
      expect(result.data?.symbol).toBe('SOLUSDT');
    });

    it('should add USDT suffix if missing', () => {
      const result = adapter.parse('LONG BTCUSD Entry: 50000');
      expect(result.data?.symbol).toBe('BTCUSDT');
    });
  });

  describe('parse - compact format', () => {
    it('should parse compact LONG format (SL below entry)', () => {
      const message = 'BTCUSDT 52440.43 42330.73';

      const result = adapter.parse(message);

      expect(result.success).toBe(true);
      expect(result.data?.symbol).toBe('BTCUSDT');
      expect(result.data?.side).toBe(TradeSide.LONG);
      expect(result.data?.entry).toBe(52440.43);
      expect(result.data?.sl).toBe(42330.73);
    });

    it('should parse compact SHORT format (SL above entry)', () => {
      const message = 'BTCUSDT 50000 51000';

      const result = adapter.parse(message);

      expect(result.success).toBe(true);
      expect(result.data?.symbol).toBe('BTCUSDT');
      expect(result.data?.side).toBe(TradeSide.SHORT);
      expect(result.data?.entry).toBe(50000);
      expect(result.data?.sl).toBe(51000);
    });

    it('should parse compact with TPs', () => {
      const message = 'BTCUSDT 50000 49000 52000 53000';

      const result = adapter.parse(message);

      expect(result.success).toBe(true);
      expect(result.data?.tps).toEqual([52000, 53000]);
    });

    it('should parse compact with chart URL', () => {
      const message = 'BTCUSDT 52440.43 42330.73 60200 70109.2 https://www.tradingview.com/x/91Rq999U/';

      const result = adapter.parse(message);

      expect(result.success).toBe(true);
      expect(result.data?.symbol).toBe('BTCUSDT');
      expect(result.data?.entry).toBe(52440.43);
      expect(result.data?.sl).toBe(42330.73);
      expect(result.data?.tps).toEqual([60200, 70109.2]);
      expect(result.data?.chartUrl).toBe('https://www.tradingview.com/x/91Rq999U/');
    });

    it('should parse compact with single TP and chart', () => {
      const message = 'ETHUSDT 3000 2900 3200 https://example.com/chart.png';

      const result = adapter.parse(message);

      expect(result.success).toBe(true);
      expect(result.data?.symbol).toBe('ETHUSDT');
      expect(result.data?.entry).toBe(3000);
      expect(result.data?.sl).toBe(2900);
      expect(result.data?.tps).toEqual([3200]);
      expect(result.data?.chartUrl).toBe('https://example.com/chart.png');
    });

    it('should parse compact format with commas', () => {
      const message = 'BTCUSDT 50,000 49,000 52,000';

      const result = adapter.parse(message);

      expect(result.success).toBe(true);
      expect(result.data?.entry).toBe(50000);
      expect(result.data?.sl).toBe(49000);
      expect(result.data?.tps).toEqual([52000]);
    });

    it('should parse compact with symbol without USDT suffix', () => {
      const message = 'BTC 50000 49000';

      const result = adapter.parse(message);

      expect(result.success).toBe(true);
      expect(result.data?.symbol).toBe('BTCUSDT');
    });

    it('should prefer explicit side over inferred', () => {
      const message = 'LONG BTCUSDT 50000 49000';

      const result = adapter.parse(message);

      expect(result.data?.side).toBe(TradeSide.LONG);
    });

    it('should not parse if text format is detected', () => {
      const message = `LONG BTCUSDT
Entry: 50000
SL: 49000`;

      const result = adapter.parse(message);

      expect(result.success).toBe(true);
      expect(result.data?.side).toBe(TradeSide.LONG);
    });
  });
});