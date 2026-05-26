import { Test, TestingModule } from '@nestjs/testing';
import { ModifyEntryHandler } from '../modify-entry.handler';
import { ValidationService } from '../../../domain/services/validation.service';
import { TRADE_PORT_TOKEN, TradePort } from '../../../domain/ports/trade.port';
import { Trade, TradeStatus, TradeSide, OrderType } from '@trade/shared';

describe('ModifyEntryHandler (integration)', () => {
  let handler: ModifyEntryHandler;
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
        ModifyEntryHandler,
        { provide: TRADE_PORT_TOKEN, useValue: mockRepository },
        ValidationService,
      ],
    }).compile();

    handler = module.get<ModifyEntryHandler>(ModifyEntryHandler);
  });

  describe('execute', () => {
    it('should modify entry for pending trade', async () => {
      const trade = createMockTrade({ id: 'trade-1', status: TradeStatus.PENDING });
      mockRepository.findById.mockResolvedValue(trade);
      mockRepository.update.mockResolvedValue({ ...trade, entry: 51000 });

      const result = await handler.execute({
        tradeId: 'trade-1',
        newEntry: 51000,
        chatId: 123456,
      } as any);

      expect(result.success).toBe(true);
      expect(result.message).toContain('51000');
      expect(mockRepository.update).toHaveBeenCalledWith('trade-1', { entry: 51000 });
    });

    it('should return error when trade not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await handler.execute({
        tradeId: 'non-existent',
        newEntry: 51000,
        chatId: 123456,
      } as any);

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should return error when entry is below SL', async () => {
      const trade = createMockTrade({ id: 'trade-1', status: TradeStatus.PENDING, sl: 49000 });
      mockRepository.findById.mockResolvedValue(trade);

      const result = await handler.execute({
        tradeId: 'trade-1',
        newEntry: 48000,
        chatId: 123456,
      } as any);

      expect(result.success).toBe(false);
      expect(result.message).toContain('below SL');
    });

    it('should return error for non-pending trade', async () => {
      const trade = createMockTrade({ id: 'trade-1', status: TradeStatus.ACTIVE });
      mockRepository.findById.mockResolvedValue(trade);

      const result = await handler.execute({
        tradeId: 'trade-1',
        newEntry: 51000,
        chatId: 123456,
      } as any);

      expect(result.success).toBe(false);
      expect(result.message).toContain('pending');
    });
  });
});