import { TradeApprovalService } from '../confirmation-template.service';
import { ParsedTradeData, TradeSide, OrderType } from '@trade/shared';

describe('TradeApprovalService', () => {
  let template: TradeApprovalService;

  beforeEach(() => {
    template = new TradeApprovalService();
  });

  const createParsedTrade = (overrides: Partial<ParsedTradeData> = {}): ParsedTradeData => ({
    symbol: 'BTCUSDT',
    side: TradeSide.LONG,
    orderType: OrderType.LIMIT,
    entry: 50000,
    entryMax: null,
    sl: 49000,
    tps: [52000, 53000],
    chartUrl: null,
    notes: null,
    ...overrides,
  });

  const binanceInfo = {
    price: '50100.0000',
    change24h: '+1.50%',
    volume: '$1.5M',
    high: '51000.0000',
    low: '49000.0000',
  };

  describe('formatConfirmation', () => {
    it('should format LONG trade correctly', () => {
      const trade = createParsedTrade({ symbol: 'BTCUSDT', side: TradeSide.LONG });
      const result = template.formatConfirmation(trade, binanceInfo, 'trade-123');

      expect(result.text).toContain('📊 Confirm Trade');
      expect(result.text).toContain('BTCUSDT');
      expect(result.text).toContain('🟢 LONG');
      expect(result.text).toContain('@ <code>50000</code>');
      expect(result.text).toContain('🔴 SL: <code>49000</code>');
      expect(result.text).toContain('🎯 TPs: <code>52000 / 53000</code>');
      expect(result.text).toContain('💰 Price: <code>50100.0000</code>');
      expect(result.text).toContain('+1.50% 24h');
      expect(result.text).toContain('Vol: $1.5M');
    });

    it('should format SHORT trade correctly', () => {
      const trade = createParsedTrade({ symbol: 'ETHUSDT', side: TradeSide.SHORT });
      const result = template.formatConfirmation(trade, binanceInfo, 'trade-456');

      expect(result.text).toContain('🔴 SHORT');
      expect(result.buttons.approve).toHaveLength(1);
      expect(result.buttons.cancel).toHaveLength(1);
    });

    it('should format SPOT trade correctly', () => {
      const trade = createParsedTrade({ symbol: 'BNBUSDT', side: TradeSide.SPOT });
      const result = template.formatConfirmation(trade, binanceInfo, 'trade-789');

      expect(result.text).toContain('⚪ SPOT');
    });

    it('should include entryMax when present', () => {
      const trade = createParsedTrade({ entry: 50000, entryMax: 51000 });
      const result = template.formatConfirmation(trade, binanceInfo, 'trade-123');

      expect(result.text).toContain('Entry Max: <code>51000</code>');
    });

    it('should show N/A for missing SL', () => {
      const trade = createParsedTrade({ sl: null });
      const result = template.formatConfirmation(trade, binanceInfo, 'trade-123');

      expect(result.text).toContain('SL: <code>N/A</code>');
    });

    it('should show N/A for missing TPs', () => {
      const trade = createParsedTrade({ tps: null });
      const result = template.formatConfirmation(trade, binanceInfo, 'trade-123');

      expect(result.text).toContain('TPs: <code>N/A</code>');
    });

    it('should have correct button structure', () => {
      const trade = createParsedTrade();
      const result = template.formatConfirmation(trade, binanceInfo, 'trade-123');

      expect(result.buttons.edit).toHaveLength(1);
      expect(result.buttons.approve).toHaveLength(1);
      expect(result.buttons.cancel).toHaveLength(1);
      expect(result.buttons.edit[0][0].callback_data).toBe('confirm_edit:trade-123');
      expect(result.buttons.approve[0][0].callback_data).toBe('confirm_approve:trade-123');
      expect(result.buttons.cancel[0][0].callback_data).toBe('confirm_cancel:trade-123');
    });
  });

  describe('formatEditMode', () => {
    it('should show all editable fields', () => {
      const trade = createParsedTrade();
      const result = template.formatEditMode(trade, binanceInfo, 'trade-123');

      expect(result.text).toContain('✏️ Edit Trade');
      expect(result.text).toContain('Direction: LONG');
      expect(result.text).toContain('Entry: <code>50000</code>');
      expect(result.text).toContain('SL: <code>49000</code>');
      expect(result.text).toContain('TPs: <code>52000 / 53000</code>');
    });

    it('should have edit buttons for each field', () => {
      const trade = createParsedTrade();
      const result = template.formatEditMode(trade, binanceInfo, 'trade-123');

      expect(result.buttons.edit).toHaveLength(3);
      expect(result.buttons.edit[0]).toContainEqual(expect.objectContaining({ callback_data: 'edit_side:trade-123' }));
      expect(result.buttons.edit[0]).toContainEqual(expect.objectContaining({ callback_data: 'edit_entry:trade-123' }));
      expect(result.buttons.edit[1]).toContainEqual(expect.objectContaining({ callback_data: 'edit_sl:trade-123' }));
      expect(result.buttons.edit[1]).toContainEqual(expect.objectContaining({ callback_data: 'edit_tps:trade-123' }));
    });

    it('should include add/remove TP buttons', () => {
      const trade = createParsedTrade();
      const result = template.formatEditMode(trade, binanceInfo, 'trade-123');

      expect(result.buttons.edit[2]).toContainEqual(expect.objectContaining({ callback_data: 'edit_tp_add:trade-123' }));
      expect(result.buttons.edit[2]).toContainEqual(expect.objectContaining({ callback_data: 'edit_tp_remove:trade-123' }));
    });

    it('should have save and cancel buttons', () => {
      const trade = createParsedTrade();
      const result = template.formatEditMode(trade, binanceInfo, 'trade-123');

      expect(result.buttons.approve[0][0].callback_data).toBe('confirm_approve:trade-123');
      expect(result.buttons.cancel[0][0].callback_data).toBe('confirm_cancel:trade-123');
    });
  });

  describe('formatTradeConfirmed', () => {
    it('should format LONG trade confirmation', () => {
      const trade = createParsedTrade({ side: TradeSide.LONG });
      const result = template.formatTradeConfirmed(trade);

      expect(result).toContain('✅ Trade Confirmed');
      expect(result).toContain('BTC');
      expect(result).toContain('🟢 Direction: LONG');
      expect(result).toContain('📍 Entry: <code>50000</code>');
      expect(result).toContain('Monitoring started');
    });

    it('should format SHORT trade confirmation', () => {
      const trade = createParsedTrade({ side: TradeSide.SHORT });
      const result = template.formatTradeConfirmed(trade);

      expect(result).toContain('🔴 Direction: SHORT');
    });

    it('should include SL and TPs', () => {
      const trade = createParsedTrade();
      const result = template.formatTradeConfirmed(trade);

      expect(result).toContain('🔴 SL: <code>49000</code>');
      expect(result).toContain('🎯 TPs: <code>52000 / 53000</code>');
    });
  });

  describe('formatTradeClosed', () => {
    it('should format cancellation message', () => {
      const result = template.formatTradeClosed('BTCUSDT');

      expect(result).toContain('❌ Trade Closed');
      expect(result).toContain('BTC');
      expect(result).toContain('Trade has been discarded');
    });
  });

  describe('formatTradeApproved', () => {
    it('should return same as formatTradeConfirmed', () => {
      const trade = createParsedTrade();
      const confirmed = template.formatTradeConfirmed(trade);
      const approved = template.formatTradeApproved(trade);

      expect(approved).toBe(confirmed);
    });
  });
});