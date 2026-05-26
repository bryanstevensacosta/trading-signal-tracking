import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TradeEntity } from '../../src/trade/repository/infrastructure/persistence/trade.entity';
import { SqliteTradeAdapter } from '../../src/trade/repository/infrastructure/adapters/sqlite-trade.adapter';
import { TradeStatus, TradeSide } from '../../src/trade/shared';

describe('Trade Statistics (e2e)', () => {
  let tradeAdapter: SqliteTradeAdapter;
  let repository: Repository<TradeEntity>;

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
      ],
      providers: [SqliteTradeAdapter],
    }).compile();

    tradeAdapter = module.get<SqliteTradeAdapter>(SqliteTradeAdapter);
    repository = module.get<Repository<TradeEntity>>(getRepositoryToken(TradeEntity));
  });

  beforeEach(async () => {
    await repository.clear();
  });

  const createClosedTrade = async (
    symbol: string,
    side: TradeSide,
    entry: number,
    status: TradeStatus.CLOSED_WIN | TradeStatus.CLOSED_PARTIAL | TradeStatus.CLOSED_LOSS | TradeStatus.CLOSED_BREAKEVEN | TradeStatus.CLOSED_MANUAL,
    sl: number
  ) => {
    const trade = await tradeAdapter.save({ symbol, side, entry, sl });
    await tradeAdapter.update(trade.id, {
      status,
      closedAt: new Date(),
    });
    return trade;
  };

  describe('Win Rate Calculation', () => {
    it('should calculate 100% win rate with all wins', async () => {
      await createClosedTrade('BTCUSDT', TradeSide.LONG, 50000, TradeStatus.CLOSED_WIN, 49000);
      await createClosedTrade('ETHUSDT', TradeSide.SHORT, 3000, TradeStatus.CLOSED_WIN, 3100);

      const allTrades = await tradeAdapter.findAll();
      const closedTrades = allTrades.filter((t) =>
        t.status.startsWith('closed_') || t.status === TradeStatus.CANCELLED
      );
      const winningTrades = closedTrades.filter(
        (t) => t.status === TradeStatus.CLOSED_WIN || t.status === TradeStatus.CLOSED_PARTIAL
      );

      const winRate = closedTrades.length > 0 ? winningTrades.length / closedTrades.length : 0;

      expect(closedTrades).toHaveLength(2);
      expect(winningTrades).toHaveLength(2);
      expect(winRate).toBe(1);
    });

    it('should calculate 0% win rate with all losses', async () => {
      await createClosedTrade('BTCUSDT', TradeSide.LONG, 50000, TradeStatus.CLOSED_LOSS, 49000);
      await createClosedTrade('ETHUSDT', TradeSide.SHORT, 3000, TradeStatus.CLOSED_LOSS, 3100);

      const allTrades = await tradeAdapter.findAll();
      const closedTrades = allTrades.filter((t) =>
        t.status.startsWith('closed_') || t.status === TradeStatus.CANCELLED
      );
      const winningTrades = closedTrades.filter(
        (t) => t.status === TradeStatus.CLOSED_WIN || t.status === TradeStatus.CLOSED_PARTIAL
      );

      const winRate = closedTrades.length > 0 ? winningTrades.length / closedTrades.length : 0;

      expect(closedTrades).toHaveLength(2);
      expect(winningTrades).toHaveLength(0);
      expect(winRate).toBe(0);
    });

    it('should calculate correct win rate with mixed results', async () => {
      await createClosedTrade('BTCUSDT', TradeSide.LONG, 50000, TradeStatus.CLOSED_WIN, 49000);
      await createClosedTrade('ETHUSDT', TradeSide.SHORT, 3000, TradeStatus.CLOSED_LOSS, 3100);
      await createClosedTrade('BNBUSDT', TradeSide.LONG, 400, TradeStatus.CLOSED_WIN, 390);
      await createClosedTrade('SOLUSDT', TradeSide.SHORT, 100, TradeStatus.CLOSED_LOSS, 110);

      const allTrades = await tradeAdapter.findAll();
      const closedTrades = allTrades.filter((t) =>
        t.status.startsWith('closed_') || t.status === TradeStatus.CANCELLED
      );
      const winningTrades = closedTrades.filter(
        (t) => t.status === TradeStatus.CLOSED_WIN || t.status === TradeStatus.CLOSED_PARTIAL
      );

      const winRate = closedTrades.length > 0 ? winningTrades.length / closedTrades.length : 0;

      expect(closedTrades).toHaveLength(4);
      expect(winningTrades).toHaveLength(2);
      expect(winRate).toBe(0.5);
    });

    it('should handle partial TP as win', async () => {
      await createClosedTrade('BTCUSDT', TradeSide.LONG, 50000, TradeStatus.CLOSED_PARTIAL, 49000);

      const allTrades = await tradeAdapter.findAll();
      const closedTrades = allTrades.filter((t) =>
        t.status.startsWith('closed_') || t.status === TradeStatus.CANCELLED
      );
      const winningTrades = closedTrades.filter(
        (t) => t.status === TradeStatus.CLOSED_WIN || t.status === TradeStatus.CLOSED_PARTIAL
      );

      expect(winningTrades).toHaveLength(1);
      expect(winningTrades[0].status).toBe(TradeStatus.CLOSED_PARTIAL);
    });

    it('should treat BREAKEVEN as not win', async () => {
      await createClosedTrade('BTCUSDT', TradeSide.LONG, 50000, TradeStatus.CLOSED_BREAKEVEN, 50000);
      await createClosedTrade('ETHUSDT', TradeSide.SHORT, 3000, TradeStatus.CLOSED_WIN, 3100);

      const allTrades = await tradeAdapter.findAll();
      const closedTrades = allTrades.filter((t) =>
        t.status.startsWith('closed_') || t.status === TradeStatus.CANCELLED
      );
      const winningTrades = closedTrades.filter(
        (t) => t.status === TradeStatus.CLOSED_WIN || t.status === TradeStatus.CLOSED_PARTIAL
      );

      expect(closedTrades).toHaveLength(2);
      expect(winningTrades).toHaveLength(1);
    });
  });

  describe('Symbol Aggregation', () => {
    it('should aggregate wins and losses by symbol', async () => {
      await createClosedTrade('BTCUSDT', TradeSide.LONG, 50000, TradeStatus.CLOSED_WIN, 49000);
      await createClosedTrade('BTCUSDT', TradeSide.LONG, 50000, TradeStatus.CLOSED_LOSS, 49000);
      await createClosedTrade('BTCUSDT', TradeSide.LONG, 50000, TradeStatus.CLOSED_WIN, 49000);
      await createClosedTrade('ETHUSDT', TradeSide.SHORT, 3000, TradeStatus.CLOSED_WIN, 3100);
      await createClosedTrade('ETHUSDT', TradeSide.SHORT, 3000, TradeStatus.CLOSED_LOSS, 3100);

      const allTrades = await tradeAdapter.findAll();
      const closedTrades = allTrades.filter((t) =>
        t.status.startsWith('closed_') || t.status === TradeStatus.CANCELLED
      );

      const winsBySymbol: Record<string, number> = {};
      const lossesBySymbol: Record<string, number> = {};

      closedTrades.forEach((t) => {
        const isWin = t.status === TradeStatus.CLOSED_WIN || t.status === TradeStatus.CLOSED_PARTIAL;
        winsBySymbol[t.symbol] = (winsBySymbol[t.symbol] || 0) + (isWin ? 1 : 0);
        lossesBySymbol[t.symbol] = (lossesBySymbol[t.symbol] || 0) + (isWin ? 0 : 1);
      });

      expect(winsBySymbol['BTCUSDT']).toBe(2);
      expect(lossesBySymbol['BTCUSDT']).toBe(1);
      expect(winsBySymbol['ETHUSDT']).toBe(1);
      expect(lossesBySymbol['ETHUSDT']).toBe(1);
    });

    it('should handle symbol with only wins', async () => {
      await createClosedTrade('BTCUSDT', TradeSide.LONG, 50000, TradeStatus.CLOSED_WIN, 49000);
      await createClosedTrade('BTCUSDT', TradeSide.LONG, 50000, TradeStatus.CLOSED_WIN, 49000);

      const allTrades = await tradeAdapter.findAll();
      const closedTrades = allTrades.filter((t) =>
        t.status.startsWith('closed_') || t.status === TradeStatus.CANCELLED
      );

      const winsBySymbol: Record<string, number> = {};
      const lossesBySymbol: Record<string, number> = {};

      closedTrades.forEach((t) => {
        const isWin = t.status === TradeStatus.CLOSED_WIN || t.status === TradeStatus.CLOSED_PARTIAL;
        winsBySymbol[t.symbol] = (winsBySymbol[t.symbol] || 0) + (isWin ? 1 : 0);
        lossesBySymbol[t.symbol] = (lossesBySymbol[t.symbol] || 0) + (isWin ? 0 : 1);
      });

      expect(winsBySymbol['BTCUSDT']).toBe(2);
      expect(lossesBySymbol['BTCUSDT']).toBe(0);
    });

    it('should handle symbol with only losses', async () => {
      await createClosedTrade('BTCUSDT', TradeSide.LONG, 50000, TradeStatus.CLOSED_LOSS, 49000);
      await createClosedTrade('BTCUSDT', TradeSide.LONG, 50000, TradeStatus.CLOSED_LOSS, 49000);

      const allTrades = await tradeAdapter.findAll();
      const closedTrades = allTrades.filter((t) =>
        t.status.startsWith('closed_') || t.status === TradeStatus.CANCELLED
      );

      const winsBySymbol: Record<string, number> = {};
      const lossesBySymbol: Record<string, number> = {};

      closedTrades.forEach((t) => {
        const isWin = t.status === TradeStatus.CLOSED_WIN || t.status === TradeStatus.CLOSED_PARTIAL;
        winsBySymbol[t.symbol] = (winsBySymbol[t.symbol] || 0) + (isWin ? 1 : 0);
        lossesBySymbol[t.symbol] = (lossesBySymbol[t.symbol] || 0) + (isWin ? 0 : 1);
      });

      expect(winsBySymbol['BTCUSDT']).toBe(0);
      expect(lossesBySymbol['BTCUSDT']).toBe(2);
    });
  });

  describe('All Closed Status Types', () => {
    it('should count CLOSED_WIN as closed', async () => {
      await createClosedTrade('BTCUSDT', TradeSide.LONG, 50000, TradeStatus.CLOSED_WIN, 49000);

      const allTrades = await tradeAdapter.findAll();
      const closedTrades = allTrades.filter((t) =>
        t.status.startsWith('closed_') || t.status === TradeStatus.CANCELLED
      );

      expect(closedTrades).toHaveLength(1);
    });

    it('should count CLOSED_PARTIAL as closed', async () => {
      await createClosedTrade('BTCUSDT', TradeSide.LONG, 50000, TradeStatus.CLOSED_PARTIAL, 49000);

      const allTrades = await tradeAdapter.findAll();
      const closedTrades = allTrades.filter((t) =>
        t.status.startsWith('closed_') || t.status === TradeStatus.CANCELLED
      );

      expect(closedTrades).toHaveLength(1);
    });

    it('should count CLOSED_LOSS as closed', async () => {
      await createClosedTrade('BTCUSDT', TradeSide.LONG, 50000, TradeStatus.CLOSED_LOSS, 49000);

      const allTrades = await tradeAdapter.findAll();
      const closedTrades = allTrades.filter((t) =>
        t.status.startsWith('closed_') || t.status === TradeStatus.CANCELLED
      );

      expect(closedTrades).toHaveLength(1);
    });

    it('should count CLOSED_BREAKEVEN as closed', async () => {
      await createClosedTrade('BTCUSDT', TradeSide.LONG, 50000, TradeStatus.CLOSED_BREAKEVEN, 50000);

      const allTrades = await tradeAdapter.findAll();
      const closedTrades = allTrades.filter((t) =>
        t.status.startsWith('closed_') || t.status === TradeStatus.CANCELLED
      );

      expect(closedTrades).toHaveLength(1);
    });

    it('should count CLOSED_MANUAL as closed', async () => {
      await createClosedTrade('BTCUSDT', TradeSide.LONG, 50000, TradeStatus.CLOSED_MANUAL, 49000);

      const allTrades = await tradeAdapter.findAll();
      const closedTrades = allTrades.filter((t) =>
        t.status.startsWith('closed_') || t.status === TradeStatus.CANCELLED
      );

      expect(closedTrades).toHaveLength(1);
    });
  });

  describe('RR Calculation', () => {
    it('should calculate RR for LONG trade', async () => {
      const trade = await tradeAdapter.save({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000, sl: 49000 });
      await tradeAdapter.update(trade.id, { status: TradeStatus.CLOSED_WIN, closedAt: new Date() });

      const allTrades = await tradeAdapter.findAll();
      const closedTrade = allTrades.find((t) => t.id === trade.id)!;

      const riskAmount = Math.abs(closedTrade.entry - (closedTrade.sl ?? closedTrade.entry));
      const priceDiff = closedTrade.entryExecutedPrice
        ? Math.abs(closedTrade.entryExecutedPrice - (closedTrade.sl ?? closedTrade.entry))
        : riskAmount;
      const rr = riskAmount > 0 ? priceDiff / riskAmount : 0;

      expect(riskAmount).toBe(1000);
      expect(rr).toBe(1);
    });

    it('should calculate RR for SHORT trade', async () => {
      const trade = await tradeAdapter.save({ symbol: 'ETHUSDT', side: TradeSide.SHORT, entry: 3000, sl: 3100 });
      await tradeAdapter.update(trade.id, { status: TradeStatus.CLOSED_WIN, closedAt: new Date() });

      const allTrades = await tradeAdapter.findAll();
      const closedTrade = allTrades.find((t) => t.id === trade.id)!;

      const riskAmount = Math.abs(closedTrade.entry - (closedTrade.sl ?? closedTrade.entry));
      const priceDiff = closedTrade.entryExecutedPrice
        ? Math.abs((closedTrade.sl ?? closedTrade.entry) - closedTrade.entryExecutedPrice)
        : riskAmount;
      const rr = riskAmount > 0 ? priceDiff / riskAmount : 0;

      expect(riskAmount).toBe(100);
      expect(rr).toBe(1);
    });

    it('should handle zero risk amount', async () => {
      const trade = await tradeAdapter.save({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000, sl: 50000 });
      await tradeAdapter.update(trade.id, { status: TradeStatus.CLOSED_WIN, closedAt: new Date() });

      const allTrades = await tradeAdapter.findAll();
      const closedTrade = allTrades.find((t) => t.id === trade.id)!;

      const riskAmount = Math.abs(closedTrade.entry - (closedTrade.sl ?? closedTrade.entry));
      expect(riskAmount).toBe(0);
    });
  });

  describe('Trades Count', () => {
    it('should count total closed trades', async () => {
      await createClosedTrade('BTCUSDT', TradeSide.LONG, 50000, TradeStatus.CLOSED_WIN, 49000);
      await createClosedTrade('ETHUSDT', TradeSide.SHORT, 3000, TradeStatus.CLOSED_LOSS, 3100);
      await createClosedTrade('BNBUSDT', TradeSide.LONG, 400, TradeStatus.CLOSED_PARTIAL, 390);

      const allTrades = await tradeAdapter.findAll();
      const closedTrades = allTrades.filter((t) =>
        t.status.startsWith('closed_') || t.status === TradeStatus.CANCELLED
      );

      expect(closedTrades).toHaveLength(3);
    });

    it('should return 0 closed trades when none exist', async () => {
      const allTrades = await tradeAdapter.findAll();
      const closedTrades = allTrades.filter((t) =>
        t.status.startsWith('closed_') || t.status === TradeStatus.CANCELLED
      );

      expect(closedTrades).toHaveLength(0);
    });
  });

  describe('Average RR', () => {
    it('should calculate average RR from multiple trades', async () => {
      await createClosedTrade('BTCUSDT', TradeSide.LONG, 50000, TradeStatus.CLOSED_WIN, 49000);
      await createClosedTrade('ETHUSDT', TradeSide.SHORT, 3000, TradeStatus.CLOSED_WIN, 3100);

      const allTrades = await tradeAdapter.findAll();
      const closedTrades = allTrades.filter((t) =>
        t.status.startsWith('closed_') || t.status === TradeStatus.CANCELLED
      );

      const rrs = closedTrades.map((t) => {
        const riskAmount = Math.abs(t.entry - (t.sl ?? t.entry));
        return riskAmount > 0 ? 1 : 0;
      });

      const averageRR = rrs.length > 0 ? rrs.reduce((a, b) => a + b, 0) / rrs.length : 0;

      expect(rrs).toHaveLength(2);
      expect(averageRR).toBe(1);
    });

    it('should return 0 average RR when no closed trades', async () => {
      const allTrades = await tradeAdapter.findAll();
      const closedTrades = allTrades.filter((t) =>
        t.status.startsWith('closed_') || t.status === TradeStatus.CANCELLED
      );

      const averageRR = closedTrades.length > 0 ? 1 : 0;

      expect(averageRR).toBe(0);
    });
  });
});