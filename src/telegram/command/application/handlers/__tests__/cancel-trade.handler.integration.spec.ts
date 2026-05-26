import { Test, TestingModule } from '@nestjs/testing';
import { CancelTradeHandler } from '../cancel-trade.handler';
import { ValidationService } from '../../../domain/services/validation.service';
import { TradePort } from '../../../domain/ports/trade.port';
import { Trade, TradeStatus, TradeSide, OrderType } from '@trade/shared';

const TRADE_PORT = 'TRADE_PORT';

class MockTradeRepository implements TradePort {
  findById = jest.fn();
  findAll = jest.fn();
  findActive = jest.fn();
  findPending = jest.fn();
  update = jest.fn();
  delete = jest.fn();
}

describe('CancelTradeHandler (integration)', () => {
  let handler: CancelTradeHandler;
  let mockRepository: MockTradeRepository;

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
    status: TradeStatus.PENDING,
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
    mockRepository = new MockTradeRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CancelTradeHandler,
        ValidationService,
        { provide: TRADE_PORT, useValue: mockRepository },
      ],
    }).compile();

    handler = module.get<CancelTradeHandler>(CancelTradeHandler);
  });

  describe('execute', () => {
    it('should cancel pending trade successfully', async () => {
      const trade = createMockTrade({ id: 'trade-1', status: TradeStatus.PENDING });
      mockRepository.findById.mockResolvedValue(trade);
      mockRepository.update.mockResolvedValue({ ...trade, status: TradeStatus.CANCELLED });

      const result = await handler.execute({
        tradeId: 'trade-1',
        chatId: 123456,
      } as any);

      expect(result.success).toBe(true);
      expect(result.message).toContain('cancelled');
      expect(mockRepository.update).toHaveBeenCalledWith('trade-1', { status: 'cancelled' });
    });

    it('should return error when trade not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await handler.execute({
        tradeId: 'non-existent',
        chatId: 123456,
      } as any);

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should return error when trade is not pending', async () => {
      const trade = createMockTrade({ id: 'trade-1', status: TradeStatus.ACTIVE });
      mockRepository.findById.mockResolvedValue(trade);

      const result = await handler.execute({
        tradeId: 'trade-1',
        chatId: 123456,
      } as any);

      expect(result.success).toBe(false);
      expect(result.message).toContain('pending');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });
});