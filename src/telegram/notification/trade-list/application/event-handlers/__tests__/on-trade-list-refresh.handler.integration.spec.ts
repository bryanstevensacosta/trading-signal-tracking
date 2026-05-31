import { OnTradeListRefreshHandler } from '../on-state-changed.handler';
import { NotificationBatcherService } from '../../../domain/services/notification-batcher.service';
import { StateChangedEvent } from '@trade/state/domain/events';
import { Trade, TradeStatus, TradeSide, OrderType } from '@trade/shared';
import { LoggerPort } from '../../../../../../shared';
import { getTelegramConfig } from '@config/telegram.config';

jest.mock('@config/telegram.config', () => ({
  getTelegramConfig: jest.fn(),
}));

const mockLogger: LoggerPort = {
  trace: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
};

describe('OnTradeListRefreshHandler', () => {
  let handler: OnTradeListRefreshHandler;
  let mockBatcher: { enqueueNotificationImmediate: jest.Mock };

  const createTrade = (sourceChat: number | null): Trade => ({
    id: '1',
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
    status: TradeStatus.ACTIVE,
    sourceMessage: '',
    sourceChat,
    tpsHit: [],
    tradeAlertsMessageId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
  });

  beforeEach(() => {
    mockBatcher = {
      enqueueNotificationImmediate: jest.fn(),
    };
    handler = new OnTradeListRefreshHandler(mockBatcher as any, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handle', () => {
    it('should enqueue notification to groupId', async () => {
      (getTelegramConfig as jest.Mock).mockReturnValue({ groupId: 22222 });

      const trade = createTrade(67890);
      const event = new StateChangedEvent(
        trade,
        TradeStatus.PENDING,
        TradeStatus.ACTIVE,
        'entry_triggered'
      );

      await handler.handle(event);

      expect(mockBatcher.enqueueNotificationImmediate).toHaveBeenCalledWith(22222);
    });

    it('should use TELEGRAM_GROUP_ID from config', async () => {
      (getTelegramConfig as jest.Mock).mockReturnValue({ groupId: 33333 });

      const trade = createTrade(null);
      const event = new StateChangedEvent(
        trade,
        TradeStatus.PENDING,
        TradeStatus.ACTIVE,
        'entry_triggered'
      );

      await handler.handle(event);

      expect(mockBatcher.enqueueNotificationImmediate).toHaveBeenCalledWith(33333);
    });

    it('should not enqueue when groupId is missing', async () => {
      (getTelegramConfig as jest.Mock).mockReturnValue({ groupId: 0 });

      const trade = createTrade(null);
      const event = new StateChangedEvent(
        trade,
        TradeStatus.PENDING,
        TradeStatus.ACTIVE,
        'entry_triggered'
      );

      await handler.handle(event);

      expect(mockBatcher.enqueueNotificationImmediate).not.toHaveBeenCalled();
    });
  });
});