import { TransitionStateHandler } from '../transition-state.handler';
import { TransitionStateCommand } from '../transition-state.command';
import { StateMachineService } from '../../../domain/services/state-machine.service';
import { StateChangedEvent } from '../../../domain/events/state-changed.event';
import { Trade, TradeStatus, TradeSide, OrderType } from '@trade/shared';

describe('TransitionStateHandler', () => {
  let handler: TransitionStateHandler;
  let mockRepository: { findById: jest.Mock; update: jest.Mock };
  let stateMachine: StateMachineService;
  let mockEventBus: { publish: jest.Mock };

  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      update: jest.fn(),
    };

    mockEventBus = {
      publish: jest.fn(),
    };

    stateMachine = new StateMachineService();
    const mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), trace: jest.fn() };
    handler = new TransitionStateHandler(
      mockRepository as any,
      stateMachine,
      mockEventBus as any,
      mockLogger as any,
    );
  });

  const createTrade = (id: string, status: TradeStatus): Trade => ({
    id,
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
    status,
    sourceMessage: 'test',
    sourceChat: null,
    tpsHit: [],
    notificationMessageId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
  });

  describe('execute', () => {
    it('should transition PENDING to ACTIVE', async () => {
      const tradeId = 'test-id';
      const trade = createTrade(tradeId, TradeStatus.PENDING);
      const updatedTrade = { ...trade, status: TradeStatus.ACTIVE };

      mockRepository.findById.mockResolvedValue(trade);
      mockRepository.update.mockResolvedValue(undefined);
      mockRepository.findById
        .mockResolvedValueOnce(trade)
        .mockResolvedValueOnce(updatedTrade);

      const command = new TransitionStateCommand(
        tradeId,
        TradeStatus.ACTIVE,
        'entry_triggered',
      );

      const result = await handler.execute(command);

      expect(mockRepository.findById).toHaveBeenCalledWith(tradeId);
      expect(mockRepository.update).toHaveBeenCalledWith(tradeId, {
        status: TradeStatus.ACTIVE,
        closedAt: undefined,
      });
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.any(StateChangedEvent),
      );
      expect(result.status).toBe(TradeStatus.ACTIVE);
    });

    it('should transition ACTIVE to CLOSED_WIN', async () => {
      const tradeId = 'test-id';
      const trade = createTrade(tradeId, TradeStatus.ACTIVE);
      const updatedTrade = { ...trade, status: TradeStatus.CLOSED_WIN, closedAt: new Date() };

      mockRepository.findById.mockResolvedValue(trade);
      mockRepository.update.mockResolvedValue(undefined);
      mockRepository.findById
        .mockResolvedValueOnce(trade)
        .mockResolvedValueOnce(updatedTrade);

      const command = new TransitionStateCommand(
        tradeId,
        TradeStatus.CLOSED_WIN,
        'all_tp_hit',
      );

      const result = await handler.execute(command);

      expect(mockRepository.update).toHaveBeenCalledWith(tradeId, {
        status: TradeStatus.CLOSED_WIN,
        closedAt: expect.any(Date),
      });
      expect(result.status).toBe(TradeStatus.CLOSED_WIN);
    });

    it('should throw error when trade not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const command = new TransitionStateCommand(
        'non-existent-id',
        TradeStatus.ACTIVE,
      );

      await expect(handler.execute(command)).rejects.toThrow('Trade not found');
    });

    it('should throw error for invalid transition', async () => {
      const tradeId = 'test-id';
      const trade = createTrade(tradeId, TradeStatus.CLOSED_WIN);

      mockRepository.findById.mockResolvedValue(trade);

      const command = new TransitionStateCommand(
        tradeId,
        TradeStatus.ACTIVE,
      );

      await expect(handler.execute(command)).rejects.toThrow('Invalid transition');
    });

    it('should set closedAt for closed statuses', async () => {
      const tradeId = 'test-id';
      const trade = createTrade(tradeId, TradeStatus.ACTIVE);
      const updatedTrade = { ...trade, status: TradeStatus.CLOSED_LOSS, closedAt: new Date() };

      mockRepository.findById.mockResolvedValue(trade);
      mockRepository.update.mockResolvedValue(undefined);
      mockRepository.findById
        .mockResolvedValueOnce(trade)
        .mockResolvedValueOnce(updatedTrade);

      const command = new TransitionStateCommand(
        tradeId,
        TradeStatus.CLOSED_LOSS,
        'sl_triggered',
      );

      await handler.execute(command);

      expect(mockRepository.update).toHaveBeenCalledWith(tradeId, {
        status: TradeStatus.CLOSED_LOSS,
        closedAt: expect.any(Date),
      });
    });

    it('should set closedAt for cancelled status', async () => {
      const tradeId = 'test-id';
      const trade = createTrade(tradeId, TradeStatus.PENDING);
      const updatedTrade = { ...trade, status: TradeStatus.CANCELLED, closedAt: new Date() };

      mockRepository.findById.mockResolvedValue(trade);
      mockRepository.update.mockResolvedValue(undefined);
      mockRepository.findById
        .mockResolvedValueOnce(trade)
        .mockResolvedValueOnce(updatedTrade);

      const command = new TransitionStateCommand(
        tradeId,
        TradeStatus.CANCELLED,
        'cancelled',
      );

      await handler.execute(command);

      expect(mockRepository.update).toHaveBeenCalledWith(tradeId, {
        status: TradeStatus.CANCELLED,
        closedAt: expect.any(Date),
      });
    });
  });
});