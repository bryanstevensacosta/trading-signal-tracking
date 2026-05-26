import { Test, TestingModule } from '@nestjs/testing';
import { CloseTradeHandler } from '../close-trade.handler';
import { ValidationService } from '../../../domain/services/validation.service';
import { TRADE_PORT_TOKEN, TradePort } from '../../../domain/ports/trade.port';
import { Trade, TradeStatus, TradeSide, OrderType } from '@trade/shared';

describe('CloseTradeHandler (integration)', () => {
  let handler: CloseTradeHandler;
  let mockRepository: jest.Mocked<TradePort>;

  const createMockTrade = (partial: Partial<Trade> = {}): Trade => ({
    id: 'test-id-1',
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
    sourceMessage: 'test',
    sourceChat: null,
    tpsHit: [],
    notificationMessageId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
    ...partial,
  });

  beforeEach(async () => {
    mockRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      findActive: jest.fn(),
      findPending: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CloseTradeHandler,
        { provide: TRADE_PORT_TOKEN, useValue: mockRepository },
        ValidationService,
      ],
    }).compile();

    handler = module.get<CloseTradeHandler>(CloseTradeHandler);
  });

  describe('execute', () => {
    it('should close active trade', async () => {
      const trade = createMockTrade({ id: 'trade-1', status: TradeStatus.ACTIVE });
      mockRepository.findById.mockResolvedValue(trade);
      mockRepository.update.mockResolvedValue({ ...trade, status: TradeStatus.CLOSED_MANUAL });

      const result = await handler.execute({
        tradeId: 'trade-1',
        chatId: 123456,
      } as any);

      expect(result.success).toBe(true);
      expect(result.message).toContain('closed manually');
      expect(mockRepository.update).toHaveBeenCalledWith('trade-1', {
        status: 'closed_manual',
        closedAt: expect.any(Date),
      });
    });

    it('should close partial TP trade', async () => {
      const trade = createMockTrade({ id: 'trade-1', status: TradeStatus.PARTIAL_TP });
      mockRepository.findById.mockResolvedValue(trade);
      mockRepository.update.mockResolvedValue({ ...trade, status: TradeStatus.CLOSED_MANUAL });

      const result = await handler.execute({
        tradeId: 'trade-1',
        chatId: 123456,
      } as any);

      expect(result.success).toBe(true);
    });

    it('should return error for pending trade', async () => {
      const trade = createMockTrade({ id: 'trade-1', status: TradeStatus.PENDING });
      mockRepository.findById.mockResolvedValue(trade);

      const result = await handler.execute({
        tradeId: 'trade-1',
        chatId: 123456,
      } as any);

      expect(result.success).toBe(false);
      expect(result.message).toContain('active');
    });

    it('should return error for closed trade', async () => {
      const trade = createMockTrade({ id: 'trade-1', status: TradeStatus.CLOSED_WIN });
      mockRepository.findById.mockResolvedValue(trade);

      const result = await handler.execute({
        tradeId: 'trade-1',
        chatId: 123456,
      } as any);

      expect(result.success).toBe(false);
    });
  });
});