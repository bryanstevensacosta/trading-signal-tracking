import { Test, TestingModule } from '@nestjs/testing';
import { ParseTradeHandler } from '../handler';
import { ParseTradeCommand } from '../command';
import { ParserService } from '../../../../domain/services/parser.service';
import { TradeSide, OrderType } from '@trade/shared';

describe('ParseTradeHandler', () => {
  let handler: ParseTradeHandler;
  let parserService: jest.Mocked<ParserService>;

  beforeEach(async () => {
    const mockParserService = {
      parse: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParseTradeHandler,
        { provide: ParserService, useValue: mockParserService },
      ],
    }).compile();

    handler = module.get<ParseTradeHandler>(ParseTradeHandler);
    parserService = module.get(ParserService);
  });

  describe('execute', () => {
    it('should parse and validate a valid trade message', async () => {
      const command = new ParseTradeCommand('LONG BTCUSDT Entry: 50000 SL: 49000 TP1: 52000');
      parserService.parse.mockResolvedValue({
        success: true,
        data: { symbol: 'BTCUSDT', side: TradeSide.LONG, orderType: OrderType.LIMIT, entry: 50000, entryMax: null, sl: 49000, tps: [], chartUrl: null, notes: null },
        errors: [],
      });

      const result = await handler.execute(command);

      expect(parserService.parse).toHaveBeenCalledWith(command.message);
      expect(result.success).toBe(true);
      expect(result.data?.symbol).toBe('BTCUSDT');
    });

    it('should return error result for invalid message', async () => {
      const command = new ParseTradeCommand('invalid message');
      parserService.parse.mockResolvedValue({
        success: false,
        data: null,
        errors: ['Missing symbol'],
      });

      const result = await handler.execute(command);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Missing symbol');
    });

    it('should use the command message', async () => {
      const command = new ParseTradeCommand('SHORT ETHUSDT Entry: 3000 SL: 3100');
      parserService.parse.mockResolvedValue({
        success: true,
        data: { symbol: 'ETHUSDT', side: TradeSide.SHORT, orderType: OrderType.LIMIT, entry: 3000, entryMax: null, sl: 3100, tps: [], chartUrl: null, notes: null },
        errors: [],
      });

      await handler.execute(command);

      expect(parserService.parse).toHaveBeenCalledWith('SHORT ETHUSDT Entry: 3000 SL: 3100');
    });
  });
});