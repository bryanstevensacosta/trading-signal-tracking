import { MessageFilterService, FilterResult } from '../message-filter.service';

describe('MessageFilterService', () => {
  let filterService: MessageFilterService;

  beforeEach(() => {
    filterService = new MessageFilterService();
  });

  describe('filter', () => {
    it('should filter empty messages', () => {
      const result = filterService.filter('', 123456789);
      
      expect(result.shouldProcess).toBe(false);
      expect(result.reason).toBe('empty_message');
    });

    it('should filter whitespace-only messages', () => {
      const result = filterService.filter('   \n\t  ', 123456789);
      
      expect(result.shouldProcess).toBe(false);
      expect(result.reason).toBe('empty_message');
    });

    it('should filter bot commands', () => {
      const commands = ['/start', '/help', '/settings', '/stats', '/trades'];
      
      for (const cmd of commands) {
        const result = filterService.filter(cmd, 123456789);
        
        expect(result.shouldProcess).toBe(false);
        expect(result.reason).toBe('is_command');
      }
    });

    it('should filter messages starting with commands', () => {
      const result = filterService.filter('/start some args', 123456789);
      
      expect(result.shouldProcess).toBe(false);
      expect(result.reason).toBe('is_command');
    });

    it('should filter non-trade related messages', () => {
      const result = filterService.filter('Hello world, how are you?', 123456789);
      
      expect(result.shouldProcess).toBe(false);
      expect(result.reason).toBe('not_trade_related');
    });

    it('should accept LONG trade messages', () => {
      const result = filterService.filter('LONG BTCUSDT Entry: 50000 SL: 49000', 123456789);
      
      expect(result.shouldProcess).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should accept SHORT trade messages', () => {
      const result = filterService.filter('SHORT ETHUSDT Entry: 3000 SL: 3100', 123456789);
      
      expect(result.shouldProcess).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should accept messages with entry keyword', () => {
      const result = filterService.filter('Entry: 50000', 123456789);
      
      expect(result.shouldProcess).toBe(true);
    });

    it('should accept messages with SL keyword', () => {
      const result = filterService.filter('SL: 49000', 123456789);
      
      expect(result.shouldProcess).toBe(true);
    });

    it('should accept messages with TP keyword', () => {
      const result = filterService.filter('TP1: 52000 TP2: 54000', 123456789);
      
      expect(result.shouldProcess).toBe(true);
    });

    it('should accept messages with take profit keyword', () => {
      const result = filterService.filter('Take profit at 52000', 123456789);
      
      expect(result.shouldProcess).toBe(true);
    });

    it('should accept messages with stop loss keyword', () => {
      const result = filterService.filter('Stop loss at 49000', 123456789);
      
      expect(result.shouldProcess).toBe(true);
    });

    it('should accept messages with spot keyword', () => {
      const result = filterService.filter('SPOT BTC Entry: 50000', 123456789);
      
      expect(result.shouldProcess).toBe(true);
    });

    it('should be case insensitive', () => {
      const result = filterService.filter('long btcusdt entry: 50000', 123456789);
      
      expect(result.shouldProcess).toBe(true);
    });

    it('should accept message with multiple trade keywords', () => {
      const result = filterService.filter('LONG BTCUSDT Entry: 50000 SL: 49000 TP: 52000', 123456789);
      
      expect(result.shouldProcess).toBe(true);
    });
  });
});