import { OrderType, TradeStatus, TradeSide } from '../../src/trade/shared';
import { TradeAlertService } from '../../src/telegram/notification/trade-alerts/domain/services/trade-alert.service';

describe('TradeAlertService (unit)', () => {
  let templateService: TradeAlertService;

  beforeAll(() => {
    templateService = new TradeAlertService();
  });

  describe('formatEntryTriggered', () => {
    it('should format entry triggered message', () => {
      const message = templateService.formatEntryTriggered({
        id: 'test-1',
        symbol: 'BTCUSDT',
        side: TradeSide.LONG,
        orderType: OrderType.MARKET,
        entry: 50000,
        entryMax: null,
        entryExecutedPrice: null,
        entryExecutedAt: null,
        sl: 49000,
        tps: [52000],
        chartUrl: null,
        notes: null,
        status: TradeStatus.PENDING,
        sourceMessage: 'test',
        sourceChat: null,
        tpsHit: [],
        tradeAlertsMessageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        closedAt: null,
      });

      expect(message).toContain('ENTRY HIT');
      expect(message).toContain('BTCUSDT');
      expect(message).toContain('FUTURES LONG');
      expect(message).toContain('50000');
    });

    it('should format SHORT entry triggered message', () => {
      const message = templateService.formatEntryTriggered({
        id: 'test-2',
        symbol: 'ETHUSDT',
        side: TradeSide.SHORT,
        orderType: OrderType.MARKET,
        entry: 3000,
        entryMax: null,
        entryExecutedPrice: null,
        entryExecutedAt: null,
        sl: 3100,
        tps: [2900, 2800],
        chartUrl: null,
        notes: null,
        status: TradeStatus.PENDING,
        sourceMessage: 'test',
        sourceChat: null,
        tpsHit: [],
        tradeAlertsMessageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        closedAt: null,
      });

      expect(message).toContain('ENTRY HIT');
      expect(message).toContain('ETHUSDT');
      expect(message).toContain('FUTURES SHORT');
    });
  });

  describe('formatTPHit', () => {
    it('should format TP hit message with RR', () => {
      const message = templateService.formatTPHit(
        {
          id: 'test-3',
          symbol: 'BTCUSDT',
          side: TradeSide.LONG,
          orderType: OrderType.MARKET,
          entry: 50000,
          entryMax: null,
          entryExecutedPrice: null,
          entryExecutedAt: null,
          sl: 49000,
          tps: [52000, 53000],
          chartUrl: null,
          notes: null,
          status: TradeStatus.ACTIVE,
          sourceMessage: 'test',
          sourceChat: null,
          tpsHit: [],
          tradeAlertsMessageId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          closedAt: null,
        },
        0,
        1.5,
      );

      expect(message).toContain('TP1 HIT');
      expect(message).toContain('BTCUSDT');
    });

    it('should format partial TP message', () => {
      const message = templateService.formatTPHit(
        {
          id: 'test-4',
          symbol: 'ETHUSDT',
          side: TradeSide.LONG,
          orderType: OrderType.MARKET,
          entry: 3000,
          entryMax: null,
          entryExecutedPrice: null,
          entryExecutedAt: null,
          sl: 2900,
          tps: [3100, 3200, 3300],
          chartUrl: null,
          notes: null,
          status: TradeStatus.PARTIAL_TP,
          sourceMessage: 'test',
          sourceChat: null,
          tpsHit: [0],
          tradeAlertsMessageId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          closedAt: null,
        },
        1,
        2.0,
      );

      expect(message).toContain('TP2 HIT');
    });
  });

  describe('formatSLHit', () => {
    it('should format SL hit message', () => {
      const message = templateService.formatSLHit({
        id: 'test-5',
        symbol: 'BTCUSDT',
        side: TradeSide.LONG,
        orderType: OrderType.MARKET,
        entry: 50000,
        entryMax: null,
        entryExecutedPrice: null,
        entryExecutedAt: null,
        sl: 49000,
        tps: [52000],
        chartUrl: null,
        notes: null,
        status: TradeStatus.CLOSED_LOSS,
        sourceMessage: 'test',
        sourceChat: null,
        tpsHit: [],
        tradeAlertsMessageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        closedAt: new Date(),
      }, -2.0);

      expect(message).toContain('SL HIT');
      expect(message).toContain('BTCUSDT');
    });
  });

  describe('formatTradeClosed', () => {
    it('should format closed win message', () => {
      const message = templateService.formatTradeClosed({
        id: 'test-6',
        symbol: 'BTCUSDT',
        side: TradeSide.LONG,
        orderType: OrderType.MARKET,
        entry: 50000,
        entryMax: null,
        entryExecutedPrice: null,
        entryExecutedAt: null,
        sl: 49000,
        tps: [52000],
        chartUrl: null,
        notes: null,
        status: TradeStatus.CLOSED_WIN,
        sourceMessage: 'test',
        sourceChat: null,
        tpsHit: [0],
        tradeAlertsMessageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        closedAt: new Date(),
      }, 'All TPs Hit');

      expect(message).toContain('TRADE CLOSED');
      expect(message).toContain('💰');
      expect(message).toContain('BTCUSDT');
      expect(message).toContain('All TPs Hit');
    });
  });
});