import { NotificationType, NotificationChannel } from '../entities/telegram-notification-log.entity';

/**
 * Port interface for tracking Telegram notifications.
 * Used to prevent duplicate notifications and enable idempotent processing.
 */
export interface TelegramNotificationLogPort {
  /**
   * Logs a sent notification.
   */
  logSent(params: {
    tradeId?: string;
    type: NotificationType;
    tpIndex?: number;
    channel: NotificationChannel;
    messageId: number;
    chatId?: string;
  }): Promise<void>;

  /**
   * Checks if a notification was already sent for given trade and type.
   * For TP notifications, includes tpIndex to differentiate between TP1, TP2, etc.
   */
  wasSent(tradeId: string, type: NotificationType, channel: NotificationChannel, tpIndex?: number): Promise<boolean>;

  /**
   * Gets the last notification sent for a trade and channel.
   */
  getLastSent(tradeId: string, channel: NotificationChannel): Promise<{
    type: NotificationType;
    tpIndex: number | null;
    messageId: number;
    sentAt: Date;
  } | null>;

  /**
   * Gets all notifications for a trade.
   */
  getForTrade(tradeId: string): Promise<Array<{
    type: NotificationType;
    tpIndex: number | null;
    channel: NotificationChannel;
    messageId: number;
    sentAt: Date;
  }>>;
}

export const TELEGRAM_NOTIFICATION_LOG_PORT = 'TELEGRAM_NOTIFICATION_LOG_PORT';