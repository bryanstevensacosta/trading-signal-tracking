import { TradeFormatterService } from '../trade-formatter.service';
import { Trade, TradeStatus, TradeSide, OrderType } from '@trade/shared';

describe('TradeFormatterService', () => {
  let service: TradeFormatterService;

  beforeEach(() => {
    service = new TradeFormatterService();
  });

  const createMockTrade = (partial: Partial<Trade> = {}): Trade => ({
    id: 'test-id',
    symbol: 'BTCUSDT',
    side: TradeSide.LONG,
    orderType: OrderType.LIMIT,
    entry: 50000,
    entryMax: null,
    entryExecutedPrice: null,
    entryExecutedAt: null,
    sl: 49000,
    tps: [52000, 53000],
    chartUrl: null,
    notes: null,
    status: TradeStatus.PENDING,
    sourceMessage: 'test',
    sourceChat: null,
    tpsHit: [],
    notificationMessageId: null,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    closedAt: null,
    ...partial,
  });

  describe('formatForDisplay', () => {
    it('should format LONG trade correctly', () => {
      const trade = createMockTrade({ side: TradeSide.LONG });
      const result = service.formatForDisplay(trade);

      expect(result).toContain('🟢 LONG BTCUSDT');
      expect(result).toContain('Entry: 50000');
      expect(result).toContain('SL: 49000');
      expect(result).toContain('TP: 52000 / 53000');
    });

    it('should format SHORT trade correctly', () => {
      const trade = createMockTrade({ side: TradeSide.SHORT });
      const result = service.formatForDisplay(trade);

      expect(result).toContain('🔴 SHORT BTCUSDT');
    });

    it('should format SPOT trade correctly', () => {
      const trade = createMockTrade({ side: TradeSide.SPOT });
      const result = service.formatForDisplay(trade);

      expect(result).toContain('⚪ SPOT BTCUSDT');
    });

    it('should include entryMax when present', () => {
      const trade = createMockTrade({ entryMax: 51000 });
      const result = service.formatForDisplay(trade);

      expect(result).toContain('Entry: 50000-51000');
    });

    it('should not include SL when null', () => {
      const trade = createMockTrade({ sl: null });
      const result = service.formatForDisplay(trade);

      expect(result).not.toContain('SL:');
    });

    it('should not include TP when null', () => {
      const trade = createMockTrade({ tps: null });
      const result = service.formatForDisplay(trade);

      expect(result).not.toContain('TP:');
    });

    it('should include notes when present', () => {
      const trade = createMockTrade({ notes: 'Test note' });
      const result = service.formatForDisplay(trade);

      expect(result).toContain('Notes: Test note');
    });

    it('should format pending status', () => {
      const trade = createMockTrade({ status: TradeStatus.PENDING });
      const result = service.formatForDisplay(trade);

      expect(result).toContain('⏳ Pending');
    });

    it('should format active status', () => {
      const trade = createMockTrade({ status: TradeStatus.ACTIVE });
      const result = service.formatForDisplay(trade);

      expect(result).toContain('✅ Active');
    });

    it('should format closed_win status', () => {
      const trade = createMockTrade({ status: TradeStatus.CLOSED_WIN });
      const result = service.formatForDisplay(trade);

      expect(result).toContain('💰 Won');
    });
  });

  describe('formatForList', () => {
    it('should return "No trades found" for empty array', () => {
      const result = service.formatForList([]);

      expect(result).toBe('No trades found');
    });

    it('should format single trade', () => {
      const trades = [createMockTrade({ symbol: 'BTCUSDT', entry: 50000 })];
      const result = service.formatForList(trades);

      expect(result).toContain('1. LONG BTCUSDT @ 50000');
    });

    it('should format multiple trades with index', () => {
      const trades = [
        createMockTrade({ symbol: 'BTCUSDT' }),
        createMockTrade({ symbol: 'ETHUSDT' }),
      ];
      const result = service.formatForList(trades);

      expect(result).toContain('1. LONG BTCUSDT');
      expect(result).toContain('2. LONG ETHUSDT');
    });

    it('should include status in parentheses', () => {
      const trades = [createMockTrade({ status: TradeStatus.ACTIVE })];
      const result = service.formatForList(trades);

      expect(result).toContain('[✅ Active]');
    });
  });

  describe('formatStats', () => {
    it('should format stats correctly', () => {
      const result = service.formatStats({
        totalTrades: 45,
        winRate: 0.68,
        averageRR: 2.3,
        bestTrade: 5.2,
        worstTrade: -1.0,
        tradesThisWeek: 5,
        tradesThisMonth: 18,
      });

      expect(result).toContain('Total: 45 trades');
      expect(result).toContain('Win Rate: 68.0%');
      expect(result).toContain('Avg R/R: 2.30R');
      expect(result).toContain('Best: +5.20R');
      expect(result).toContain('Worst: -1.00R');
      expect(result).toContain('This Week: 5 trades');
      expect(result).toContain('This Month: 18 trades');
    });

    it('should handle zero values', () => {
      const result = service.formatStats({
        totalTrades: 0,
        winRate: 0,
        averageRR: 0,
        bestTrade: 0,
        worstTrade: 0,
        tradesThisWeek: 0,
        tradesThisMonth: 0,
      });

      expect(result).toContain('Total: 0 trades');
      expect(result).toContain('Win Rate: 0.0%');
    });
  });

  describe('formatHelp', () => {
    it('should include query commands', () => {
      const result = service.formatHelp();

      expect(result).toContain('/start');
      expect(result).toContain('/help');
      expect(result).toContain('/trades');
      expect(result).toContain('/active');
      expect(result).toContain('/stats');
    });

    it('should include mutation commands', () => {
      const result = service.formatHelp();

      expect(result).toContain('/cancel');
      expect(result).toContain('/delete');
      expect(result).toContain('/entry');
      expect(result).toContain('/sl');
      expect(result).toContain('/tp');
      expect(result).toContain('/close');
      expect(result).toContain('/be');
    });
  });

  describe('formatWelcome', () => {
    it('should include welcome message', () => {
      const result = service.formatWelcome();

      expect(result).toContain('Welcome to Crypto Signals Bot');
      expect(result).toContain('/help');
    });
  });
});