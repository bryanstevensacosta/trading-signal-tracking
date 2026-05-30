import { EditTradeFieldHandler } from '../handler';
import { EditTradeFieldCommand } from '../command';
import { SqliteTradeAdapter } from '@trade/repository/infrastructure/adapters/sqlite-trade.adapter';
import { TradeApprovalService } from '../../../../domain/services/confirmation-template.service';
import { BinanceInfoService } from '../../../../domain/services/binance-info.service';
import { EditStateManager } from '../../../../domain/services/edit-state-manager.service';
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

describe('EditTradeFieldHandler (integration)', () => {
  let handler: EditTradeFieldHandler;
  let mockRepository: { findById: jest.Mock; update: jest.Mock };
  let mockBinanceInfo: { getSymbolInfo: jest.Mock };
  let mockTemplate: { formatEditMode: jest.Mock };
  let mockTelegram: { sendMessage: jest.Mock; editMessage: jest.Mock };
  let editStateManager: EditStateManager;

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
    const trade = createTrade();
    const updatedTrade = createTrade({ entry: 51000 });

    mockRepository = {
      findById: jest.fn().mockResolvedValue(trade),
      update: jest.fn().mockResolvedValue(updatedTrade),
    };

    mockBinanceInfo = {
      getSymbolInfo: jest.fn().mockResolvedValue({
        price: '51100.0000',
        change24h: '+2.00%',
        volume: '$2.0M',
        high: '52000.0000',
        low: '50000.0000',
      }),
    };

    mockTemplate = {
      formatEditMode: jest.fn().mockReturnValue({
        text: '✏️ Edit Trade - BTC\n\n📍 Entry: 51000',
        buttons: {
          edit: [[{ text: 'Side: LONG', callback_data: 'edit_side:trade-123' }]],
          approve: [[{ text: '💾 Save', callback_data: 'confirm_approve:trade-123' }]],
          cancel: [[{ text: '❌ Cancel', callback_data: 'confirm_cancel:trade-123' }]],
        },
      }),
    };

    mockTelegram = {
      sendMessage: jest.fn().mockResolvedValue(100),
      editMessage: jest.fn().mockResolvedValue(undefined),
    };

    editStateManager = new EditStateManager();
    editStateManager.addPendingTrade(12345, 'trade-123', 100, 200);

    handler = new EditTradeFieldHandler(
      mockLogger,
      mockRepository as any,
      mockBinanceInfo as any,
      mockTemplate as any,
      mockTelegram as any,
      editStateManager,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should find trade by ID', async () => {
      const command = new EditTradeFieldCommand('trade-123', 'entry', '51000', 12345);

      await handler.execute(command);

      expect(mockRepository.findById).toHaveBeenCalledWith('trade-123');
    });

    it('should update entry field', async () => {
      const command = new EditTradeFieldCommand('trade-123', 'entry', '51000', 12345);

      await handler.execute(command);

      expect(mockRepository.update).toHaveBeenCalledWith('trade-123', { entry: 51000 });
    });

    it('should update side field', async () => {
      const command = new EditTradeFieldCommand('trade-123', 'side', 'SHORT', 12345);

      await handler.execute(command);

      expect(mockRepository.update).toHaveBeenCalledWith('trade-123', { side: 'SHORT' });
    });

    it('should update sl field', async () => {
      const command = new EditTradeFieldCommand('trade-123', 'sl', '48000', 12345);

      await handler.execute(command);

      expect(mockRepository.update).toHaveBeenCalledWith('trade-123', { sl: 48000 });
    });

    it('should parse comma-separated TPs', async () => {
      const command = new EditTradeFieldCommand('trade-123', 'tps', '52000,53000,54000', 12345);

      await handler.execute(command);

      expect(mockRepository.update).toHaveBeenCalledWith('trade-123', {
        tps: [52000, 53000, 54000],
      });
    });

    it('should clear editing state after update', async () => {
      const command = new EditTradeFieldCommand('trade-123', 'entry', '51000', 12345);

      await handler.execute(command);

      expect(editStateManager.isWaitingForValue(12345, 'trade-123')).toBe(false);
    });

    it('should fetch Binance info', async () => {
      const command = new EditTradeFieldCommand('trade-123', 'entry', '51000', 12345);

      await handler.execute(command);

      expect(mockBinanceInfo.getSymbolInfo).toHaveBeenCalledWith('BTCUSDT', 'LONG');
    });

    it('should format edit mode message', async () => {
      const command = new EditTradeFieldCommand('trade-123', 'entry', '51000', 12345);

      await handler.execute(command);

      expect(mockTemplate.formatEditMode).toHaveBeenCalled();
    });

    it('should edit message when pending trade exists', async () => {
      const command = new EditTradeFieldCommand('trade-123', 'entry', '51000', 12345);

      await handler.execute(command);

      expect(mockTelegram.editMessage).toHaveBeenCalledTimes(1);
      const [chatId, messageId, text, replyMarkup] = mockTelegram.editMessage.mock.calls[0];
      expect(chatId).toBe(12345);
      expect(messageId).toBe(200);
      expect(typeof text).toBe('string');
      expect(text).toContain('Edit Trade');
      expect(text).toContain('Entry:');
      expect(replyMarkup).toHaveProperty('inline_keyboard');
    });

    it('should send message when no pending trade', async () => {
      editStateManager.removePendingTrade(12345, 'trade-123');
      const command = new EditTradeFieldCommand('trade-123', 'entry', '51000', 12345);

      await handler.execute(command);

      expect(mockTelegram.sendMessage).toHaveBeenCalled();
      expect(mockTelegram.editMessage).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle trade not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const command = new EditTradeFieldCommand('nonexistent', 'entry', '51000', 12345);
      const loggerSpy = jest.spyOn(handler['logger'], 'error');

      await handler.execute(command);

      expect(loggerSpy).toHaveBeenCalledWith('Trade nonexistent not found');
      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(12345, '❌ Trade not found.', undefined, expect.any(Number));
    });

    it('should warn on unknown field', async () => {
      const command = new EditTradeFieldCommand('trade-123', 'unknown_field', 'value', 12345);
      const loggerSpy = jest.spyOn(handler['logger'], 'warn');

      await handler.execute(command);

      expect(loggerSpy).toHaveBeenCalledWith('Unknown field: unknown_field');
    });
  });
});