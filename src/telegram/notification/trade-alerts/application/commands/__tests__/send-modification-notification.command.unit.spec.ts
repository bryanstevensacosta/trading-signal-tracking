import { SendModificationNotificationCommand } from '../send-modification-notification.command';
import { Trade, TradeStatus, TradeSide, OrderType } from '@trade/shared/types';

describe('SendModificationNotificationCommand', () => {
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
    it('should create command with all parameters', () => {
      const command = new SendModificationNotificationCommand(
        mockTrade,
        'entry',
        50000,
        51000,
        123456,
      );

      expect(command.trade).toBe(mockTrade);
      expect(command.field).toBe('entry');
      expect(command.oldValue).toBe(50000);
      expect(command.newValue).toBe(51000);
      expect(command.chatId).toBe(123456);
    });

    it('should accept different field names', () => {
      const fields = ['entry', 'sl', 'tps', 'entryMax', 'notes'];

      fields.forEach((field) => {
        const command = new SendModificationNotificationCommand(
          mockTrade,
          field,
          'old',
          'new',
          123456,
        );
        expect(command.field).toBe(field);
      });
    });

    it('should accept different value types', () => {
      const numberCommand = new SendModificationNotificationCommand(
        mockTrade,
        'entry',
        50000,
        51000,
        123456,
      );
      expect(numberCommand.oldValue).toBe(50000);
      expect(numberCommand.newValue).toBe(51000);

      const stringCommand = new SendModificationNotificationCommand(
        mockTrade,
        'notes',
        'old note',
        'new note',
        123456,
      );
      expect(stringCommand.oldValue).toBe('old note');
      expect(stringCommand.newValue).toBe('new note');

      const arrayCommand = new SendModificationNotificationCommand(
        mockTrade,
        'tps',
        [50000],
        [52000, 53000],
        123456,
      );
      expect(arrayCommand.oldValue).toEqual([50000]);
      expect(arrayCommand.newValue).toEqual([52000, 53000]);

      const nullCommand = new SendModificationNotificationCommand(
        mockTrade,
        'sl',
        49000,
        null,
        123456,
      );
      expect(nullCommand.oldValue).toBe(49000);
      expect(nullCommand.newValue).toBeNull();
    });
  });
});