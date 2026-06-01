import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { CommandBus, QueryBus, EventBus } from '@nestjs/cqrs';
import { IngestionService } from '../../src/trade/ingestion/domain/services/ingestion.service';
import { MessageFilterService } from '../../src/trade/ingestion/domain/services/message-filter.service';
import { IngestMessageHandler } from '../../src/trade/ingestion/application/commands/ingest-message/handler';
import { OnTradeReceivedHandler } from '../../src/trade/ingestion/application/event-handlers/on-trade-received.handler';
import { IngestMessageCommand } from '../../src/trade/ingestion/application/commands/ingest-message/command';
import { MessageSourceVO } from '../../src/trade/ingestion/domain/value-objects/message-source.vo';
import { TradeEntity } from '../../src/trade/repository/infrastructure/persistence/trade.entity';
import { SqliteTradeAdapter } from '../../src/trade/repository/infrastructure/adapters/sqlite-trade.adapter';
import { TradeStatus, TradeSide } from '../../src/trade/shared';
import { LoggerPort, LOGGER_PORT } from '../../src/shared/domain/ports/logger.port';
import { TRADE_REPOSITORY_PORT } from '../../src/trade/repository/domain/ports/trade-repository.port';

describe('Trade Ingestion (e2e)', () => {
  let commandBus: CommandBus;
  let eventBus: EventBus;
  let ingestionService: IngestionService;
  let filterService: MessageFilterService;

  const mockLogger: LoggerPort = {
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  };

  const mockRepository = {
    findPending: jest.fn().mockResolvedValue([]),
    findById: jest.fn(),
    update: jest.fn(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [TradeEntity],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([TradeEntity]),
        CqrsModule.forRoot(),
      ],
      providers: [
        { provide: LOGGER_PORT, useValue: mockLogger },
        { provide: TRADE_REPOSITORY_PORT, useValue: mockRepository },
        IngestionService,
        MessageFilterService,
        IngestMessageHandler,
        SqliteTradeAdapter,
      ],
    }).compile();

    commandBus = module.get<CommandBus>(CommandBus);
    eventBus = module.get<EventBus>(EventBus);
    ingestionService = module.get<IngestionService>(IngestionService);
    filterService = module.get<MessageFilterService>(MessageFilterService);

    await module.init();
  });

  describe('Full ingestion flow', () => {
    it('should filter valid LONG trade message', async () => {
      const text = 'LONG BTCUSDT Entry: 50000 SL: 49000 TP1: 52000';
      const source = new MessageSourceVO(123456789, 42);

      const result = filterService.filter(text, source.chatId);
      expect(result.shouldProcess).toBe(true);
    });

    it('should filter out non-trade messages', async () => {
      const text = 'Hello, how are you?';
      const source = new MessageSourceVO(123456789, 43);

      const result = filterService.filter(text, source.chatId);
      expect(result.shouldProcess).toBe(false);
      expect(result.reason).toBe('not_trade_related');
    });

    it('should filter out commands', async () => {
      const text = '/help';
      const source = new MessageSourceVO(123456789, 44);

      const result = filterService.filter(text, source.chatId);
      expect(result.shouldProcess).toBe(false);
      expect(result.reason).toBe('is_command');
    });

    it('should handle SHORT trade messages', async () => {
      const text = 'SHORT ETHUSDT Entry: 3000 SL: 3100';
      const source = new MessageSourceVO(123456789, 45);

      const result = filterService.filter(text, source.chatId);
      expect(result.shouldProcess).toBe(true);
    });

    it('should filter empty messages', async () => {
      const text = '';
      const source = new MessageSourceVO(123456789, 46);

      const result = filterService.filter(text, source.chatId);
      expect(result.shouldProcess).toBe(false);
      expect(result.reason).toBe('empty_message');
    });
  });
});