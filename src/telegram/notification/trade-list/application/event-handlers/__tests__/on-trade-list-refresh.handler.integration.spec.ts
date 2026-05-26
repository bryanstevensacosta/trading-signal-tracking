import { OnTradeListRefreshHandler } from '../on-state-changed.handler';
import { NotificationBatcherService } from '../../../domain/services/notification-batcher.service';
import { StateChangedEvent } from '@trade/state/domain/events';
import { Trade, TradeStatus, TradeSide, OrderType } from '@trade/shared';
import { LoggerPort } from '../../../../../../shared';

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
  let mockBatcher: { enqueueNotification: jest.Mock };

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
    notificationMessageId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
  });

  beforeEach(() => {
    mockBatcher = {
      enqueueNotification: jest.fn(),
    };
    handler = new OnTradeListRefreshHandler(mockBatcher as any, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handle', () => {
    it('should enqueue notification with trade sourceChat', async () => {
      const trade = createTrade(67890);
      const event = new StateChangedEvent(
        trade,
        TradeStatus.PENDING,
        TradeStatus.ACTIVE,
        'entry_triggered'
      );

      await handler.handle(event);

      expect(mockBatcher.enqueueNotification).toHaveBeenCalledWith(67890);
    });

    it('should use TELEGRAM_CHAT_ID env when trade has no sourceChat', async () => {
      const trade = createTrade(null);
      const event = new StateChangedEvent(
        trade,
        TradeStatus.PENDING,
        TradeStatus.ACTIVE,
        'entry_triggered'
      );

      const originalEnv = process.env.TELEGRAM_CHAT_ID;
      process.env.TELEGRAM_CHAT_ID = '11111';

      await handler.handle(event);

      expect(mockBatcher.enqueueNotification).toHaveBeenCalledWith(11111);

      if (originalEnv) process.env.TELEGRAM_CHAT_ID = originalEnv;
      else delete process.env.TELEGRAM_CHAT_ID;
    });

    it('should not enqueue when both sourceChat and TELEGRAM_CHAT_ID are missing', async () => {
      const trade = createTrade(null);
      const event = new StateChangedEvent(
        trade,
        TradeStatus.PENDING,
        TradeStatus.ACTIVE,
        'entry_triggered'
      );

      const originalEnv = process.env.TELEGRAM_CHAT_ID;
      delete process.env.TELEGRAM_CHAT_ID;

      await handler.handle(event);

      expect(mockBatcher.enqueueNotification).not.toHaveBeenCalled();

      if (originalEnv) process.env.TELEGRAM_CHAT_ID = originalEnv;
    });
  });
});