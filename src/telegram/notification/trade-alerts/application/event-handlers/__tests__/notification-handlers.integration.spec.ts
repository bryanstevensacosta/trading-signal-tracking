import { Test, TestingModule } from '@nestjs/testing';
import { EventBus, CommandBus } from '@nestjs/cqrs';
import { OnStateChangedHandler } from '../on-state-changed.handler';
import { OnTradeModifiedHandler } from '../on-trade-modified.handler';
import { TradeAlertService } from '@telegram/notification/trade-alerts/domain/services/trade-alert.service';
import { TELEGRAM_PORT, TelegramPort } from '@telegram/core/domain/ports/telegram.port';
import { StateChangedEvent } from '@trade/state/domain/events/state-changed.event';
import { TradeUpdatedEvent } from '@trade/shared/events/trade.events';
import { Trade, TradeStatus, TradeSide, OrderType } from '@trade/shared/types';
import { LoggerPort, LOGGER_PORT } from '../../../../../../shared';
import { TRADE_REPOSITORY_PORT, TradeRepositoryPort } from '@trade/repository/domain/ports/trade-repository.port';
import { TELEGRAM_NOTIFICATION_LOG_PORT, TelegramNotificationLogPort } from '../../../../shared/domain/ports/telegram-notification-log.port';

const mockLogger: LoggerPort = {
  trace: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
};

const mockNotificationLog: TelegramNotificationLogPort = {
  logSent: jest.fn(),
  wasSent: jest.fn().mockResolvedValue(false),
  getLastSent: jest.fn().mockResolvedValue(null),
  getForTrade: jest.fn().mockResolvedValue([]),
};

describe('NotificationEventHandlers', () => {
  let templateService: TradeAlertService;
  let telegramPort: TelegramPort;
  let mockSendMessage: jest.Mock;
  let mockRepository: jest.Mocked<TradeRepositoryPort>;

  beforeEach(async () => {
    mockSendMessage = jest.fn().mockResolvedValue(undefined);
    mockRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      findActive: jest.fn(),
      findPending: jest.fn(),
      findByStatus: jest.fn(),
      findBySymbol: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradeAlertService,
        {
          provide: TELEGRAM_PORT,
          useValue: { sendMessage: mockSendMessage },
        },
        {
          provide: LOGGER_PORT,
          useValue: mockLogger,
        },
        {
          provide: TRADE_REPOSITORY_PORT,
          useValue: mockRepository,
        },
        {
          provide: TELEGRAM_NOTIFICATION_LOG_PORT,
          useValue: mockNotificationLog,
        },
      ],
    }).compile();

    templateService = module.get<TradeAlertService>(TradeAlertService);
    telegramPort = module.get<TelegramPort>(TELEGRAM_PORT);
  });

  describe('OnStateChangedHandler', () => {
    let handler: OnStateChangedHandler;
    let mockCommandBus: jest.Mocked<CommandBus>;

    beforeEach(() => {
      mockCommandBus = {
        execute: jest.fn(),
        publish: jest.fn(),
        subscribe: jest.fn(),
      } as any;

      handler = new OnStateChangedHandler(templateService, telegramPort, mockRepository, mockCommandBus, mockLogger, mockNotificationLog);
      process.env.TELEGRAM_CHAT_ID = '123456';
    });

    afterEach(() => {
      delete process.env.TELEGRAM_CHAT_ID;
    });

    it('should send entry notification when status becomes active with entry_triggered reason', async () => {
      const trade = createTrade({ status: TradeStatus.PENDING, entry: 50000 });
      const event = new StateChangedEvent(trade, TradeStatus.PENDING, TradeStatus.ACTIVE, 'entry_triggered');

      await handler.handle(event);

      expect(mockSendMessage).toHaveBeenCalled();
      const call = mockSendMessage.mock.calls[0];
      expect(call[1]).toContain('ENTRY HIT');
    });

it('should send trade closed notification for closed_win status', async () => {
      const trade = createTrade({ status: TradeStatus.CLOSED_WIN });
      const event = new StateChangedEvent(trade, TradeStatus.ACTIVE, TradeStatus.CLOSED_WIN, 'closed_manual');

      await handler.handle(event);

      expect(mockSendMessage).toHaveBeenCalled();
      const calls = mockSendMessage.mock.calls;
      const hasTradeClosed = calls.some(call => call[1] && call[1].includes('TRADE CLOSED'));
      expect(hasTradeClosed).toBe(true);
    });

    it('should use trade.sourceChat if available for closed status', async () => {
      const trade = createTrade({ sourceChat: 999999 });
      const event = new StateChangedEvent(trade, TradeStatus.ACTIVE, TradeStatus.CLOSED_WIN, 'closed_manual');

      await handler.handle(event);

      const calls = mockSendMessage.mock.calls;
      const sourceChatCall = calls.find(call => call[0] === 999999);
      expect(sourceChatCall).toBeDefined();
    });

    it('should send breakeven notification when status becomes breakeven', async () => {
      const trade = createTrade({ status: TradeStatus.BREAKEVEN, entry: 50000 });
      const event = new StateChangedEvent(trade, TradeStatus.ACTIVE, TradeStatus.BREAKEVEN, 'breakeven_triggered');

      await handler.handle(event);

      expect(mockSendMessage).toHaveBeenCalledWith(
        123456,
        expect.stringContaining('BREAKEVEN'),
      );
    });

    it('should not send notification for partial_tp status', async () => {
      const trade = createTrade({ status: TradeStatus.PARTIAL_TP });
      const event = new StateChangedEvent(trade, TradeStatus.ACTIVE, TradeStatus.PARTIAL_TP, 'partial_tp');

      await handler.handle(event);

      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe('OnTradeModifiedHandler', () => {
    let handler: OnTradeModifiedHandler;

    beforeEach(() => {
      handler = new OnTradeModifiedHandler(templateService, telegramPort, mockLogger);
      process.env.TELEGRAM_CHAT_ID = '123456';
    });

    afterEach(() => {
      delete process.env.TELEGRAM_CHAT_ID;
    });

    it('should send modification notification with field and values', async () => {
      const trade = createTrade({ symbol: 'ETHUSDT' });
      const event = { trade, field: 'entry', oldValue: 50000, newValue: 51000 };

      await handler.handle(event);

      expect(mockSendMessage).toHaveBeenCalledWith(
        123456,
        expect.stringContaining('TRADE MODIFIED'),
      );
      expect(mockSendMessage).toHaveBeenCalledWith(
        123456,
        expect.stringContaining('entry: 50000 → 51000'),
      );
    });

    it('should use trade.sourceChat if available', async () => {
      const trade = createTrade({ sourceChat: 888888 });
      const event = { trade, field: 'sl', oldValue: 49000, newValue: 48500 };

      await handler.handle(event);

      expect(mockSendMessage).toHaveBeenCalledWith(888888, expect.any(String));
    });
  });
});

function createTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 'test-id-' + Math.random(),
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