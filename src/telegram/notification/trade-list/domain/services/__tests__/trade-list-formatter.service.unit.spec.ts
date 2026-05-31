import { TelegramFormatter } from '@telegram/shared/formatters';
import { Trade, TradeStatus, TradeSide, OrderType } from '@trade/shared';

describe('TradeListFormatterService', () => {
  let formatter: TelegramFormatter;

  beforeEach(() => {
    formatter = new TelegramFormatter();
  });

  const createTrade = (overrides: Partial<Trade> = {}): Trade => ({
    id: '1',
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
    sourceMessage: '',
    sourceChat: null,
    tpsHit: [],
    tradeAlertsMessageId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
    ...overrides,
  });

  describe('formatTradeList', () => {
    it('should format empty trade list', () => {
      const result = formatter.formatTradeList([], { html: true });

      expect(result).toContain('No trades yet');
    });

    it('should format active trades', () => {
      const trades = [
        createTrade({ symbol: 'BTCUSDT', status: TradeStatus.PENDING }),
        createTrade({ symbol: 'ETHUSDT', status: TradeStatus.ACTIVE }),
      ];

      const result = formatter.formatTradeList(trades, { html: true });

      expect(result).toContain('Active:');
      expect(result).toContain('BTCUSDT');
      expect(result).toContain('ETHUSDT');
    });

    it('should include side emoji', () => {
      const longTrade = createTrade({ symbol: 'BTCUSDT', side: TradeSide.LONG, status: TradeStatus.PENDING });
      const shortTrade = createTrade({ symbol: 'ETHUSDT', side: TradeSide.SHORT, status: TradeStatus.PENDING });

      const resultLong = formatter.formatTradeList([longTrade], { html: true });
      const resultShort = formatter.formatTradeList([shortTrade], { html: true });

      expect(resultLong).toContain('🟢');
      expect(resultShort).toContain('🔴');
    });

    it('should include status emoji', () => {
      const pendingTrade = createTrade({ symbol: 'BTCUSDT', status: TradeStatus.PENDING });
      const activeTrade = createTrade({ symbol: 'ETHUSDT', status: TradeStatus.ACTIVE });

      const resultPending = formatter.formatTradeList([pendingTrade], { html: true });
      const resultActive = formatter.formatTradeList([activeTrade], { html: true });

      expect(resultPending).toContain('⏳');
      expect(resultActive).toContain('✅');
    });

    it('should show SL and TP for non-pending trades', () => {
      const trade = createTrade({
        symbol: 'BTCUSDT',
        status: TradeStatus.ACTIVE,
        sl: 49000,
        tps: [52000, 53000],
      });

      const result = formatter.formatTradeList([trade], { html: true });

      expect(result).toContain('SL: 49000');
      expect(result).toContain('TP: 52000');
    });

    it('should show closed trades separately', () => {
      const closedTrade = createTrade({
        symbol: 'BTCUSDT',
        status: TradeStatus.CLOSED_WIN,
      });

      const result = formatter.formatTradeList([closedTrade], { html: true });

      expect(result).toContain('Closed:');
      expect(result).toContain('💰');
    });

    it('should limit closed trades to 5', () => {
      const closedTrades = Array.from({ length: 7 }, (_, i) =>
        createTrade({
          symbol: `SYM${i}`,
          status: TradeStatus.CLOSED_WIN,
        })
      );

      const result = formatter.formatTradeList(closedTrades, { html: true });

      expect(result).toContain('... and 2 more');
    });

    it('should include summary with win/loss count', () => {
      const trades = [
        createTrade({ symbol: 'BTCUSDT', status: TradeStatus.CLOSED_WIN }),
        createTrade({ symbol: 'ETHUSDT', status: TradeStatus.CLOSED_LOSS }),
      ];

      const result = formatter.formatTradeList(trades, { html: true });

      expect(result).toContain('Summary:');
      expect(result).toContain('1W / 1L');
    });

    it('should calculate win rate correctly', () => {
      const trades = [
        createTrade({ symbol: 'BTCUSDT', status: TradeStatus.CLOSED_WIN }),
        createTrade({ symbol: 'ETHUSDT', status: TradeStatus.CLOSED_WIN }),
        createTrade({ symbol: 'BNBUSDT', status: TradeStatus.CLOSED_LOSS }),
      ];

      const result = formatter.formatTradeList(trades, { html: true });

      expect(result).toContain('67% WR');
    });

    it('should show 0% WR when no closed trades', () => {
      const trades = [
        createTrade({ symbol: 'BTCUSDT', status: TradeStatus.PENDING }),
      ];

      const result = formatter.formatTradeList(trades, { html: true });

      expect(result).toContain('0% WR');
    });
  });
});