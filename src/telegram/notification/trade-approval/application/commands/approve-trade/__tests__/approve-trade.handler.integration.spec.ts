import { ApproveTradeHandler } from '../handler';
import { ApproveTradeCommand } from '../command';
import { SqliteTradeAdapter } from '@trade/repository/infrastructure/adapters/sqlite-trade.adapter';
import { TradeApprovalService } from '../../../../domain/services/confirmation-template.service';
import { TELEGRAM_PORT } from '@telegram/core/domain/ports/telegram.port';
import { Trade, TradeStatus, TradeSide, OrderType } from '@trade/shared';
import { LoggerPort } from '../../../../../../../shared';

const mockLogger: LoggerPort = {
  trace: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
};

describe('ApproveTradeHandler (integration)', () => {
  let handler: ApproveTradeHandler;
  let mockRepository: { findById: jest.Mock; findAll: jest.Mock; update: jest.Mock };
  let mockCommandBus: { execute: jest.Mock };
  let mockTelegram: { sendMessage: jest.Mock; editMessage: jest.Mock };
  let mockTemplate: { formatTradeApproved: jest.Mock };

  const createTrade = (overrides: Partial<Trade> = {}): Trade => ({
    id: 'trade-123',
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
    sourceMessage: 'LONG BTCUSDT 50000',
    sourceChat: 12345,
    tpsHit: [],
    notificationMessageId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
    ...overrides,
  });

  beforeEach(() => {
    const pendingTrade = createTrade({ status: TradeStatus.PENDING });
    const activeTrade = createTrade({ status: TradeStatus.ACTIVE });
    const allTrades = [pendingTrade, activeTrade];

    mockRepository = {
      findById: jest.fn().mockResolvedValue(pendingTrade),
      findAll: jest.fn().mockResolvedValue(allTrades),
      update: jest.fn().mockResolvedValue(activeTrade),
    };

    mockCommandBus = {
      execute: jest.fn().mockResolvedValue(undefined),
    };

    mockTelegram = {
      sendMessage: jest.fn().mockResolvedValue(100),
      editMessage: jest.fn().mockResolvedValue(undefined),
    };

    mockTemplate = {
      formatTradeApproved: jest.fn().mockReturnValue('✅ Trade Approved - Monitoring started'),
    };

    const mockNotificationTemplates = {
      formatTradeCreated: jest.fn().mockReturnValue('🟢 NEW TRADE - BTCUSDT\n\nSide: LONG\nEntry: 50000\nSL: 49000\nTP: 52000'),
    };

    const mockDisplayService = {
      formatTradeList: jest.fn().mockReturnValue({
        trades: ['📊 TRADES (2)', '🟢 LONG BTCUSDT ✅ ACTIVE'],
        page: 1,
        pageSize: 100,
        total: 2,
        totalPages: 1,
      }),
    };

    const mockPriceCache = {
      getBySymbols: jest.fn().mockReturnValue([]),
    };

    const mockNotificationLog = {
      logSent: jest.fn(),
      wasSent: jest.fn().mockResolvedValue(false),
      getLastSent: jest.fn().mockResolvedValue(null),
      getForTrade: jest.fn().mockResolvedValue([]),
    };

    handler = new ApproveTradeHandler(
      mockLogger,
      mockRepository as any,
      mockCommandBus as any,
      mockTelegram as any,
      mockTemplate as any,
      mockNotificationTemplates as any,
      mockDisplayService as any,
      mockPriceCache as any,
      mockNotificationLog as any,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should find trade by ID', async () => {
      const command = new ApproveTradeCommand('trade-123', 12345);

      await handler.execute(command);

      expect(mockRepository.findById).toHaveBeenCalledWith('trade-123');
    });

    it('should start monitoring and update notificationMessageId', async () => {
      const command = new ApproveTradeCommand('trade-123', 12345);

      await handler.execute(command);

      expect(mockCommandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          tradeId: 'trade-123',
        })
      );
      expect(mockRepository.update).toHaveBeenCalledWith('trade-123', {
        notificationMessageId: expect.any(Number),
      });
    });

    it('should send start monitoring command', async () => {
      const command = new ApproveTradeCommand('trade-123', 12345);

      await handler.execute(command);

      expect(mockCommandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          tradeId: 'trade-123',
        })
      );
    });

    it('should send confirmation message to user', async () => {
      const command = new ApproveTradeCommand('trade-123', 12345);

      await handler.execute(command);

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.stringContaining('Trade Approved'),
        undefined,
        expect.any(Number)
      );
    });

    it('should format message using template', async () => {
      const command = new ApproveTradeCommand('trade-123', 12345);

      await handler.execute(command);

      expect(mockTemplate.formatTradeApproved).toHaveBeenCalled();
    });

    it('should log approval', async () => {
      const command = new ApproveTradeCommand('trade-123', 12345);
      const loggerSpy = jest.spyOn(handler['logger'], 'info');

      await handler.execute(command);

      expect(loggerSpy).toHaveBeenCalledWith('Approving trade trade-123');
    });
  });

  describe('error handling', () => {
    it('should handle trade not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const command = new ApproveTradeCommand('nonexistent', 12345);
      const loggerSpy = jest.spyOn(handler['logger'], 'error');

      await handler.execute(command);

      expect(loggerSpy).toHaveBeenCalledWith('Trade nonexistent not found');
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        12345,
        '❌ Trade not found. It may have been cancelled.',
        undefined,
        expect.any(Number)
      );
    });

    it('should log warning for non-PENDING trade', async () => {
      const activeTrade = createTrade({ status: TradeStatus.ACTIVE });
      mockRepository.findById.mockResolvedValue(activeTrade);

      const command = new ApproveTradeCommand('trade-123', 12345);
      const loggerSpy = jest.spyOn(handler['logger'], 'warn');

      await handler.execute(command);

      expect(loggerSpy).toHaveBeenCalledWith(
        'Trade trade-123 is not in PENDING status (current: active)'
      );
    });
  });
});