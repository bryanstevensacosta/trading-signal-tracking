import { TradeMapper } from '../trade.mapper';
import { TradeStatus, TradeSide, Trade, OrderType } from '@trade/shared';

describe('TradeMapper', () => {
  interface TradeEntityMock {
    id: string;
    symbol: string;
    side: TradeSide;
    orderType: OrderType;
    entry: number;
    entryMax: number | null;
    entryExecutedPrice: number | null;
    entryExecutedAt: Date | null;
    sl: number | null;
    tps: number[] | null;
    chartUrl: string | null;
    notes: string | null;
    status: TradeStatus;
    tpsHit: number[];
    sourceMessage: string | null;
    sourceChat: string | null;
    createdAt: Date;
    updatedAt: Date;
    closedAt: Date | null;
  }

  const createMockEntity = (overrides?: Partial<TradeEntityMock>): TradeEntityMock => ({
    id: 'test-id',
    symbol: 'BTCUSDT',
    side: TradeSide.LONG,
    orderType: OrderType.LIMIT,
    entry: 50000,
    entryMax: 51000,
    entryExecutedPrice: null,
    entryExecutedAt: null,
    sl: 49000,
    tps: [52000, 53000],
    chartUrl: 'https://example.com/chart.png',
    notes: 'Test note',
    status: TradeStatus.PENDING,
    tpsHit: [],
    sourceMessage: 'Test message',
    sourceChat: '123456789',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    closedAt: null,
    ...overrides,
  });

  describe('toDomain', () => {
    it('should convert entity to domain', () => {
      const entity = createMockEntity();
      const result = TradeMapper.toDomain(entity as any);

      expect(result.id).toBe('test-id');
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.side).toBe(TradeSide.LONG);
      expect(result.entry).toBe(50000);
      expect(result.entryMax).toBe(51000);
      expect(result.sl).toBe(49000);
      expect(result.tps).toEqual([52000, 53000]);
      expect(result.status).toBe(TradeStatus.PENDING);
    });

    it('should uppercase symbol', () => {
      const entity = createMockEntity({ symbol: 'btcusdt' });
      const result = TradeMapper.toDomain(entity as any);

      expect(result.symbol).toBe('BTCUSDT');
    });

    it('should handle null sourceChat', () => {
      const entity = createMockEntity({ sourceChat: null });
      const result = TradeMapper.toDomain(entity as any);

      expect(result.sourceChat).toBeNull();
    });

    it('should handle empty tpsHit', () => {
      const entity = createMockEntity({ tpsHit: undefined as any });
      const result = TradeMapper.toDomain(entity as any);

      expect(result.tpsHit).toEqual([]);
    });
  });

  describe('toEntity', () => {
    it('should convert domain to entity', () => {
      const trade: Trade = {
        id: 'test-id',
        symbol: 'BTCUSDT',
        side: TradeSide.LONG,
        orderType: OrderType.LIMIT,
        entry: 50000,
        entryMax: 51000,
        entryExecutedPrice: null,
        entryExecutedAt: null,
        sl: 49000,
        tps: [52000, 53000],
        chartUrl: 'https://example.com/chart.png',
        notes: 'Test note',
        status: TradeStatus.PENDING,
        sourceMessage: 'Test message',
        sourceChat: 123456789,
        tpsHit: [],
        notificationMessageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        closedAt: null,
      };

      const result = TradeMapper.toEntity(trade);

      expect(result.id).toBe('test-id');
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.side).toBe(TradeSide.LONG);
      expect(result.entry).toBe(50000);
    });

    it('should convert sourceChat to string', () => {
      const trade: Trade = {
        id: 'test-id',
        symbol: 'BTCUSDT',
        side: TradeSide.LONG,
        orderType: OrderType.LIMIT,
        entry: 50000,
        entryMax: null,
        entryExecutedPrice: null,
        entryExecutedAt: null,
        sl: null,
        tps: null,
        chartUrl: null,
        notes: null,
        status: TradeStatus.PENDING,
        sourceMessage: '',
        sourceChat: 123456789,
        tpsHit: [],
        notificationMessageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        closedAt: null,
      };

      const result = TradeMapper.toEntity(trade);

      expect(result.sourceChat).toBe('123456789');
    });

    it('should handle null sourceChat', () => {
      const trade: Trade = {
        id: 'test-id',
        symbol: 'BTCUSDT',
        side: TradeSide.LONG,
        orderType: OrderType.LIMIT,
        entry: 50000,
        entryMax: null,
        entryExecutedPrice: null,
        entryExecutedAt: null,
        sl: null,
        tps: null,
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
      };

      const result = TradeMapper.toEntity(trade);

      expect(result.sourceChat).toBeNull();
    });
  });

  describe('toCreateInput', () => {
    it('should convert entity to create input', () => {
      const entity: Partial<TradeEntityMock> = {
        symbol: 'BTCUSDT',
        side: TradeSide.LONG,
        entry: 50000,
        entryMax: 51000,
        sl: 49000,
        tps: [52000],
        chartUrl: 'https://example.com/chart.png',
        notes: 'Test note',
        sourceMessage: 'Test message',
        sourceChat: '123456789',
      };

      const result = TradeMapper.toCreateInput(entity as any);

      expect(result.symbol).toBe('BTCUSDT');
      expect(result.side).toBe(TradeSide.LONG);
      expect(result.entry).toBe(50000);
      expect(result.entryMax).toBe(51000);
      expect(result.sl).toBe(49000);
    });

    it('should handle undefined optional fields', () => {
      const entity: Partial<TradeEntityMock> = {
        symbol: 'BTCUSDT',
        side: TradeSide.LONG,
        entry: 50000,
      };

      const result = TradeMapper.toCreateInput(entity as any);

      expect(result.entryMax).toBeUndefined();
      expect(result.sl).toBeUndefined();
      expect(result.tps).toBeUndefined();
    });
  });
});