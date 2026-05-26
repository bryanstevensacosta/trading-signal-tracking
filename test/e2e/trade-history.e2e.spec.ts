import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TradeEntity } from '../../src/trade/repository/infrastructure/persistence/trade.entity';
import { SqliteTradeAdapter } from '../../src/trade/repository/infrastructure/adapters/sqlite-trade.adapter';
import { TradeStatus, TradeSide } from '../../src/trade/shared';

describe('Trade History & Statistics (e2e)', () => {
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

  const createTrade = async (
    symbol: string,
    side: TradeSide,
    entry: number,
    status: TradeStatus,
    closedAt?: Date
  ) => {
    const trade = await tradeAdapter.save({ symbol, side, entry, sl: entry - 100 });
    await tradeAdapter.update(trade.id, {
      status,
      closedAt: closedAt || (status.startsWith('closed_') ? new Date() : undefined),
    });
    return trade;
  };

  describe('GetTradesCommand with closed filter', () => {
    it('should return only closed trades', async () => {
      await createTrade('BTCUSDT', TradeSide.LONG, 50000, TradeStatus.PENDING);
      await createTrade('ETHUSDT', TradeSide.SHORT, 3000, TradeStatus.ACTIVE);
      await createTrade('BNBUSDT', TradeSide.LONG, 400, TradeStatus.CLOSED_WIN);
      await createTrade('SOLUSDT', TradeSide.SHORT, 100, TradeStatus.CLOSED_LOSS);

      const allTrades = await tradeAdapter.findAll();
      const closedTrades = allTrades.filter(
        (t) => t.status.startsWith('closed_') || t.status === TradeStatus.CANCELLED
      );

      expect(closedTrades).toHaveLength(2);
      expect(closedTrades.map((t) => t.symbol)).toContain('BNBUSDT');
      expect(closedTrades.map((t) => t.symbol)).toContain('SOLUSDT');
    });

    it('should return empty for closed when no closed trades', async () => {
      await createTrade('BTCUSDT', TradeSide.LONG, 50000, TradeStatus.PENDING);
      await createTrade('ETHUSDT', TradeSide.SHORT, 3000, TradeStatus.ACTIVE);

      const allTrades = await tradeAdapter.findAll();
      const closedTrades = allTrades.filter(
        (t) => t.status.startsWith('closed_') || t.status === TradeStatus.CANCELLED
      );

      expect(closedTrades).toHaveLength(0);
    });

    it('should include cancelled trades in closed', async () => {
      await createTrade('BTCUSDT', TradeSide.LONG, 50000, TradeStatus.CANCELLED);

      const allTrades = await tradeAdapter.findAll();
      const closedTrades = allTrades.filter(
        (t) => t.status.startsWith('closed_') || t.status === TradeStatus.CANCELLED
      );

      expect(closedTrades).toHaveLength(1);
    });
  });

  describe('Statistics calculation', () => {
    it('should calculate win rate from closed trades', async () => {
      await createTrade('BTCUSDT', TradeSide.LONG, 50000, TradeStatus.CLOSED_WIN);
      await createTrade('ETHUSDT', TradeSide.SHORT, 3000, TradeStatus.CLOSED_WIN);
      await createTrade('BNBUSDT', TradeSide.LONG, 400, TradeStatus.CLOSED_LOSS);
      await createTrade('SOLUSDT', TradeSide.SHORT, 100, TradeStatus.CLOSED_LOSS);

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

    it('should aggregate stats by symbol', async () => {
      await createTrade('BTCUSDT', TradeSide.LONG, 50000, TradeStatus.CLOSED_WIN);
      await createTrade('BTCUSDT', TradeSide.LONG, 50000, TradeStatus.CLOSED_LOSS);
      await createTrade('BTCUSDT', TradeSide.LONG, 50000, TradeStatus.CLOSED_WIN);
      await createTrade('ETHUSDT', TradeSide.SHORT, 3000, TradeStatus.CLOSED_WIN);

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
      expect(lossesBySymbol['ETHUSDT']).toBe(0);
    });

    it('should count trades by time period', async () => {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      await createTrade('BTCUSDT', TradeSide.LONG, 50000, TradeStatus.CLOSED_WIN, now);
      await createTrade('ETHUSDT', TradeSide.SHORT, 3000, TradeStatus.CLOSED_WIN, new Date(weekAgo.getTime() + 1));
      await createTrade('BNBUSDT', TradeSide.LONG, 400, TradeStatus.CLOSED_WIN, new Date(monthAgo.getTime() + 1));

      const allTrades = await tradeAdapter.findAll();
      const closedTrades = allTrades.filter((t) =>
        t.status.startsWith('closed_') || t.status === TradeStatus.CANCELLED
      );

      const tradesThisWeek = closedTrades.filter((t) => new Date(t.createdAt) >= weekAgo).length;
      const tradesThisMonth = closedTrades.filter((t) => new Date(t.createdAt) >= monthAgo).length;

      expect(tradesThisWeek).toBeGreaterThanOrEqual(2);
      expect(tradesThisMonth).toBe(3);
    });
  });

  describe('Trade History filtering', () => {
    it('should filter by symbol', async () => {
      await createTrade('BTCUSDT', TradeSide.LONG, 50000, TradeStatus.CLOSED_WIN);
      await createTrade('ETHUSDT', TradeSide.SHORT, 3000, TradeStatus.CLOSED_LOSS);
      await createTrade('BTCUSDT', TradeSide.LONG, 60000, TradeStatus.CLOSED_WIN);

      const allTrades = await tradeAdapter.findAll();
      const btcClosed = allTrades.filter(
        (t) =>
          (t.status.startsWith('closed_') || t.status === TradeStatus.CANCELLED) &&
          t.symbol === 'BTCUSDT'
      );

      expect(btcClosed).toHaveLength(2);
      expect(btcClosed.every((t) => t.symbol === 'BTCUSDT')).toBe(true);
    });

    it('should filter by side', async () => {
      await createTrade('BTCUSDT', TradeSide.LONG, 50000, TradeStatus.CLOSED_WIN);
      await createTrade('ETHUSDT', TradeSide.SHORT, 3000, TradeStatus.CLOSED_LOSS);
      await createTrade('BNBUSDT', TradeSide.LONG, 400, TradeStatus.CLOSED_WIN);

      const allTrades = await tradeAdapter.findAll();
      const longClosed = allTrades.filter(
        (t) =>
          (t.status.startsWith('closed_') || t.status === TradeStatus.CANCELLED) &&
          t.side === TradeSide.LONG
      );

      expect(longClosed).toHaveLength(2);
      expect(longClosed.every((t) => t.side === TradeSide.LONG)).toBe(true);
    });

    it('should sort by closedAt descending', async () => {
      const older = await tradeAdapter.save({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000 });
      await tradeAdapter.update(older.id, {
        status: TradeStatus.CLOSED_WIN,
        closedAt: new Date('2024-01-01'),
      });

      const newer = await tradeAdapter.save({ symbol: 'ETHUSDT', side: TradeSide.SHORT, entry: 3000 });
      await tradeAdapter.update(newer.id, {
        status: TradeStatus.CLOSED_WIN,
        closedAt: new Date('2024-01-15'),
      });

      const allTrades = await tradeAdapter.findAll();
      const closedTrades = allTrades
        .filter((t) => t.status.startsWith('closed_') || t.status === TradeStatus.CANCELLED)
        .sort((a, b) => {
          const dateA = a.closedAt || a.createdAt;
          const dateB = b.closedAt || b.createdAt;
          return dateB.getTime() - dateA.getTime();
        });

      expect(closedTrades[0].symbol).toBe('ETHUSDT');
      expect(closedTrades[1].symbol).toBe('BTCUSDT');
    });
  });
});