import { Test, TestingModule } from '@nestjs/testing';
import { EventBus, CommandBus } from '@nestjs/cqrs';
import { OnTriggerDetectedHandler } from '../on-trigger-detected.handler';
import { TriggerDetectedEvent } from '../../../domain/events/trigger-detected.event';
import { TransitionStateCommand } from '@trade/state/application/commands/transition-state.command';
import { Trade, TradeStatus, TradeSide, TriggerType, OrderType } from '@trade/shared';
import { TRADE_REPOSITORY_PORT } from '@trade/repository/domain/ports/trade-repository.port';
import { LOGGER_PORT, LoggerPort } from '@shared/domain/ports/logger.port';

describe('OnTriggerDetectedHandler', () => {
  let handler: OnTriggerDetectedHandler;
  let commandBus: jest.Mocked<CommandBus>;
  let mockRepository: { findById: jest.Mock; update: jest.Mock };

  const mockLogger: LoggerPort = {
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  };

  beforeEach(async () => {
    const mockCommandBus = {
      execute: jest.fn(),
    };

    mockRepository = {
      findById: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnTriggerDetectedHandler,
        { provide: CommandBus, useValue: mockCommandBus },
        { provide: TRADE_REPOSITORY_PORT, useValue: mockRepository },
        { provide: LOGGER_PORT, useValue: mockLogger },
      ],
    }).compile();

    handler = module.get<OnTriggerDetectedHandler>(OnTriggerDetectedHandler);
    commandBus = module.get(CommandBus);
  });

  const createTrade = (overrides: Partial<Trade> = {}): Trade => ({
    id: 'test-id',
    symbol: 'BTCUSDT',
    side: TradeSide.LONG,
    orderType: OrderType.LIMIT,
    entry: 50000,
    entryMax: null,
    entryExecutedPrice: null,
    entryExecutedAt: null,
    sl: 49000,
    tps: [52000, 54000],
    chartUrl: null,
    notes: null,
    status: TradeStatus.ACTIVE,
    sourceMessage: 'test',
    sourceChat: null,
    tpsHit: [],
    tradeAlertsMessageId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
    ...overrides,
  });

  describe('handle', () => {
    it('should execute TransitionStateCommand to ACTIVE for entry trigger', async () => {
      const trade = createTrade({ status: TradeStatus.PENDING });
      mockRepository.findById.mockResolvedValue(trade);
      const event = new TriggerDetectedEvent(trade, TriggerType.ENTRY, 50000);

      await handler.handle(event);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(TransitionStateCommand)
      );
      const calledCommand = commandBus.execute.mock.calls[0][0] as TransitionStateCommand;
      expect(calledCommand.tradeId).toBe('test-id');
      expect(calledCommand.targetStatus).toBe(TradeStatus.ACTIVE);
      expect(calledCommand.reason).toBe('entry_triggered');
      expect(mockRepository.update).toHaveBeenCalledWith('test-id', expect.objectContaining({
        entryExecutedPrice: 50000,
      }));
    });

    it('should execute TransitionStateCommand to CLOSED_WIN when all TPs hit', async () => {
      const trade = createTrade({ status: TradeStatus.ACTIVE, tps: [52000], tpsHit: [] });
      mockRepository.findById.mockResolvedValue(trade);
      const event = new TriggerDetectedEvent(trade, TriggerType.TP, 52000, 2, 0);

      await handler.handle(event);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(TransitionStateCommand)
      );
      const calledCommand = commandBus.execute.mock.calls[0][0] as TransitionStateCommand;
      expect(calledCommand.targetStatus).toBe(TradeStatus.CLOSED_WIN);
      expect(calledCommand.reason).toBe('all_tp_hit');
    });

    it('should execute TransitionStateCommand to PARTIAL_TP with tpsHit array', async () => {
      const trade = createTrade({ status: TradeStatus.ACTIVE, tps: [52000, 54000], tpsHit: [] });
      mockRepository.findById.mockResolvedValue(trade);
      const event = new TriggerDetectedEvent(trade, TriggerType.TP, 52000, 2, 0);

      await handler.handle(event);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(TransitionStateCommand)
      );
      const calledCommand = commandBus.execute.mock.calls[0][0] as TransitionStateCommand;
      expect(calledCommand.targetStatus).toBe(TradeStatus.PARTIAL_TP);
      expect(calledCommand.metadata?.tpsHit).toEqual([0]);
    });

    it('should execute TransitionStateCommand to CLOSED_LOSS for SL trigger', async () => {
      const trade = createTrade({ status: TradeStatus.ACTIVE });
      mockRepository.findById.mockResolvedValue(trade);
      const event = new TriggerDetectedEvent(trade, TriggerType.SL, 49000, -1);

      await handler.handle(event);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(TransitionStateCommand)
      );
      const calledCommand = commandBus.execute.mock.calls[0][0] as TransitionStateCommand;
      expect(calledCommand.targetStatus).toBe(TradeStatus.CLOSED_LOSS);
      expect(calledCommand.reason).toBe('sl_triggered');
    });
  });
});