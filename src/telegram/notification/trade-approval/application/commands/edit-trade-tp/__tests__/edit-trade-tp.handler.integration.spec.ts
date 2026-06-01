import { EditTradeTPHandler } from '../handler';
import { EditTradeTPCommand } from '../command';
import { SqliteTradeAdapter } from '@trade/repository/infrastructure/adapters/sqlite-trade.adapter';
import { BinanceInfoService } from '../../../../domain/services/binance-info.service';
import { TradeApprovalService } from '../../../../domain/services/confirmation-template.service';
import { TELEGRAM_PORT } from '@telegram/core/domain/ports/telegram.port';
import { EditStateManager } from '../../../../domain/services/edit-state-manager.service';
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

interface BinanceInfoData {
  price: string;
  change24h: string;
  volume: string;
  high: string;
  low: string;
}

describe('EditTradeTPHandler (integration)', () => {
  let handler: EditTradeTPHandler;
  let mockRepository: { findById: jest.Mock; update: jest.Mock };
  let mockBinanceInfo: { getSymbolInfo: jest.Mock };
  let mockTemplate: { formatEditMode: jest.Mock };
  let mockTelegram: { sendMessage: jest.Mock; editMessage: jest.Mock };
  let mockEditStateManager: { clearEditingState: jest.Mock; getPendingTrade: jest.Mock };

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
    tps: [52000, 53000],
    chartUrl: null,
    notes: null,
    status: TradeStatus.PENDING,
    sourceMessage: 'LONG BTCUSDT 50000',
    sourceChat: 12345,
    tpsHit: [],
    tradeAlertsMessageId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
    ...overrides,
  });

  const binanceInfo: BinanceInfoData = {
    price: '50000.0000',
    change24h: '+1.50%',
    volume: '$1500.00M',
    high: '51000.0000',
    low: '49000.0000',
  };

  beforeEach(() => {
    mockRepository = {
      findById: jest.fn().mockResolvedValue(createTrade()),
      update: jest.fn().mockResolvedValue(createTrade({ tps: [52000, 53000, 54000] })),
    };

    mockBinanceInfo = {
      getSymbolInfo: jest.fn().mockResolvedValue(binanceInfo),
    };

    mockTemplate = {
      formatEditMode: jest.fn().mockReturnValue({
        text: '✏️ Edit Trade - BTC\n\nSelect field to edit:',
        buttons: {
          edit: [[{ text: 'Side: LONG', callback_data: 'edit_side:trade-123' }]],
          approve: [[{ text: '💾 Save Changes', callback_data: 'confirm_approve:trade-123' }]],
          cancel: [[{ text: '❌ Cancel', callback_data: 'confirm_cancel:trade-123' }]],
        },
      }),
    };

    mockTelegram = {
      sendMessage: jest.fn().mockResolvedValue(100),
      editMessage: jest.fn().mockResolvedValue(undefined),
    };

    mockEditStateManager = {
      clearEditingState: jest.fn(),
      getPendingTrade: jest.fn().mockReturnValue({ confirmationMessageId: 100 }),
    };

    handler = new EditTradeTPHandler(
      mockLogger,
      mockRepository as any,
      mockBinanceInfo as any,
      mockTemplate as any,
      mockTelegram as any,
      mockEditStateManager as any,
    );
  });

  describe('execute', () => {
    it('should add a new TP', async () => {
      const command = new EditTradeTPCommand('trade-123', 'add', 12345, '54000');

      await handler.execute(command);

      expect(mockRepository.update).toHaveBeenCalledWith('trade-123', { tps: [52000, 53000, 54000] });
      expect(mockEditStateManager.clearEditingState).toHaveBeenCalledWith(12345, 'trade-123');
    });

    it('should remove the last TP', async () => {
      const command = new EditTradeTPCommand('trade-123', 'remove', 12345);

      await handler.execute(command);

      expect(mockRepository.update).toHaveBeenCalledWith('trade-123', { tps: [52000] });
    });

    it('should send message if trade not found', async () => {
      mockRepository.findById.mockResolvedValue(null);
      const command = new EditTradeTPCommand('nonexistent', 'add', 12345, '54000');

      await handler.execute(command);

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(12345, '❌ Trade not found.', undefined, expect.any(Number));
    });

    it('should send message if add action without value', async () => {
      const command = new EditTradeTPCommand('trade-123', 'add', 12345);

      await handler.execute(command);

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(12345, 'Please provide the TP value.', undefined, expect.any(Number));
    });

    it('should send message for invalid TP value', async () => {
      const command = new EditTradeTPCommand('trade-123', 'add', 12345, 'invalid');

      await handler.execute(command);

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(12345, 'Invalid TP value.', undefined, expect.any(Number));
    });

    it('should send message if no TPs to remove', async () => {
      mockRepository.findById.mockResolvedValue(createTrade({ tps: [] }));
      const command = new EditTradeTPCommand('trade-123', 'remove', 12345);

      await handler.execute(command);

      expect(mockTelegram.sendMessage).toHaveBeenCalledWith(12345, 'No TPs to remove.', undefined, expect.any(Number));
    });

    it('should update message with new TP list after add', async () => {
      const command = new EditTradeTPCommand('trade-123', 'add', 12345, '54000');

      await handler.execute(command);

      expect(mockTelegram.editMessage).toHaveBeenCalled();
    });

    it('should send new message if no confirmationMessageId', async () => {
      mockEditStateManager.getPendingTrade.mockReturnValue(null);
      const command = new EditTradeTPCommand('trade-123', 'remove', 12345);

      await handler.execute(command);

      expect(mockTelegram.sendMessage).toHaveBeenCalled();
      expect(mockTelegram.editMessage).not.toHaveBeenCalled();
    });
  });
});