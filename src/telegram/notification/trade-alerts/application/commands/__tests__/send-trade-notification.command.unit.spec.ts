import { SendTradeNotificationCommand, NotificationType } from '../send-trade-notification.command';
import { Trade, TradeStatus, TradeSide, OrderType } from '@trade/shared/types';

describe('SendTradeNotificationCommand', () => {
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
    tps: [52000],
    chartUrl: null,
    notes: null,
    status: TradeStatus.PENDING,
    sourceMessage: 'test message',
    sourceChat: 123456,
    tpsHit: [],
    tradeAlertsMessageId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
  };

  describe('constructor', () => {
    it('should create command with trade, type, and chatId', () => {
      const command = new SendTradeNotificationCommand(
        mockTrade,
        'entry' as NotificationType,
        123456,
      );

      expect(command.trade).toBe(mockTrade);
      expect(command.type).toBe('entry');
      expect(command.chatId).toBe(123456);
      expect(command.metadata).toBeUndefined();
    });

    it('should create command with metadata', () => {
      const metadata = {
        price: 50000,
        rr: 2.0,
        tpIndex: 0,
      };

      const command = new SendTradeNotificationCommand(
        mockTrade,
        'tp' as NotificationType,
        123456,
        metadata,
      );

      expect(command.trade).toBe(mockTrade);
      expect(command.type).toBe('tp');
      expect(command.chatId).toBe(123456);
      expect(command.metadata).toEqual(metadata);
    });

    it('should accept all notification types', () => {
      const types: NotificationType[] = [
        'created',
        'entry',
        'tp',
        'partial_tp',
        'sl',
        'breakeven',
        'closed',
        'modified',
      ];

      types.forEach((type) => {
        const command = new SendTradeNotificationCommand(mockTrade, type, 123456);
        expect(command.type).toBe(type);
      });
    });
  });
});