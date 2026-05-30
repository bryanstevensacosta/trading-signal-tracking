import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus } from '@nestjs/cqrs';
import { OnTradeReceivedHandler } from '../on-trade-received.handler';
import { TradeReceivedEvent } from '../../../domain/events/trade-received.event';
import { MessageSourceVO } from '../../../domain/value-objects/message-source.vo';
import { ParseTradeCommand } from '../../../../parsing/application/commands/parse-trade/command';
import { SendConfirmationCommand } from '@telegram/notification/trade-approval/application/commands/send-confirmation/command';
import { TradeSide } from '@trade/shared';
import { LoggerPort, LOGGER_PORT } from '@shared/domain/ports/logger.port';

const mockLogger: LoggerPort = {
  trace: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
};

describe('OnTradeReceivedHandler', () => {
  let handler: OnTradeReceivedHandler;
  let commandBus: { execute: jest.Mock };

  beforeEach(async () => {
    commandBus = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnTradeReceivedHandler,
        { provide: CommandBus, useValue: commandBus },
        { provide: LOGGER_PORT, useValue: mockLogger },
      ],
    }).compile();

    handler = module.get<OnTradeReceivedHandler>(OnTradeReceivedHandler);
  });

  describe('handle', () => {
    it('should parse and send confirmation when parsing succeeds', async () => {
      const text = 'LONG BTCUSDT Entry: 50000 SL: 49000 TP1: 52000';
      const source = new MessageSourceVO(123456789, 42);
      const event = new TradeReceivedEvent(text, source);

      commandBus.execute.mockResolvedValueOnce({
        success: true,
        data: {
          symbol: 'BTCUSDT',
          side: TradeSide.LONG,
          orderType: 'limit' as const,
          entry: 50000,
          entryMax: null,
          sl: 49000,
          tps: [52000],
          chartUrl: null,
          notes: null,
        },
      });

      await handler.handle(event);

      expect(commandBus.execute).toHaveBeenCalledTimes(2);
      
      const parseCall = commandBus.execute.mock.calls[0][0];
      expect(parseCall).toBeInstanceOf(ParseTradeCommand);

      const confirmationCall = commandBus.execute.mock.calls[1][0];
      expect(confirmationCall).toBeInstanceOf(SendConfirmationCommand);
    });

    it('should not send confirmation when parsing fails', async () => {
      const text = 'invalid message';
      const source = new MessageSourceVO(123456789, 42);
      const event = new TradeReceivedEvent(text, source);

      commandBus.execute.mockResolvedValueOnce({
        success: false,
        data: null,
        errors: ['Missing symbol'],
      });

      await handler.handle(event);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(ParseTradeCommand),
      );

      const confirmationCall = commandBus.execute.mock.calls.find(
        (call) => call[0] instanceof SendConfirmationCommand,
      );
      expect(confirmationCall).toBeUndefined();
    });

    it('should handle parse result without data', async () => {
      const text = 'some text';
      const source = new MessageSourceVO(123456789, 42);
      const event = new TradeReceivedEvent(text, source);

      commandBus.execute.mockResolvedValueOnce({
        success: false,
        data: null,
        errors: ['Parse error'],
      });

      await handler.handle(event);

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
    });

    it('should pass message text to parse command', async () => {
      const text = 'SHORT ETHUSDT Entry: 3000 SL: 3100 TP1: 3200';
      const source = new MessageSourceVO(987654321, 99);
      const event = new TradeReceivedEvent(text, source);

      commandBus.execute.mockResolvedValueOnce({
        success: true,
        data: {
          symbol: 'ETHUSDT',
          side: TradeSide.SHORT,
          orderType: 'limit' as const,
          entry: 3000,
          entryMax: null,
          sl: 3100,
          tps: [3200],
          chartUrl: null,
          notes: null,
        },
      });

      await handler.handle(event);

      const parseCommand = commandBus.execute.mock.calls[0][0] as ParseTradeCommand;
      expect(parseCommand.message).toBe(text);
    });

    it('should create confirmation with all parsed data', async () => {
      const text = 'LONG BTCUSDT Entry: 50000 SL: 49000 TP1: 52000 TP2: 54000';
      const source = new MessageSourceVO(123456789, 42, 'testuser');
      const event = new TradeReceivedEvent(text, source);

      commandBus.execute.mockResolvedValueOnce({
        success: true,
        data: {
          symbol: 'BTCUSDT',
          side: TradeSide.LONG,
          orderType: 'limit' as const,
          entry: 50000,
          entryMax: 51000,
          sl: 49000,
          tps: [52000, 54000],
          chartUrl: 'https://example.com/chart',
          notes: 'Test signal',
        },
      });

      await handler.handle(event);

      const confirmationCommand = commandBus.execute.mock.calls[1][0] as SendConfirmationCommand;
      expect(confirmationCommand.parsedTrade.symbol).toBe('BTCUSDT');
      expect(confirmationCommand.parsedTrade.side).toBe(TradeSide.LONG);
      expect(confirmationCommand.parsedTrade.entry).toBe(50000);
      expect(confirmationCommand.parsedTrade.entryMax).toBe(51000);
      expect(confirmationCommand.parsedTrade.sl).toBe(49000);
      expect(confirmationCommand.parsedTrade.tps).toEqual([52000, 54000]);
      expect(confirmationCommand.parsedTrade.chartUrl).toBe('https://example.com/chart');
      expect(confirmationCommand.parsedTrade.notes).toBe('Test signal');
      expect(confirmationCommand.sourceMessage).toBe(text);
      expect(confirmationCommand.chatId).toBe(123456789);
    });
  });
});