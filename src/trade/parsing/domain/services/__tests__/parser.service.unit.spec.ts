import { ParserService } from '../parser.service';
import { TradeValidator } from '../trade-validator';
import { ParserPort, ParseResult, PARSER_PORT } from '../../ports/parser.port';
import { TradeSide } from '@trade/shared';

describe('ParserService', () => {
  let parserService: ParserService;
  let mockValidator: jest.Mocked<TradeValidator>;
  let mockParser: jest.Mocked<ParserPort>;

  beforeEach(() => {
    mockValidator = {
      validateTrade: jest.fn(),
    } as any;

    mockParser = {
      parse: jest.fn(),
    };

    parserService = new ParserService(mockValidator, mockParser);
  });

  describe('parse', () => {
    it('should parse message and return result when parsing fails', async () => {
      mockParser.parse.mockReturnValue({
        success: false,
        data: null,
        errors: ['Parse error'],
      });

      const result = await parserService.parse('invalid');

      expect(result.success).toBe(false);
      expect(mockValidator.validateTrade).not.toHaveBeenCalled();
    });

    it('should validate trade when parsing succeeds', async () => {
      mockParser.parse.mockReturnValue({
        success: true,
        data: {
          symbol: 'BTCUSDT',
          side: TradeSide.LONG,
          orderType: 'LIMIT' as any,
          entry: 50000,
          entryMax: null,
          sl: 49000,
          tps: [52000],
          chartUrl: null,
          notes: null,
        },
        errors: [],
      });

      mockValidator.validateTrade.mockReturnValue({
        valid: true,
        errors: [],
      });

      const result = await parserService.parse('LONG BTCUSDT Entry: 50000');

      expect(mockValidator.validateTrade).toHaveBeenCalledWith(
        'BTCUSDT',
        TradeSide.LONG,
        50000,
        49000,
        [52000]
      );
      expect(result.success).toBe(true);
    });

    it('should combine parsing and validation errors', async () => {
      mockParser.parse.mockReturnValue({
        success: true,
        data: {
          symbol: 'BTCUSDT',
          side: TradeSide.LONG,
          orderType: 'LIMIT' as any,
          entry: 50000,
          entryMax: null,
          sl: 49000,
          tps: [52000],
          chartUrl: null,
          notes: null,
        },
        errors: ['Parse warning'],
      });

      mockValidator.validateTrade.mockReturnValue({
        valid: false,
        errors: ['Validation error'],
      });

      const result = await parserService.parse('message');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Parse warning');
      expect(result.errors).toContain('Validation error');
    });
  });
});