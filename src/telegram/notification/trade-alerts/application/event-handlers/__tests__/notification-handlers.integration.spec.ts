import { Test, TestingModule } from '@nestjs/testing';
import { EventBus, CommandBus } from '@nestjs/cqrs';
import { OnStateChangedHandler } from '../on-state-changed.handler';
import { OnTriggerNotificationHandler } from '../on-trigger-detected.handler';
import { OnTradeModifiedHandler } from '../on-trade-modified.handler';
import { TradeAlertService } from '@telegram/notification/trade-alerts/domain/services/trade-alert.service';
import { TELEGRAM_PORT, TelegramPort } from '@telegram/core/domain/ports/telegram.port';
import { StateChangedEvent } from '@trade/state/domain/events/state-changed.event';
import { TriggerDetectedEvent } from '@trade/engine/domain/events/trigger-detected.event';
import { TradeUpdatedEvent } from '@trade/shared/events/trade.events';
import { Trade, TradeStatus, TradeSide, TriggerType, OrderType } from '@trade/shared/types';
import { LoggerPort, LOGGER_PORT } from '../../../../../../shared';
import { TRADE_REPOSITORY_PORT, TradeRepositoryPort } from '@trade/repository/domain/ports/trade-repository.port';

const mockLogger: LoggerPort = {
  trace: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
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

      handler = new OnStateChangedHandler(templateService, telegramPort, mockRepository, mockCommandBus, mockLogger);
      process.env.TELEGRAM_CHAT_ID = '123456';
    });

    afterEach(() => {
      delete process.env.TELEGRAM_CHAT_ID;
    });

    it('should not send notification when status becomes active (handled by OnTriggerNotificationHandler)', async () => {
      const trade = createTrade({ status: TradeStatus.PENDING });
      const event = new StateChangedEvent(trade, TradeStatus.PENDING, TradeStatus.ACTIVE, 'entry_triggered');

      await handler.handle(event);

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('should send trade closed notification for closed_win status', async () => {
      const trade = createTrade({ status: TradeStatus.CLOSED_WIN });
      const event = new StateChangedEvent(trade, TradeStatus.ACTIVE, TradeStatus.CLOSED_WIN, 'all_tp_hit');

      await handler.handle(event);

      expect(mockSendMessage).toHaveBeenCalledWith(
        123456,
        expect.stringContaining('TRADE CLOSED'),
      );
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

    it('should use trade.sourceChat if available for closed status', async () => {
      const trade = createTrade({ sourceChat: 999999 });
      const event = new StateChangedEvent(trade, TradeStatus.ACTIVE, TradeStatus.CLOSED_WIN, 'all_tp_hit');

      await handler.handle(event);

      expect(mockSendMessage).toHaveBeenCalledWith(999999, expect.any(String));
    });

    it('should not send notification for partial_tp status', async () => {
      const trade = createTrade({ status: TradeStatus.PARTIAL_TP });
      const event = new StateChangedEvent(trade, TradeStatus.ACTIVE, TradeStatus.PARTIAL_TP, 'partial_tp');

      await handler.handle(event);

      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe('OnTriggerNotificationHandler', () => {
    let handler: OnTriggerNotificationHandler;

    beforeEach(() => {
      handler = new OnTriggerNotificationHandler(templateService, telegramPort, mockRepository, mockLogger);
      process.env.TELEGRAM_CHAT_ID = '123456';
    });

    afterEach(() => {
      delete process.env.TELEGRAM_CHAT_ID;
    });

    it('should format and send entry trigger notification', async () => {
      const trade = createTrade({ entry: 50000, sl: 49000, tps: [52000] });
      const event = new TriggerDetectedEvent(trade, TriggerType.ENTRY, 50000);

      await handler.handle(event);

      expect(mockSendMessage).toHaveBeenCalled();
      const call = mockSendMessage.mock.calls[0];
      expect(call[0]).toBe(123456);
      expect(call[1]).toContain('ENTRY HIT');
    });

    it('should format and send TP trigger notification with tpIndex and rr', async () => {
      const trade = createTrade({ tps: [52000, 53000] });
      const event = new TriggerDetectedEvent(trade, TriggerType.TP, 52000, 2.0, 0);

      await handler.handle(event);

      expect(mockSendMessage).toHaveBeenCalled();
      const call = mockSendMessage.mock.calls[0];
      expect(call[0]).toBe(123456);
      expect(call[1]).toContain('TP1 HIT');
    });

    it('should format and send SL trigger notification', async () => {
      const trade = createTrade({ sl: 49000 });
      const event = new TriggerDetectedEvent(trade, TriggerType.SL, 49000, -1.0);

      await handler.handle(event);

      expect(mockSendMessage).toHaveBeenCalled();
      const call = mockSendMessage.mock.calls[0];
      expect(call[0]).toBe(123456);
      expect(call[1]).toContain('SL HIT');
    });

    it('should format and send breakeven trigger notification', async () => {
      const trade = createTrade({ entry: 50000 });
      const event = new TriggerDetectedEvent(trade, TriggerType.BREAKEVEN, 50000);

      await handler.handle(event);

      expect(mockSendMessage).toHaveBeenCalled();
      const call = mockSendMessage.mock.calls[0];
      expect(call[0]).toBe(123456);
      expect(call[1]).toContain('BREAKEVEN');
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
    notificationMessageId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
    ...overrides,
  };
}