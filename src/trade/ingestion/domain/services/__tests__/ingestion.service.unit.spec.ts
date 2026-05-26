import { Test, TestingModule } from '@nestjs/testing';
import { EventBus } from '@nestjs/cqrs';
import { IngestionService } from '../ingestion.service';
import { MessageFilterService } from '../message-filter.service';
import { MessageSourceVO } from '../../value-objects/message-source.vo';
import { TradeReceivedEvent } from '../../events/trade-received.event';
import { InvalidMessageEvent } from '../../events/invalid-message.event';
import { LoggerPort, LOGGER_PORT } from '@shared';

const mockLogger: LoggerPort = {
  trace: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
};

describe('IngestionService', () => {
  let service: IngestionService;
  let eventBus: { publish: jest.Mock };
  let filterService: { filter: jest.Mock };

  beforeEach(async () => {
    filterService = {
      filter: jest.fn(),
    };

    eventBus = {
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        { provide: MessageFilterService, useValue: filterService },
        { provide: EventBus, useValue: eventBus },
        { provide: LOGGER_PORT, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<IngestionService>(IngestionService);
  });

  describe('ingest', () => {
    it('should emit TradeReceivedEvent for valid trade messages', async () => {
      const text = 'LONG BTCUSDT Entry: 50000 SL: 49000';
      const source = new MessageSourceVO(123456789, 42);
      
      filterService.filter.mockReturnValue({ shouldProcess: true });

      await service.ingest(text, source);

      expect(filterService.filter).toHaveBeenCalledWith(text, source.chatId);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(TradeReceivedEvent),
      );
    });

    it('should emit InvalidMessageEvent for empty messages', async () => {
      const text = '';
      const source = new MessageSourceVO(123456789, 42);
      
      filterService.filter.mockReturnValue({ 
        shouldProcess: false, 
        reason: 'empty_message' 
      });

      await service.ingest(text, source);

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(InvalidMessageEvent),
      );
      const publishedEvent = eventBus.publish.mock.calls[0][0] as InvalidMessageEvent;
      expect(publishedEvent).toBeInstanceOf(InvalidMessageEvent);
      expect(publishedEvent.reason).toBe('empty_message');
    });

    it('should emit InvalidMessageEvent for commands', async () => {
      const text = '/help';
      const source = new MessageSourceVO(123456789, 42);
      
      filterService.filter.mockReturnValue({ 
        shouldProcess: false, 
        reason: 'is_command' 
      });

      await service.ingest(text, source);

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(InvalidMessageEvent),
      );
      const publishedEvent = eventBus.publish.mock.calls[0][0] as InvalidMessageEvent;
      expect(publishedEvent.reason).toBe('is_command');
    });

    it('should emit InvalidMessageEvent for non-trade messages', async () => {
      const text = 'Hello world';
      const source = new MessageSourceVO(123456789, 42);
      
      filterService.filter.mockReturnValue({ 
        shouldProcess: false, 
        reason: 'not_trade_related' 
      });

      await service.ingest(text, source);

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(InvalidMessageEvent),
      );
      const publishedEvent = eventBus.publish.mock.calls[0][0] as InvalidMessageEvent;
      expect(publishedEvent.reason).toBe('not_trade_related');
    });

    it('should pass correct text to filter', async () => {
      const text = 'LONG BTCUSDT Entry: 50000';
      const source = new MessageSourceVO(123456789, 42);
      
      filterService.filter.mockReturnValue({ shouldProcess: true });

      await service.ingest(text, source);

      expect(filterService.filter).toHaveBeenCalledWith(text, source.chatId);
    });
  });
});