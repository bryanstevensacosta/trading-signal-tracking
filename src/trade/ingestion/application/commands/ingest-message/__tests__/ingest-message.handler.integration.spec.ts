import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus } from '@nestjs/cqrs';
import { IngestMessageHandler } from '../handler';
import { IngestMessageCommand } from '../command';
import { IngestionService } from '../../../../domain/services/ingestion.service';
import { MessageSourceVO } from '../../../../domain/value-objects/message-source.vo';

describe('IngestMessageHandler', () => {
  let handler: IngestMessageHandler;
  let ingestionService: jest.Mocked<IngestionService>;

  beforeEach(async () => {
    const mockIngestionService = {
      ingest: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestMessageHandler,
        { provide: IngestionService, useValue: mockIngestionService },
      ],
    }).compile();

    handler = module.get<IngestMessageHandler>(IngestMessageHandler);
    ingestionService = module.get(IngestionService);
  });

  describe('execute', () => {
    it('should call ingestionService.ingest with correct parameters', async () => {
      const text = 'LONG BTCUSDT Entry: 50000 SL: 49000';
      const source = new MessageSourceVO(123456789, 42);
      const command = new IngestMessageCommand(text, source);

      await handler.execute(command);

      expect(ingestionService.ingest).toHaveBeenCalledWith(text, source);
    });

    it('should pass different message texts to ingestion service', async () => {
      const messages = [
        'SHORT ETHUSDT Entry: 3000 SL: 3100',
        'LONG BTCUSDT Entry: 50000',
        'SPOT SOL Entry: 100 SL: 90 TP: 120',
      ];

      for (const text of messages) {
        const source = new MessageSourceVO(123456789, 42);
        const command = new IngestMessageCommand(text, source);

        await handler.execute(command);

        expect(ingestionService.ingest).toHaveBeenCalledWith(text, source);
      }
    });

    it('should handle different source chat IDs', async () => {
      const text = 'LONG BTCUSDT Entry: 50000';
      const chatIds = [123456789, 987654321, 111222333];

      for (const chatId of chatIds) {
        const source = new MessageSourceVO(chatId, 42);
        const command = new IngestMessageCommand(text, source);

        await handler.execute(command);

        expect(ingestionService.ingest).toHaveBeenCalledWith(text, source);
      }
    });
  });
});