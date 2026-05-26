import { Trade, CreateTradeInput, OrderType } from '@trade/shared';
import { TradeEntity } from './trade.entity';

/**
 * Mapper for converting between domain and DB entities.
 */
export class TradeMapper {
  /**
   * Converts DB entity to domain Trade.
   * @param entity - TypeORM entity
   * @returns Domain Trade
   */
  static toDomain(entity: TradeEntity): Trade {
    return {
      id: entity.id,
      symbol: entity.symbol.toUpperCase(),
      side: entity.side,
      orderType: entity.orderType || OrderType.LIMIT,
      entry: entity.entry,
      entryMax: entity.entryMax,
      entryExecutedPrice: entity.entryExecutedPrice || null,
      entryExecutedAt: entity.entryExecutedAt || null,
      sl: entity.sl,
      tps: entity.tps,
      chartUrl: entity.chartUrl,
      notes: entity.notes,
      status: entity.status,
      tpsHit: entity.tpsHit || [],
      notificationMessageId: entity.notificationMessageId || null,
      sourceMessage: entity.sourceMessage || '',
      sourceChat: entity.sourceChat ? parseInt(entity.sourceChat, 10) : null,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      closedAt: entity.closedAt,
    };
  }

  /**
   * Converts domain Trade to partial DB entity.
   * @param trade - Domain Trade
   * @returns Partial entity for persistence
   */
  static toEntity(trade: Trade): Partial<TradeEntity> {
    return {
      id: trade.id,
      symbol: trade.symbol,
      side: trade.side,
      orderType: trade.orderType,
      entry: trade.entry,
      entryMax: trade.entryMax,
      entryExecutedPrice: trade.entryExecutedPrice,
      entryExecutedAt: trade.entryExecutedAt,
      sl: trade.sl,
      tps: trade.tps,
      chartUrl: trade.chartUrl,
      notes: trade.notes,
      status: trade.status,
      tpsHit: trade.tpsHit,
      notificationMessageId: trade.notificationMessageId,
      sourceMessage: trade.sourceMessage,
      sourceChat: trade.sourceChat ? trade.sourceChat.toString() : null,
      closedAt: trade.closedAt,
    };
  }

  /**
   * Converts partial entity to CreateTradeInput.
   * @param entity - Partial TypeORM entity
   * @returns CreateTradeInput
   */
  static toCreateInput(entity: Partial<TradeEntity>): CreateTradeInput {
    return {
      symbol: entity.symbol!,
      side: entity.side!,
      orderType: entity.orderType || OrderType.LIMIT,
      entry: entity.entry!,
      entryMax: entity.entryMax || undefined,
      sl: entity.sl || undefined,
      tps: entity.tps || undefined,
      chartUrl: entity.chartUrl || undefined,
      notes: entity.notes || undefined,
      sourceMessage: entity.sourceMessage || undefined,
      sourceChat: entity.sourceChat ? parseInt(entity.sourceChat, 10) : undefined,
    };
  }
}