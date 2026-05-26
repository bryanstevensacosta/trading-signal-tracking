import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TradeHistoryAdapter } from '../trade-history.adapter';
import { TradeEntity } from '@trade/repository/infrastructure/persistence/trade.entity';
import { TradeRepositoryModule } from '@trade/repository/trade-repository.module';
import { SqliteTradeAdapter } from '@trade/repository/infrastructure/adapters/sqlite-trade.adapter';
import { TradeStatus, TradeSide, CreateTradeInput } from '@trade/shared';

describe('TradeHistoryAdapter (integration)', () => {
  let adapter: TradeHistoryAdapter;
  let sqliteAdapter: SqliteTradeAdapter;
  let repository: Repository<TradeEntity>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [TradeEntity],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([TradeEntity]),
        TradeRepositoryModule,
      ],
      providers: [TradeHistoryAdapter, SqliteTradeAdapter],
    }).compile();

    adapter = module.get<TradeHistoryAdapter>(TradeHistoryAdapter);
    sqliteAdapter = module.get<SqliteTradeAdapter>(SqliteTradeAdapter);
    repository = module.get<Repository<TradeEntity>>(getRepositoryToken(TradeEntity));
  });

  const createTrade = async (input: CreateTradeInput, status?: TradeStatus): Promise<void> => {
    const trade = await sqliteAdapter.save(input);
    if (status) {
      await sqliteAdapter.update(trade.id, { status });
    }
  };

  describe('findClosed', () => {
    it('should return only closed trades', async () => {
      await createTrade({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000 }, TradeStatus.PENDING);
      await createTrade({ symbol: 'ETHUSDT', side: TradeSide.SHORT, entry: 3000 }, TradeStatus.ACTIVE);
      await createTrade({ symbol: 'BNBUSDT', side: TradeSide.LONG, entry: 400 }, TradeStatus.CLOSED_WIN);

      const result = await adapter.findClosed();

      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe('BNBUSDT');
      expect(result[0].status).toBe(TradeStatus.CLOSED_WIN);
    });

    it('should return cancelled trades as closed', async () => {
      await createTrade({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000 }, TradeStatus.CANCELLED);

      const result = await adapter.findClosed();

      expect(result).toHaveLength(1);
    });

    it('should return empty array when no closed trades', async () => {
      await createTrade({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000 }, TradeStatus.PENDING);
      await createTrade({ symbol: 'ETHUSDT', side: TradeSide.SHORT, entry: 3000 }, TradeStatus.ACTIVE);

      const result = await adapter.findClosed();

      expect(result).toHaveLength(0);
    });

    it('should filter by symbols', async () => {
      await createTrade({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000 }, TradeStatus.CLOSED_WIN);
      await createTrade({ symbol: 'ETHUSDT', side: TradeSide.SHORT, entry: 3000 }, TradeStatus.CLOSED_LOSS);

      const result = await adapter.findClosed({ symbols: ['BTCUSDT'] });

      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe('BTCUSDT');
    });

    it('should filter by sides', async () => {
      await createTrade({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000 }, TradeStatus.CLOSED_WIN);
      await createTrade({ symbol: 'ETHUSDT', side: TradeSide.SHORT, entry: 3000 }, TradeStatus.CLOSED_LOSS);

      const result = await adapter.findClosed({ sides: [TradeSide.LONG] });

      expect(result).toHaveLength(1);
      expect(result[0].side).toBe(TradeSide.LONG);
    });

    it('should filter by limit', async () => {
      await createTrade({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000 }, TradeStatus.CLOSED_WIN);
      await createTrade({ symbol: 'ETHUSDT', side: TradeSide.SHORT, entry: 3000 }, TradeStatus.CLOSED_LOSS);
      await createTrade({ symbol: 'BNBUSDT', side: TradeSide.LONG, entry: 400 }, TradeStatus.CLOSED_PARTIAL);

      const result = await adapter.findClosed({ limit: 2 });

      expect(result).toHaveLength(2);
    });

    it('should sort by closedAt descending', async () => {
      const older = await sqliteAdapter.save({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000 });
      await sqliteAdapter.update(older.id, { status: TradeStatus.CLOSED_WIN, closedAt: new Date('2024-01-01') });

      const newer = await sqliteAdapter.save({ symbol: 'ETHUSDT', side: TradeSide.SHORT, entry: 3000 });
      await sqliteAdapter.update(newer.id, { status: TradeStatus.CLOSED_WIN, closedAt: new Date('2024-01-15') });

      const result = await adapter.findClosed();

      expect(result[0].symbol).toBe('ETHUSDT');
      expect(result[1].symbol).toBe('BTCUSDT');
    });
  });

  describe('findById', () => {
    it('should return closed trade by id', async () => {
      const trade = await sqliteAdapter.save({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000 });
      await sqliteAdapter.update(trade.id, { status: TradeStatus.CLOSED_WIN });

      const result = await adapter.findById(trade.id);

      expect(result).not.toBeNull();
      expect(result!.symbol).toBe('BTCUSDT');
    });

    it('should return null for active trade', async () => {
      const trade = await sqliteAdapter.save({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000 });

      const result = await adapter.findById(trade.id);

      expect(result).toBeNull();
    });

    it('should return null for non-existent id', async () => {
      const result = await adapter.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('count', () => {
    it('should return count of closed trades', async () => {
      await createTrade({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000 }, TradeStatus.CLOSED_WIN);
      await createTrade({ symbol: 'ETHUSDT', side: TradeSide.SHORT, entry: 3000 }, TradeStatus.CLOSED_LOSS);
      await createTrade({ symbol: 'BNBUSDT', side: TradeSide.LONG, entry: 400 }, TradeStatus.PENDING);

      const result = await adapter.count();

      expect(result).toBe(2);
    });

    it('should return 0 when no closed trades', async () => {
      await createTrade({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000 }, TradeStatus.ACTIVE);

      const result = await adapter.count();

      expect(result).toBe(0);
    });

    it('should count with filters', async () => {
      await createTrade({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000 }, TradeStatus.CLOSED_WIN);
      await createTrade({ symbol: 'ETHUSDT', side: TradeSide.SHORT, entry: 3000 }, TradeStatus.CLOSED_LOSS);

      const result = await adapter.count({ symbols: ['BTCUSDT'] });

      expect(result).toBe(1);
    });
  });
});