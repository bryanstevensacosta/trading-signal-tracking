import fc from 'fast-check';
import { ConfirmationTemplateService } from '../confirmation-template.service';
import { ParsedTradeData, TradeSide, OrderType } from '@trade/shared';

describe('ConfirmationTemplateService (property-based)', () => {
  let template: ConfirmationTemplateService;

  beforeEach(() => {
    template = new ConfirmationTemplateService();
  });

  const binanceInfoArb = fc.record({
    price: fc.string({ minLength: 1 }),
    change24h: fc.string({ minLength: 1 }),
    volume: fc.string({ minLength: 1 }),
    high: fc.string({ minLength: 1 }),
    low: fc.string({ minLength: 1 }),
  });

  const parsedTradeArb = (): fc.Arbitrary<ParsedTradeData> =>
    fc.record({
      symbol: fc.string({ minLength: 1, maxLength: 10 }),
      side: fc.constantFrom(TradeSide.LONG, TradeSide.SHORT, TradeSide.SPOT),
      orderType: fc.constantFrom(OrderType.LIMIT, OrderType.MARKET),
      entry: fc.integer({ min: 1, max: 1000000 }),
      entryMax: fc.oneof(fc.constant(null), fc.integer({ min: 1, max: 1000000 })),
      sl: fc.oneof(fc.constant(null), fc.integer({ min: 1, max: 1000000 })),
      tps: fc.oneof(
        fc.constant(null),
        fc.array(fc.integer({ min: 1, max: 1000000 }), { minLength: 1, maxLength: 5 })
      ),
      chartUrl: fc.oneof(fc.constant(null), fc.string()),
      notes: fc.oneof(fc.constant(null), fc.string()),
    });

  describe('formatConfirmation', () => {
    it('should always return object with text and buttons', () => {
      fc.assert(
        fc.property(parsedTradeArb(), binanceInfoArb, fc.string(), (trade, info, tradeId) => {
          const result = template.formatConfirmation(trade, info, tradeId);
          return (
            typeof result.text === 'string' &&
            typeof result.buttons === 'object' &&
            Array.isArray(result.buttons.edit) &&
            Array.isArray(result.buttons.approve) &&
            Array.isArray(result.buttons.cancel)
          );
        }),
        { numRuns: 50 }
      );
    });

    it('should always contain direction in text', () => {
      fc.assert(
        fc.property(parsedTradeArb(), binanceInfoArb, fc.string(), (trade, info, tradeId) => {
          const result = template.formatConfirmation(trade, info, tradeId);
          return result.text.includes(trade.side);
        }),
        { numRuns: 50 }
      );
    });

    it('should always contain entry price in text', () => {
      fc.assert(
        fc.property(parsedTradeArb(), binanceInfoArb, fc.string(), (trade, info, tradeId) => {
          const result = template.formatConfirmation(trade, info, tradeId);
          return result.text.includes(`@ <code>${trade.entry}</code>`);
        }),
        { numRuns: 50 }
      );
    });

    it('should contain symbol without USDT suffix', () => {
      fc.assert(
        fc.property(parsedTradeArb(), binanceInfoArb, fc.string(), (trade, info, tradeId) => {
          const result = template.formatConfirmation(trade, info, tradeId);
          const symbolWithoutUdt = trade.symbol.replace('USDT', '');
          return result.text.includes(symbolWithoutUdt) && !result.text.includes('USDTUSDT');
        }),
        { numRuns: 50 }
      );
    });

    it('should have edit button with tradeId', () => {
      fc.assert(
        fc.property(parsedTradeArb(), binanceInfoArb, fc.string(), (trade, info, tradeId) => {
          const result = template.formatConfirmation(trade, info, tradeId);
          return result.buttons.edit[0][0].callback_data.includes(tradeId);
        }),
        { numRuns: 50 }
      );
    });

    it('should have approve button with tradeId', () => {
      fc.assert(
        fc.property(parsedTradeArb(), binanceInfoArb, fc.string(), (trade, info, tradeId) => {
          const result = template.formatConfirmation(trade, info, tradeId);
          return result.buttons.approve[0][0].callback_data.includes(tradeId);
        }),
        { numRuns: 50 }
      );
    });

    it('should have cancel button with tradeId', () => {
      fc.assert(
        fc.property(parsedTradeArb(), binanceInfoArb, fc.string(), (trade, info, tradeId) => {
          const result = template.formatConfirmation(trade, info, tradeId);
          return result.buttons.cancel[0][0].callback_data.includes(tradeId);
        }),
        { numRuns: 50 }
      );
    });

    it('should contain side emoji based on direction', () => {
      fc.assert(
        fc.property(parsedTradeArb(), binanceInfoArb, fc.string(), (trade, info, tradeId) => {
          const result = template.formatConfirmation(trade, info, tradeId);
          if (trade.side === 'LONG') return result.text.includes('🟢');
          if (trade.side === 'SHORT') return result.text.includes('🔴');
          if (trade.side === 'SPOT') return result.text.includes('⚪');
          return true;
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('formatEditMode', () => {
    it('should always return object with text and buttons', () => {
      fc.assert(
        fc.property(parsedTradeArb(), binanceInfoArb, fc.string(), (trade, info, tradeId) => {
          const result = template.formatEditMode(trade, info, tradeId);
          return (
            typeof result.text === 'string' &&
            typeof result.buttons === 'object' &&
            result.buttons.edit.length >= 3
          );
        }),
        { numRuns: 50 }
      );
    });

    it('should contain Edit Trade header', () => {
      fc.assert(
        fc.property(parsedTradeArb(), binanceInfoArb, fc.string(), (trade, info, tradeId) => {
          const result = template.formatEditMode(trade, info, tradeId);
          return result.text.includes('✏️ Edit Trade');
        }),
        { numRuns: 50 }
      );
    });

    it('should have TP add and remove buttons', () => {
      fc.assert(
        fc.property(parsedTradeArb(), binanceInfoArb, fc.string(), (trade, info, tradeId) => {
          const result = template.formatEditMode(trade, info, tradeId);
          const lastRow = result.buttons.edit[result.buttons.edit.length - 1];
          return (
            lastRow.some((btn: any) => btn.callback_data.includes('edit_tp_add')) &&
            lastRow.some((btn: any) => btn.callback_data.includes('edit_tp_remove'))
          );
        }),
        { numRuns: 50 }
      );
    });

    it('should contain current side value', () => {
      fc.assert(
        fc.property(parsedTradeArb(), binanceInfoArb, fc.string(), (trade, info, tradeId) => {
          const result = template.formatEditMode(trade, info, tradeId);
          return result.text.includes(`Direction: ${trade.side}`);
        }),
        { numRuns: 50 }
      );
    });

    it('should contain current entry value', () => {
      fc.assert(
        fc.property(parsedTradeArb(), binanceInfoArb, fc.string(), (trade, info, tradeId) => {
          const result = template.formatEditMode(trade, info, tradeId);
          return result.text.includes(`Entry: <code>${trade.entry}</code>`);
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('formatTradeConfirmed', () => {
    it('should always return a string', () => {
      fc.assert(
        fc.property(parsedTradeArb(), (trade) => {
          const result = template.formatTradeConfirmed(trade);
          return typeof result === 'string' && result.length > 0;
        }),
        { numRuns: 50 }
      );
    });

    it('should contain Trade Confirmed header', () => {
      fc.assert(
        fc.property(parsedTradeArb(), (trade) => {
          const result = template.formatTradeConfirmed(trade);
          return result.includes('✅ Trade Confirmed');
        }),
        { numRuns: 50 }
      );
    });

    it('should contain entry price', () => {
      fc.assert(
        fc.property(parsedTradeArb(), (trade) => {
          const result = template.formatTradeConfirmed(trade);
          return result.includes(`Entry: <code>${trade.entry}</code>`);
        }),
        { numRuns: 50 }
      );
    });

    it('should contain Monitoring started', () => {
      fc.assert(
        fc.property(parsedTradeArb(), (trade) => {
          const result = template.formatTradeConfirmed(trade);
          return result.includes('Monitoring started');
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('formatTradeClosed', () => {
    it('should always return a string', () => {
      fc.assert(
        fc.property(fc.string(), (symbol) => {
          const result = template.formatTradeClosed(symbol);
          return typeof result === 'string' && result.length > 0;
        }),
        { numRuns: 50 }
      );
    });

    it('should contain Trade Closed header', () => {
      fc.assert(
        fc.property(fc.string(), (symbol) => {
          const result = template.formatTradeClosed(symbol);
          return result.includes('❌ Trade Closed');
        }),
        { numRuns: 50 }
      );
    });

    it('should contain symbol without USDT suffix', () => {
      fc.assert(
        fc.property(fc.string(), (symbol) => {
          const result = template.formatTradeClosed(symbol + 'USDT');
          return result.includes(symbol) && !result.includes('USDTUSDT');
        }),
        { numRuns: 50 }
      );
    });

    it('should contain discarded message', () => {
      fc.assert(
        fc.property(fc.string(), (symbol) => {
          const result = template.formatTradeClosed(symbol);
          return result.includes('Trade has been discarded');
        }),
        { numRuns: 50 }
      );
    });
  });
});