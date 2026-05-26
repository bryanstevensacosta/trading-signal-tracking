import { TradeListFormatterService } from '../trade-list-formatter.service';
import { Trade, TradeStatus, TradeSide, OrderType } from '@trade/shared';

describe('TradeListFormatterService', () => {
  let formatter: TradeListFormatterService;

  beforeEach(() => {
    formatter = new TradeListFormatterService();
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
    notificationMessageId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
    ...overrides,
  });

  describe('format', () => {
    it('should format empty trade list', () => {
      const result = formatter.format([]);

      expect(result).toContain('No trades yet');
    });

    it('should format active trades', () => {
      const trades = [
        createTrade({ symbol: 'BTCUSDT', status: TradeStatus.PENDING }),
        createTrade({ symbol: 'ETHUSDT', status: TradeStatus.ACTIVE }),
      ];

      const result = formatter.format(trades);

      expect(result).toContain('Active:');
      expect(result).toContain('BTCUSDT');
      expect(result).toContain('ETHUSDT');
    });

    it('should include side emoji', () => {
      const longTrade = createTrade({ symbol: 'BTCUSDT', side: TradeSide.LONG, status: TradeStatus.PENDING });
      const shortTrade = createTrade({ symbol: 'ETHUSDT', side: TradeSide.SHORT, status: TradeStatus.PENDING });

      const resultLong = formatter.format([longTrade]);
      const resultShort = formatter.format([shortTrade]);

      expect(resultLong).toContain('🟢');
      expect(resultShort).toContain('🔴');
    });

    it('should include status emoji', () => {
      const pendingTrade = createTrade({ symbol: 'BTCUSDT', status: TradeStatus.PENDING });
      const activeTrade = createTrade({ symbol: 'ETHUSDT', status: TradeStatus.ACTIVE });

      const resultPending = formatter.format([pendingTrade]);
      const resultActive = formatter.format([activeTrade]);

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

      const result = formatter.format([trade]);

      expect(result).toContain('SL: 49000');
      expect(result).toContain('TP: 52000 (+1)');
    });

    it('should show closed trades separately', () => {
      const closedTrade = createTrade({
        symbol: 'BTCUSDT',
        status: TradeStatus.CLOSED_WIN,
      });

      const result = formatter.format([closedTrade]);

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

      const result = formatter.format(closedTrades);

      expect(result).toContain('... and 2 more');
    });

    it('should include summary with win/loss count', () => {
      const trades = [
        createTrade({ symbol: 'BTCUSDT', status: TradeStatus.CLOSED_WIN }),
        createTrade({ symbol: 'ETHUSDT', status: TradeStatus.CLOSED_LOSS }),
      ];

      const result = formatter.format(trades);

      expect(result).toContain('Summary:');
      expect(result).toContain('1W / 1L');
    });

    it('should calculate win rate correctly', () => {
      const trades = [
        createTrade({ symbol: 'BTCUSDT', status: TradeStatus.CLOSED_WIN }),
        createTrade({ symbol: 'ETHUSDT', status: TradeStatus.CLOSED_WIN }),
        createTrade({ symbol: 'BNBUSDT', status: TradeStatus.CLOSED_LOSS }),
      ];

      const result = formatter.format(trades);

      expect(result).toContain('67% WR');
    });

    it('should show 0% WR when no closed trades', () => {
      const trades = [
        createTrade({ symbol: 'BTCUSDT', status: TradeStatus.PENDING }),
      ];

      const result = formatter.format(trades);

      expect(result).toContain('0% WR');
    });
  });
});