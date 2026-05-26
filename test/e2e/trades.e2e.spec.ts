import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SqliteTradeAdapter } from '../../src/trade/repository/infrastructure/adapters/sqlite-trade.adapter';
import { TradeEntity } from '../../src/trade/repository/infrastructure/persistence/trade.entity';
import { TradeStatus, TradeSide, CreateTradeInput } from '../../src/trade/shared';

describe('Trade Repository (e2e)', () => {
  let adapter: SqliteTradeAdapter;
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

    adapter = module.get<SqliteTradeAdapter>(SqliteTradeAdapter);
    repository = module.get<Repository<TradeEntity>>(getRepositoryToken(TradeEntity));
  });

  describe('Create Trade Flow', () => {
    it('should create first trade', async () => {
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
    });

    it('should create second trade', async () => {
      const input: CreateTradeInput = {
        symbol: 'ETHUSDT',
        side: TradeSide.SHORT,
        entry: 3000,
      };

      const result = await adapter.save(input);

      expect(result.id).toBeDefined();
      expect(result.symbol).toBe('ETHUSDT');
    });

    it('should query all trades', async () => {
      const trades = await adapter.findAll();

      expect(trades).toHaveLength(2);
    });

    it('should query active trades', async () => {
      const activeTrades = await adapter.findActive();

      expect(activeTrades).toHaveLength(2);
      expect(activeTrades.every(t => 
        t.status === TradeStatus.PENDING || 
        t.status === TradeStatus.ACTIVE
      )).toBe(true);
    });

    it('should update a trade', async () => {
      const trades = await adapter.findAll();
      const trade = trades[0];

      const updated = await adapter.update(trade.id, { 
        status: TradeStatus.ACTIVE 
      });

      expect(updated!.status).toBe(TradeStatus.ACTIVE);
    });

    it('should delete a trade', async () => {
      const trades = await adapter.findAll();
      const trade = trades[0];

      const deleted = await adapter.delete(trade.id);

      expect(deleted).toBe(true);
      expect(await adapter.findById(trade.id)).toBeNull();
    });

    it('should have one remaining trade after delete', async () => {
      const trades = await adapter.findAll();

      expect(trades).toHaveLength(1);
    });
  });
});