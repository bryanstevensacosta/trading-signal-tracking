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
    channel: NotificationChannel;
    messageId: number;
    chatId?: string;
  }): Promise<void>;

  /**
   * Checks if a notification was already sent for given trade and type.
   */
  wasSent(tradeId: string, type: NotificationType, channel: NotificationChannel): Promise<boolean>;

  /**
   * Gets the last notification sent for a trade and channel.
   */
  getLastSent(tradeId: string, channel: NotificationChannel): Promise<{
    type: NotificationType;
    messageId: number;
    sentAt: Date;
  } | null>;

  /**
   * Gets all notifications for a trade.
   */
  getForTrade(tradeId: string): Promise<Array<{
    type: NotificationType;
    channel: NotificationChannel;
    messageId: number;
    sentAt: Date;
  }>>;
}

export const TELEGRAM_NOTIFICATION_LOG_PORT = 'TELEGRAM_NOTIFICATION_LOG_PORT';