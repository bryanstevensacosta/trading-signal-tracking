import { TelegramNotificationLogEntity, NotificationType, NotificationChannel } from '../../domain/entities/telegram-notification-log.entity';

export interface TelegramNotificationLog {
  id: string;
  tradeId: string | null;
  type: NotificationType;
  tpIndex: number | null;
  channel: NotificationChannel;
  messageId: number;
  chatId: string | null;
  sentAt: Date;
}

function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export class TelegramNotificationLogMapper {
  static toDomain(entity: TelegramNotificationLogEntity): TelegramNotificationLog {
    return {
      id: entity.id,
      tradeId: entity.tradeId,
      type: entity.type as NotificationType,
      tpIndex: entity.tpIndex,
      channel: entity.channel as NotificationChannel,
      messageId: entity.messageId,
      chatId: entity.chatId,
      sentAt: entity.sentAt,
    };
  }

  static toEntity(log: TelegramNotificationLog): TelegramNotificationLogEntity {
    return {
      id: log.id || generateId(),
      tradeId: log.tradeId,
      type: log.type,
      tpIndex: log.tpIndex,
      channel: log.channel,
      messageId: log.messageId,
      chatId: log.chatId,
      sentAt: log.sentAt,
    } as TelegramNotificationLogEntity;
  }

  static toCreateInput(log: Partial<TelegramNotificationLog>): TelegramNotificationLogEntity {
    return {
      id: generateId(),
      tradeId: log.tradeId || null,
      type: log.type!,
      tpIndex: log.tpIndex ?? null,
      channel: log.channel!,
      messageId: log.messageId!,
      chatId: log.chatId || null,
      sentAt: new Date(),
    } as TelegramNotificationLogEntity;
  }
}