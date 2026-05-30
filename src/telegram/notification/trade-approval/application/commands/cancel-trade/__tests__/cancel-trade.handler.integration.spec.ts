import { CancelTradeHandler } from '../handler';
import { CancelTradeConfirmationCommand } from '../command';
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

describe('CancelTradeHandler (integration)', () => {
  let handler: CancelTradeHandler;
  let mockRepository: { findById: jest.Mock; update: jest.Mock };
  let mockTelegram: { sendMessage: jest.Mock };
  let mockTemplate: { formatTradeClosed: jest.Mock };

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
    mockRepository = {
      findById: jest.fn().mockResolvedValue(createTrade()),
      update: jest.fn().mockResolvedValue(createTrade({ status: TradeStatus.CANCELLED })),
    };

    mockTelegram = {
      sendMessage: jest.fn().mockResolvedValue(100),
    };

    mockTemplate = {
      formatTradeClosed: jest.fn().mockReturnValue('❌ Trade Cancelled - BTCUSDT\n\nTrade has been discarded.'),
    };

    handler = new CancelTradeHandler(
      mockLogger,
      mockRepository as any,
      mockTelegram as any,
      mockTemplate as any,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should find trade by ID', async () => {
      const command = new CancelTradeConfirmationCommand('trade-123', 12345);

      await handler.execute(command);

      expect(mockRepository.findById).toHaveBeenCalledWith('trade-123');
    });

    it('should update trade status to CANCELLED', async () => {
      const command = new CancelTradeConfirmationCommand('trade-123', 12345);

      await handler.execute(command);

      expect(mockRepository.update).toHaveBeenCalledWith('trade-123', {
        status: TradeStatus.CANCELLED,
      });
    });

    it('should send cancellation message to user', async () => {
      const command = new CancelTradeConfirmationCommand('trade-123', 12345);

      await handler.execute(command);

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.stringContaining('Trade Cancelled'),
        undefined,
        expect.any(Number)
      );
    });

    it('should format message using template', async () => {
      const command = new CancelTradeConfirmationCommand('trade-123', 12345);

      await handler.execute(command);

      expect(mockTemplate.formatTradeClosed).toHaveBeenCalledWith('BTCUSDT');
    });

    it('should log cancellation', async () => {
      const command = new CancelTradeConfirmationCommand('trade-123', 12345);
      const loggerSpy = jest.spyOn(handler['logger'], 'info');

      await handler.execute(command);

      expect(loggerSpy).toHaveBeenCalledWith('Closing trade trade-123');
    });
  });

  describe('error handling', () => {
    it('should handle trade not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const command = new CancelTradeConfirmationCommand('nonexistent', 12345);
      const loggerSpy = jest.spyOn(handler['logger'], 'error');

      await handler.execute(command);

      expect(loggerSpy).toHaveBeenCalledWith('Trade nonexistent not found');
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
        12345,
        '❌ Trade not found.',
        undefined,
        expect.any(Number)
      );
    });
  });
});