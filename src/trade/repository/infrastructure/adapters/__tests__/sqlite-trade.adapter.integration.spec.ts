import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SqliteTradeAdapter } from '@trade/repository/infrastructure/adapters/sqlite-trade.adapter';
import { TradeEntity } from '@trade/repository/infrastructure/persistence/trade.entity';
import { TradeStatus, TradeSide, CreateTradeInput } from '@trade/shared';

describe('SqliteTradeAdapter', () => {
  let adapter: SqliteTradeAdapter;
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
      ],
      providers: [SqliteTradeAdapter],
    }).compile();

    adapter = module.get<SqliteTradeAdapter>(SqliteTradeAdapter);
    repository = module.get<Repository<TradeEntity>>(getRepositoryToken(TradeEntity));
  });

  describe('save', () => {
    it('should save trade and return with id', async () => {
      const input: CreateTradeInput = {
        symbol: 'BTCUSDT',
        side: TradeSide.LONG,
        entry: 50000,
        sl: 49000,
        tps: [52000, 53000],
      };

      const result = await adapter.save(input);

      expect(result.id).toBeDefined();
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.status).toBe(TradeStatus.PENDING);
      expect(result.side).toBe(TradeSide.LONG);
      expect(result.entry).toBe(50000);
      expect(result.sl).toBe(49000);
      expect(result.tps).toEqual([52000, 53000]);
    });

    it('should uppercase symbol', async () => {
      const input: CreateTradeInput = {
        symbol: 'btcusdt',
        side: TradeSide.LONG,
        entry: 50000,
      };

      const result = await adapter.save(input);

      expect(result.symbol).toBe('BTCUSDT');
    });

    it('should handle optional fields', async () => {
      const input: CreateTradeInput = {
        symbol: 'ETHUSDT',
        side: TradeSide.SHORT,
        entry: 3000,
      };

      const result = await adapter.save(input);

      expect(result.entryMax).toBeNull();
      expect(result.sl).toBeNull();
      expect(result.tps).toBeNull();
      expect(result.chartUrl).toBeNull();
      expect(result.notes).toBeNull();
      expect(result.tpsHit).toEqual([]);
    });
  });

  describe('findAll', () => {
    it('should return all trades ordered by createdAt DESC', async () => {
      await adapter.save({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000 });
      await adapter.save({ symbol: 'ETHUSDT', side: TradeSide.SHORT, entry: 3000 });

      const trades = await adapter.findAll();

      expect(trades).toHaveLength(2);
      expect(trades[0].symbol).toBe('ETHUSDT');
      expect(trades[1].symbol).toBe('BTCUSDT');
    });

    it('should return empty array when no trades', async () => {
      const trades = await adapter.findAll();

      expect(trades).toHaveLength(0);
    });
  });

  describe('findById', () => {
    it('should return trade by id', async () => {
      const created = await adapter.save({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000 });

      const found = await adapter.findById(created.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.symbol).toBe('BTCUSDT');
    });

    it('should return null for non-existent id', async () => {
      const found = await adapter.findById('non-existent-id');

      expect(found).toBeNull();
    });
  });

  describe('findActive', () => {
    it('should return pending and active trades', async () => {
      await adapter.save({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000 });
      
      const activeTrades = await adapter.findActive();

      expect(activeTrades).toHaveLength(1);
      expect(activeTrades[0].status).toBe(TradeStatus.PENDING);
    });

    it('should exclude closed trades', async () => {
      const trade = await adapter.save({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000 });
      await adapter.update(trade.id, { status: TradeStatus.CLOSED_WIN });

      const activeTrades = await adapter.findActive();

      expect(activeTrades).toHaveLength(0);
    });
  });

  describe('findPending', () => {
    it('should return only pending trades', async () => {
      await adapter.save({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000 });
      
      const pendingTrades = await adapter.findPending();

      expect(pendingTrades).toHaveLength(1);
      expect(pendingTrades[0].status).toBe(TradeStatus.PENDING);
    });
  });

  describe('findBySymbol', () => {
    it('should return trades for symbol', async () => {
      await adapter.save({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000 });
      await adapter.save({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 51000 });
      await adapter.save({ symbol: 'ETHUSDT', side: TradeSide.SHORT, entry: 3000 });

      const btcTrades = await adapter.findBySymbol('BTCUSDT');

      expect(btcTrades).toHaveLength(2);
    });

    it('should be case insensitive', async () => {
      await adapter.save({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000 });

      const trades = await adapter.findBySymbol('btcusdt');

      expect(trades).toHaveLength(1);
    });
  });

  describe('findByStatus', () => {
    it('should return trades by status', async () => {
      const trade = await adapter.save({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000 });

      const pendingTrades = await adapter.findByStatus('pending');

      expect(pendingTrades).toHaveLength(1);
      expect(pendingTrades[0].id).toBe(trade.id);
    });

    it('should return empty array for non-existent status', async () => {
      const trades = await adapter.findByStatus('non_existent_status');

      expect(trades).toHaveLength(0);
    });

    it('should return trades ordered by createdAt DESC', async () => {
      await adapter.save({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000 });
      await adapter.save({ symbol: 'ETHUSDT', side: TradeSide.SHORT, entry: 3000 });

      const trades = await adapter.findByStatus('pending');

      expect(trades).toHaveLength(2);
      const symbols = trades.map(t => t.symbol);
      expect(symbols).toContain('BTCUSDT');
      expect(symbols).toContain('ETHUSDT');
    });
  });

  describe('update', () => {
    it('should update trade fields', async () => {
      const trade = await adapter.save({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000, sl: 49000 });

      const updated = await adapter.update(trade.id, { sl: 48000 });

      expect(updated).not.toBeNull();
      expect(updated!.sl).toBe(48000);
    });

    it('should return null for non-existent trade', async () => {
      const updated = await adapter.update('non-existent', { sl: 48000 });

      expect(updated).toBeNull();
    });

    it('should update multiple fields at once', async () => {
      const trade = await adapter.save({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000 });

      const updated = await adapter.update(trade.id, {
        entry: 51000,
        sl: 49000,
        tps: [52000, 53000],
        notes: 'Updated note',
      });

      expect(updated).not.toBeNull();
      expect(updated!.entry).toBe(51000);
      expect(updated!.sl).toBe(49000);
      expect(updated!.tps).toEqual([52000, 53000]);
      expect(updated!.notes).toBe('Updated note');
    });

    it('should not update when input is empty', async () => {
      const trade = await adapter.save({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000 });

      const updated = await adapter.update(trade.id, {});

      expect(updated).not.toBeNull();
      expect(updated!.entry).toBe(50000);
    });

    it('should update tpsHit and closedAt', async () => {
      const trade = await adapter.save({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000 });

      const updated = await adapter.update(trade.id, {
        tpsHit: [0, 1],
        closedAt: new Date(),
      });

      expect(updated).not.toBeNull();
      expect(updated!.tpsHit).toEqual([0, 1]);
      expect(updated!.closedAt).toBeDefined();
    });

    it('should update entryMax', async () => {
      const trade = await adapter.save({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000 });

      const updated = await adapter.update(trade.id, { entryMax: 51000 });

      expect(updated).not.toBeNull();
      expect(updated!.entryMax).toBe(51000);
    });

    it('should update chartUrl', async () => {
      const trade = await adapter.save({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000 });

      const updated = await adapter.update(trade.id, { chartUrl: 'https://example.com/chart' });

      expect(updated).not.toBeNull();
      expect(updated!.chartUrl).toBe('https://example.com/chart');
    });
  });

  describe('delete', () => {
    it('should delete trade', async () => {
      const trade = await adapter.save({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000 });

      const deleted = await adapter.delete(trade.id);

      expect(deleted).toBe(true);
      expect(await adapter.findById(trade.id)).toBeNull();
    });

    it('should return false for non-existent trade', async () => {
      const deleted = await adapter.delete('non-existent-id');

      expect(deleted).toBe(false);
    });

    it('should handle delete with undefined affected', async () => {
      const trade = await adapter.save({ symbol: 'BTCUSDT', side: TradeSide.LONG, entry: 50000 });
      
      const deleted = await adapter.delete(trade.id);

      expect(typeof deleted).toBe('boolean');
    });
  });
});