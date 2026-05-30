import { SendConfirmationHandler } from '../handler';
import { SendConfirmationCommand } from '../command';
import { TradeApprovalService } from '../../../../domain/services/confirmation-template.service';
import { BinanceInfoService } from '../../../../domain/services/binance-info.service';
import { EditStateManager } from '../../../../domain/services/edit-state-manager.service';
import { TELEGRAM_PORT } from '@telegram/core/domain/ports/telegram.port';
import { ParsedTradeData, TradeSide, OrderType, CreateTradeInput } from '@trade/shared';
import { LoggerPort } from '../../../../../../../shared';

const mockLogger: LoggerPort = {
  trace: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
};

describe('SendConfirmationHandler (integration)', () => {
  let handler: SendConfirmationHandler;
  let mockCommandBus: { execute: jest.Mock };
  let mockBinanceInfo: { getSymbolInfo: jest.Mock };
  let mockTemplate: TradeApprovalService;
  let mockTelegram: { sendMessage: jest.Mock; editMessage: jest.Mock };
  let mockEditStateManager: EditStateManager;

  const createParsedTrade = (): ParsedTradeData => ({
    symbol: 'BTCUSDT',
    side: TradeSide.LONG,
    orderType: OrderType.LIMIT,
    entry: 50000,
    entryMax: null,
    sl: 49000,
    tps: [52000],
    chartUrl: null,
    notes: null,
  });

  beforeEach(() => {
    const mockSavedTrade = {
      id: 'saved-trade-123',
      symbol: 'BTCUSDT',
      side: TradeSide.LONG,
      orderType: OrderType.LIMIT,
      entry: 50000,
      entryMax: null,
      sl: 49000,
      tps: [52000],
      status: 'pending',
      createdAt: new Date(),
    };

    mockCommandBus = {
      execute: jest.fn().mockResolvedValue(mockSavedTrade),
    };

    mockBinanceInfo = {
      getSymbolInfo: jest.fn().mockResolvedValue({
        price: '50100.0000',
        change24h: '+1.50%',
        volume: '$1.5M',
        high: '51000.0000',
        low: '49000.0000',
      }),
    };

    mockTemplate = {
      formatConfirmation: jest.fn().mockReturnValue({
        text: '📊 Confirm Trade - BTC\n\n🟢 Direction: LONG\n📍 Entry: 50000',
        buttons: {
          edit: [[{ text: '📋 Edit Trade', callback_data: 'confirm_edit:saved-trade-123' }]],
          approve: [[{ text: '✅ Approve', callback_data: 'confirm_approve:saved-trade-123' }]],
          cancel: [[{ text: '❌ Cancel', callback_data: 'confirm_cancel:saved-trade-123' }]],
        },
      }),
      formatEditMode: jest.fn().mockReturnValue({
        text: '✏️ Edit Trade',
        buttons: {
          edit: [[{ text: 'Side: LONG', callback_data: 'edit_side:saved-trade-123' }]],
          approve: [[{ text: '💾 Save', callback_data: 'confirm_approve:saved-trade-123' }]],
          cancel: [[{ text: '❌ Cancel', callback_data: 'confirm_cancel:saved-trade-123' }]],
        },
      }),
    } as any;

    mockTelegram = {
      sendMessage: jest.fn().mockResolvedValue(999),
      editMessage: jest.fn().mockResolvedValue(undefined),
    };

    mockEditStateManager = new EditStateManager();

    handler = new SendConfirmationHandler(
      mockLogger,
      mockBinanceInfo as any,
      mockTemplate,
      mockTelegram as any,
      mockCommandBus as any,
      mockEditStateManager,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should save trade with PENDING status', async () => {
      const command = new SendConfirmationCommand(createParsedTrade(), 12345, 'LONG BTCUSDT 50000');

      await handler.execute(command);

      expect(mockCommandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            symbol: 'BTCUSDT',
            side: TradeSide.LONG,
            entry: 50000,
            sourceChat: 12345,
          }),
        })
      );
    });

    it('should fetch Binance info for symbol', async () => {
      const command = new SendConfirmationCommand(createParsedTrade(), 12345, 'LONG BTCUSDT 50000');

      await handler.execute(command);

      expect(mockBinanceInfo.getSymbolInfo).toHaveBeenCalledWith('BTCUSDT', 'LONG');
    });

    it('should format confirmation message', async () => {
      const command = new SendConfirmationCommand(createParsedTrade(), 12345, 'LONG BTCUSDT 50000');

      await handler.execute(command);

      expect(mockTemplate.formatConfirmation).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ price: '50100.0000' }),
        'saved-trade-123'
      );
    });

    it('should send telegram message', async () => {
      const command = new SendConfirmationCommand(createParsedTrade(), 12345, 'LONG BTCUSDT 50000');

      await handler.execute(command);

      expect(mockTelegram.sendMessage).toHaveBeenCalledTimes(1);
      const [chatId, text, options] = mockTelegram.sendMessage.mock.calls[0];
      expect(chatId).toBe(12345);
      expect(typeof text).toBe('string');
      expect(text).toContain('Confirm Trade');
      expect(text).toContain('BTC');
      expect(options).toHaveProperty('inline_keyboard');
      expect(Array.isArray(options.inline_keyboard)).toBe(true);
    });

    it('should store pending trade in EditStateManager', async () => {
      const command = new SendConfirmationCommand(createParsedTrade(), 12345, 'LONG BTCUSDT 50000');

      await handler.execute(command);

      const pending = mockEditStateManager.getPendingTrade(12345, 'saved-trade-123');
      expect(pending).toBeDefined();
      expect(pending!.confirmationMessageId).toBe(999);
    });

    it('should return trade ID', async () => {
      const command = new SendConfirmationCommand(createParsedTrade(), 12345, 'LONG BTCUSDT 50000');

      const result = await handler.execute(command);

      expect(result).toBe('saved-trade-123');
    });
  });
});