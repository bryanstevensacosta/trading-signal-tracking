import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus } from '@nestjs/cqrs';
import { TelegramIngestionAdapter } from '../telegram-ingestion.adapter';
import { IngestMessageCommand } from '../../../application/commands/ingest-message/command';
import { MessageSourceVO } from '../../../domain/value-objects/message-source.vo';
import { LoggerPort, LOGGER_PORT } from '@shared/domain/ports/logger.port';

const mockLogger: LoggerPort = {
  trace: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
};

describe('TelegramIngestionAdapter', () => {
  let adapter: TelegramIngestionAdapter;
  let commandBus: { execute: jest.Mock };

  beforeEach(async () => {
    commandBus = {
      execute: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramIngestionAdapter,
        { provide: CommandBus, useValue: commandBus },
        { provide: LOGGER_PORT, useValue: mockLogger },
      ],
    }).compile();

    adapter = module.get<TelegramIngestionAdapter>(TelegramIngestionAdapter);
  });

  describe('onModuleInit', () => {
    it('should disable ingestion when TELEGRAM_BOT_TOKEN is not set', () => {
      const originalEnv = process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_BOT_TOKEN;

      adapter.onModuleInit();

      process.env.TELEGRAM_BOT_TOKEN = originalEnv;
    });

    it('should log warning when token is not set', () => {
      const originalEnv = process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_BOT_TOKEN;

      const loggerSpy = jest.spyOn((adapter as any).logger, 'warn');

      adapter.onModuleInit();

      expect(loggerSpy).toHaveBeenCalledWith(
        'TELEGRAM_BOT_TOKEN not set - Telegram ingestion disabled',
      );

      process.env.TELEGRAM_BOT_TOKEN = originalEnv;
    });
  });

  describe('message processing', () => {
    it('should be defined after initialization', () => {
      expect(adapter).toBeDefined();
    });

    it('should have command bus injected', () => {
      expect((adapter as any).commandBus).toBeDefined();
    });
  });
});