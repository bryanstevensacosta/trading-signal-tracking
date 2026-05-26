import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TradeRepositoryPort } from '../../domain/ports/trade-repository.port';
import { Trade, CreateTradeInput, UpdateTradeInput, OrderType } from '@trade/shared';
import { TradeEntity } from '../persistence/trade.entity';
import { TradeMapper } from '../persistence/trade.mapper';
import { TRADE_PORT_TOKEN } from '@telegram/command/domain/ports/trade.port';

/**
 * SQLite adapter implementing TradeRepositoryPort.
 */
@Injectable()
export class SqliteTradeAdapter implements TradeRepositoryPort {
  constructor(
    @InjectRepository(TradeEntity)
    private readonly repository: Repository<TradeEntity>,
  ) {}

  static readonly TOKEN = TRADE_PORT_TOKEN;

  /**
   * Creates a new trade.
   */
  async save(input: CreateTradeInput): Promise<Trade> {
    const entity = this.repository.create({
      symbol: input.symbol.toUpperCase(),
      side: input.side,
      orderType: input.orderType ?? OrderType.LIMIT,
      entry: input.entry,
      entryMax: input.entryMax ?? null,
      entryExecutedPrice: null,
      entryExecutedAt: null,
      sl: input.sl ?? null,
      tps: input.tps ?? null,
      chartUrl: input.chartUrl ?? null,
      notes: input.notes ?? null,
      status: 'pending' as any,
      tpsHit: [],
      sourceMessage: input.sourceMessage ?? null,
      sourceChat: input.sourceChat?.toString() ?? null,
    });
    const saved = await this.repository.save(entity);
    return TradeMapper.toDomain(saved);
  }

  /**
   * Finds a trade by ID.
   */
  async findById(id: string): Promise<Trade | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? TradeMapper.toDomain(entity) : null;
  }

  /**
   * Retrieves all trades.
   */
  async findAll(): Promise<Trade[]> {
    const entities = await this.repository.find({
      order: { createdAt: 'DESC' },
    });
    return entities.map(TradeMapper.toDomain);
  }

  /**
   * Retrieves all active trades.
   */
  async findActive(): Promise<Trade[]> {
    const entities = await this.repository
      .createQueryBuilder('trade')
      .where('trade.status IN (:...statuses)', {
        statuses: ['pending', 'active', 'partial_tp', 'breakeven'],
      })
      .orderBy('trade.createdAt', 'DESC')
      .getMany();
    return entities.map(TradeMapper.toDomain);
  }

  /**
   * Retrieves all pending trades.
   */
  async findPending(): Promise<Trade[]> {
    const entities = await this.repository.find({
      where: { status: 'pending' as any },
      order: { createdAt: 'DESC' },
    });
    return entities.map(TradeMapper.toDomain);
  }

  /**
   * Finds trades by status.
   */
  async findByStatus(status: string): Promise<Trade[]> {
    const entities = await this.repository.find({
      where: { status: status as any },
      order: { createdAt: 'DESC' },
    });
    return entities.map(TradeMapper.toDomain);
  }

  /**
   * Finds trades by symbol.
   */
  async findBySymbol(symbol: string): Promise<Trade[]> {
    if (!symbol) {
      return [];
    }
    const entities = await this.repository.find({
      where: { symbol: symbol.toUpperCase() },
      order: { createdAt: 'DESC' },
    });
    return entities.map(TradeMapper.toDomain);
  }

  /**
   * Updates a trade.
   */
  async update(id: string, input: UpdateTradeInput): Promise<Trade | null> {
    const updateData: Partial<TradeEntity> = {};

    if (input.entry !== undefined) updateData.entry = input.entry;
    if (input.entryMax !== undefined) updateData.entryMax = input.entryMax;
    if (input.sl !== undefined) updateData.sl = input.sl;
    if (input.tps !== undefined) updateData.tps = input.tps;
    if (input.chartUrl !== undefined) updateData.chartUrl = input.chartUrl;
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.tpsHit !== undefined) updateData.tpsHit = input.tpsHit;
    if (input.closedAt !== undefined) updateData.closedAt = input.closedAt;
    if (input.entryExecutedPrice !== undefined) updateData.entryExecutedPrice = input.entryExecutedPrice;
    if (input.entryExecutedAt !== undefined) updateData.entryExecutedAt = input.entryExecutedAt;
    if (input.notificationMessageId !== undefined) updateData.notificationMessageId = input.notificationMessageId;

    await this.repository.update(id, updateData);
    return this.findById(id);
  }

  /**
   * Deletes a trade.
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  /**
   * Deletes all trades.
   */
  async deleteAll(): Promise<number> {
    const result = await this.repository.delete({});
    return result.affected ?? 0;
  }
}