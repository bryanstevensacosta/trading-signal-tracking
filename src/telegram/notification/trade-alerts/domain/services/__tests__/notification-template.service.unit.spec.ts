import { TradeAlertService } from '../trade-alert.service';
import { Trade, TradeStatus, TradeSide, OrderType } from '@trade/shared/types';

describe('TradeAlertService', () => {
  let service: TradeAlertService;

  beforeEach(() => {
    service = new TradeAlertService();
  });

  describe('formatEntryTriggered', () => {
    it('should format FUTURES LONG trade', () => {
      const trade = createTrade({ side: TradeSide.LONG, entry: 50000 });
      const result = service.formatEntryTriggered(trade);

      expect(result).toContain('ENTRY HIT');
      expect(result).toContain('<b>BTCUSDT</b>');
      expect(result).toContain('FUTURES LONG');
      expect(result).toContain('<code>50000</code>');
    });

    it('should format FUTURES SHORT trade', () => {
      const trade = createTrade({ side: TradeSide.SHORT, entry: 50000 });
      const result = service.formatEntryTriggered(trade);

      expect(result).toContain('ENTRY HIT');
      expect(result).toContain('<b>BTCUSDT</b>');
      expect(result).toContain('FUTURES SHORT');
    });

    it('should format SPOT trade', () => {
      const trade = createTrade({ side: TradeSide.SPOT, entry: 50000 });
      const result = service.formatEntryTriggered(trade);

      expect(result).toContain('ENTRY HIT');
      expect(result).toContain('<b>BTCUSDT</b>');
      expect(result).toContain('SPOT BUY');
    });

    it('should use filled price when provided', () => {
      const trade = createTrade({ side: TradeSide.LONG, entry: 50000 });
      const result = service.formatEntryTriggered(trade, 49000);

      expect(result).toContain('<code>49000</code>');
      expect(result).not.toContain('<code>50000</code>');
    });

    it('should fallback to entryExecutedPrice', () => {
      const trade = createTrade({ side: TradeSide.LONG, entry: 50000, entryExecutedPrice: 49500 });
      const result = service.formatEntryTriggered(trade);

      expect(result).toContain('<code>49500</code>');
    });
  });

  describe('formatTPHit', () => {
    it('should format TP hit message with emoji and RR', () => {
      const trade = createTrade({ symbol: 'ETHUSDT', side: TradeSide.SHORT, tps: [3200, 3300, 3400] });
      const result = service.formatTPHit(trade, 1, 2.5);

      expect(result).toContain('🚀');
      expect(result).toContain('TP2 HIT');
      expect(result).toContain('<b>ETHUSDT</b>');
      expect(result).toContain('FUTURES SHORT');
      expect(result).toContain('<code>3300</code>');
      expect(result).toContain('+2.5R');
    });

    it('should handle TP index 0', () => {
      const trade = createTrade({ tps: [52000] });
      const result = service.formatTPHit(trade, 0, 1.0);

      expect(result).toContain('ALL TP HIT');
    });
  });

  describe('formatSLHit', () => {
    it('should format SL hit message with emoji and RR', () => {
      const trade = createTrade({ symbol: 'BTCUSDT', sl: 49000 });
      const result = service.formatSLHit(trade, -1.5);

      expect(result).toContain('❌');
      expect(result).toContain('SL HIT');
      expect(result).toContain('<b>BTCUSDT</b>');
      expect(result).toContain('<code>49000</code>');
      expect(result).toContain('-1.5R');
    });
  });

  describe('formatTradeClosed', () => {
    it('should format closed win with 💰 emoji', () => {
      const trade = createTrade({ status: TradeStatus.CLOSED_WIN });
      const result = service.formatTradeClosed(trade, 'all_tp_hit');

      expect(result).toContain('💰');
      expect(result).toContain('TRADE CLOSED');
      expect(result).toContain('all_tp_hit');
    });

    it('should format closed loss with ❌ emoji', () => {
      const trade = createTrade({ status: TradeStatus.CLOSED_LOSS });
      const result = service.formatTradeClosed(trade, 'sl_triggered');

      expect(result).toContain('❌');
    });

    it('should format closed partial with 💵 emoji', () => {
      const trade = createTrade({ status: TradeStatus.CLOSED_PARTIAL });
      const result = service.formatTradeClosed(trade, 'tp_then_sl');

      expect(result).toContain('💵');
    });

    it('should format cancelled with 🚫 emoji', () => {
      const trade = createTrade({ status: TradeStatus.CANCELLED });
      const result = service.formatTradeClosed(trade, 'cancelled');

      expect(result).toContain('🚫');
    });
  });

  describe('formatTradeCreated', () => {
    it('should format new LONG trade with correct emoji', () => {
      const trade = createTrade({
        side: TradeSide.LONG,
        symbol: 'BTCUSDT',
        entry: 50000,
        entryMax: 51000,
        sl: 49000,
        tps: [52000, 53000],
        notes: 'Breakout trade',
      });

      const result = service.formatTradeCreated(trade);

      expect(result).toContain('🟢');
      expect(result).toContain('NEW TRADE');
      expect(result).toContain('BTCUSDT');
      expect(result).toContain('LONG');
      expect(result).toContain('50000');
      expect(result).toContain('49000');
      expect(result).toContain('52000');
      expect(result).toContain('53000');
    });

    it('should format new SHORT trade with red emoji', () => {
      const trade = createTrade({ side: TradeSide.SHORT });
      const result = service.formatTradeCreated(trade);

      expect(result).toContain('🔴');
    });

    it('should omit optional fields when not set', () => {
      const trade = createTrade({
        side: TradeSide.LONG,
        entry: 50000,
        entryMax: null,
        sl: null,
        tps: null,
        notes: null,
      });

      const result = service.formatTradeCreated(trade);

      expect(result).not.toContain('Entry Max:');
      expect(result).not.toContain('SL:');
      expect(result).not.toContain('TP:');
      expect(result).not.toContain('Notes:');
    });
  });

  describe('formatModification', () => {
    it('should format modification with arrow showing old to new', () => {
      const trade = createTrade({ symbol: 'BTCUSDT' });
      const result = service.formatModification(trade, 'Entry', 50000, 51000);

      expect(result).toContain('✏️');
      expect(result).toContain('TRADE MODIFIED');
      expect(result).toContain('BTCUSDT');
      expect(result).toContain('Entry: 50000 → 51000');
    });
  });

  describe('formatPartialTP', () => {
    it('should format partial TP hit message', () => {
      const trade = createTrade({ symbol: 'ETHUSDT', tps: [3200, 3300] });
      const result = service.formatPartialTP(trade, 0, 1.5);

      expect(result).toContain('💵');
      expect(result).toContain('PARTIAL TP1');
      expect(result).toContain('<b>ETHUSDT</b>');
      expect(result).toContain('<code>3200</code>');
      expect(result).toContain('+1.5R');
    });
  });

  describe('formatBreakeven', () => {
    it('should format breakeven message', () => {
      const trade = createTrade({ symbol: 'BTCUSDT', entry: 50000 });
      const result = service.formatBreakeven(trade);

      expect(result).toContain('🔒');
      expect(result).toContain('BREAKEVEN');
      expect(result).toContain('<b>BTCUSDT</b>');
      expect(result).toContain('<code>50000</code>');
    });
  });
});

function createTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 'test-id',
    symbol: 'BTCUSDT',
    side: TradeSide.LONG,
    orderType: OrderType.LIMIT,
    entry: 50000,
    entryMax: null,
    entryExecutedPrice: null,
    entryExecutedAt: null,
    sl: 49000,
    tps: [52000],
    chartUrl: null,
    notes: null,
    status: TradeStatus.PENDING,
    sourceMessage: 'test message',
    sourceChat: null,
    tpsHit: [],
    tradeAlertsMessageId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
    ...overrides,
  };
}