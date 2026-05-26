import { MessageFilterService } from '../message-filter.service';

describe('MessageFilterService', () => {
  let filterService: MessageFilterService;

  beforeEach(() => {
    filterService = new MessageFilterService();
  });

  describe('property-based', () => {
    it('should handle arbitrary trade messages', () => {
      const validMessages = [
        'LONG BTCUSDT Entry: 50000',
        'SHORT ETHUSDT SL: 3000',
        'SPOT SOL Entry: 100 TP: 150',
        'long btc entry 50000 sl 49000',
        'SHORT BTCUSDT 50000 49000 55000',
      ];

      for (const msg of validMessages) {
        const result = filterService.filter(msg, 123456789);
        expect(result.shouldProcess).toBe(true);
      }
    });

    it('should handle messages with various formats', () => {
      const testCases = [
        { msg: 'entry: 50000 sl: 49000', shouldProcess: true },
        { msg: 'take profit: 52000 stop loss: 49000', shouldProcess: true },
        { msg: 'TP1: 52000 TP2: 54000 TP3: 56000', shouldProcess: true },
        { msg: 'LONG 49000 48000', shouldProcess: true },
      ];

      for (const tc of testCases) {
        const result = filterService.filter(tc.msg, 123456789);
        expect(result.shouldProcess).toBe(tc.shouldProcess);
      }
    });

    it('should filter arbitrary non-trade content', () => {
      const invalidMessages = [
        'Hello there!',
        'How are you doing?',
        'Just checking in',
        'Good morning!',
        'Thanks for the signal yesterday',
        '/start bot',
        '/help me please',
      ];

      for (const msg of invalidMessages) {
        const result = filterService.filter(msg, 123456789);
        expect(result.shouldProcess).toBe(false);
      }
    });

    it('should handle edge cases', () => {
      const edgeCases = [
        { msg: 'a', shouldProcess: false }, // single char, not trade
        { msg: 'L', shouldProcess: false }, // single char, not trade
        { msg: 'long', shouldProcess: true }, // keyword alone
        { msg: 'entry', shouldProcess: true }, // keyword alone
        { msg: 'LONG', shouldProcess: true }, // keyword alone
      ];

      for (const ec of edgeCases) {
        const result = filterService.filter(ec.msg, 123456789);
        expect(result.shouldProcess).toBe(ec.shouldProcess);
      }
    });
  });
});