import { TradeUpdatedEvent } from '../trade.events';
import { Trade, TradeStatus, TradeSide, OrderType } from '../../types';

describe('trade.events', () => {
  const mockTrade: Trade = {
    id: 'test-id',
    symbol: 'BTCUSDT',
    side: TradeSide.LONG,
    orderType: OrderType.LIMIT,
    entry: 50000,
    entryMax: null,
    entryExecutedPrice: null,
    entryExecutedAt: null,
    sl: 49000,
    tps: [52000, 53000],
    chartUrl: null,
    notes: null,
    status: TradeStatus.PENDING,
    sourceMessage: 'test',
    sourceChat: 123456,
    tpsHit: [],
    notificationMessageId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
  };

  describe('TradeUpdatedEvent', () => {
    it('should create event with all properties', () => {
      const event = new TradeUpdatedEvent(mockTrade, 'entry', 49000, 51000);

      expect(event.trade).toBe(mockTrade);
      expect(event.field).toBe('entry');
      expect(event.oldValue).toBe(49000);
      expect(event.newValue).toBe(51000);
    });

    it('should handle string values', () => {
      const event = new TradeUpdatedEvent(mockTrade, 'notes', 'old note', 'new note');

      expect(event.field).toBe('notes');
      expect(event.oldValue).toBe('old note');
      expect(event.newValue).toBe('new note');
    });

    it('should handle array values', () => {
      const oldTps = [50000];
      const newTps = [51000, 52000, 53000];
      const event = new TradeUpdatedEvent(mockTrade, 'tps', oldTps, newTps);

      expect(event.oldValue).toEqual(oldTps);
      expect(event.newValue).toEqual(newTps);
    });

    it('should handle null values', () => {
      const event = new TradeUpdatedEvent(mockTrade, 'sl', 49000, null);

      expect(event.oldValue).toBe(49000);
      expect(event.newValue).toBeNull();
    });

    it('should handle undefined values', () => {
      const event = new TradeUpdatedEvent(mockTrade, 'entryMax', null, 51000);

      expect(event.oldValue).toBeNull();
      expect(event.newValue).toBe(51000);
    });

    it('should handle numeric field names', () => {
      const event = new TradeUpdatedEvent(mockTrade, '0', 49000, 51000);

      expect(event.field).toBe('0');
    });

    it('should handle complex objects as values', () => {
      const oldValue = { price: 49000, timestamp: 1234567890 };
      const newValue = { price: 51000, timestamp: 1234567891 };
      const event = new TradeUpdatedEvent(mockTrade, 'metadata', oldValue, newValue);

      expect(event.oldValue).toEqual(oldValue);
      expect(event.newValue).toEqual(newValue);
    });

    
  });

  describe('interface types', () => {
    it('TradeCreatedEvent should have trade property', () => {
      const event: import('../trade.events').TradeCreatedEvent = { trade: mockTrade };
      expect(event.trade).toBe(mockTrade);
    });

    it('StateChangedEvent should have required properties', () => {
      const event: import('../trade.events').StateChangedEvent = {
        trade: mockTrade,
        oldStatus: TradeStatus.PENDING,
        newStatus: TradeStatus.ACTIVE,
        reason: 'entry_triggered',
      };
      expect(event.oldStatus).toBe(TradeStatus.PENDING);
      expect(event.newStatus).toBe(TradeStatus.ACTIVE);
      expect(event.reason).toBe('entry_triggered');
    });

    it('TriggerDetectedEvent should have optional properties', () => {
      const event: import('../trade.events').TriggerDetectedEvent = {
        trade: mockTrade,
        trigger: 'entry' as any,
        price: 50000,
      };
      expect(event.price).toBe(50000);
      expect(event.rr).toBeUndefined();
      expect(event.tpIndex).toBeUndefined();
    });

    it('TriggerDetectedEvent should handle rr and tpIndex', () => {
      const event: import('../trade.events').TriggerDetectedEvent = {
        trade: mockTrade,
        trigger: 'tp' as any,
        price: 52000,
        rr: 2.5,
        tpIndex: 1,
      };
      expect(event.rr).toBe(2.5);
      expect(event.tpIndex).toBe(1);
    });

    it('TradeClosedEvent should have required and optional properties', () => {
      const event: import('../trade.events').TradeClosedEvent = {
        trade: mockTrade,
        reason: 'tp_hit',
      };
      expect(event.pnl).toBeUndefined();
    });

    it('TradeClosedEvent should handle pnl', () => {
      const event: import('../trade.events').TradeClosedEvent = {
        trade: mockTrade,
        reason: 'closed',
        pnl: 150.50,
      };
      expect(event.pnl).toBe(150.50);
    });
  });
});