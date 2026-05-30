import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TelegramNotificationLogEntity, NotificationType, NotificationChannel } from '../../domain/entities/telegram-notification-log.entity';
import { TelegramNotificationLogPort, TELEGRAM_NOTIFICATION_LOG_PORT } from '../../domain/ports/telegram-notification-log.port';

@Injectable()
export class SqliteTelegramNotificationLogAdapter implements TelegramNotificationLogPort {
  constructor(
    @InjectRepository(TelegramNotificationLogEntity)
    private readonly repository: Repository<TelegramNotificationLogEntity>,
  ) {}

  async logSent(params: {
    tradeId?: string;
    type: NotificationType;
    tpIndex?: number;
    channel: NotificationChannel;
    messageId: number;
    chatId?: string;
  }): Promise<void> {
    const entity = this.repository.create({
      tradeId: params.tradeId || null,
      type: params.type,
      tpIndex: params.tpIndex ?? null,
      channel: params.channel,
      messageId: params.messageId,
      chatId: params.chatId || null,
    });
    await this.repository.save(entity);
  }

  async wasSent(tradeId: string, type: NotificationType, channel: NotificationChannel, tpIndex?: number): Promise<boolean> {
    const query: any = { tradeId, type, channel };
    if (tpIndex !== undefined) {
      query.tpIndex = tpIndex;
    } else {
      query.tpIndex = null;
    }
    
    const existing = await this.repository.findOne({
      where: query,
    });
    return !!existing;
  }

  async getLastSent(tradeId: string, channel: NotificationChannel): Promise<{
    type: NotificationType;
    tpIndex: number | null;
    messageId: number;
    sentAt: Date;
  } | null> {
    const last = await this.repository.findOne({
      where: { tradeId, channel },
      order: { sentAt: 'DESC' },
    });
    
    if (!last) return null;
    
    return {
      type: last.type as NotificationType,
      tpIndex: last.tpIndex,
      messageId: last.messageId,
      sentAt: last.sentAt,
    };
  }

  async getForTrade(tradeId: string): Promise<Array<{
    type: NotificationType;
    tpIndex: number | null;
    channel: NotificationChannel;
    messageId: number;
    sentAt: Date;
  }>> {
    const logs = await this.repository.find({
      where: { tradeId },
      order: { sentAt: 'DESC' },
    });
    
    return logs.map(log => ({
      type: log.type as NotificationType,
      tpIndex: log.tpIndex,
      channel: log.channel as NotificationChannel,
      messageId: log.messageId,
      sentAt: log.sentAt,
    }));
  }
}

export const TelegramNotificationLogAdapterProvider = {
  provide: TELEGRAM_NOTIFICATION_LOG_PORT,
  useClass: SqliteTelegramNotificationLogAdapter,
};