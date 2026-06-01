import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
  BeforeInsert,
} from 'typeorm';

export enum NotificationType {
  ENTRY = 'entry',
  TP = 'tp',
  SL = 'sl',
  BREAKEVEN = 'breakeven',
  CLOSED_WIN = 'closed_win',
  CLOSED_LOSS = 'closed_loss',
  PARTIAL_TP = 'partial_tp',
  MODIFIED = 'modified',
  APPROVED = 'approved',
  CANCELLED = 'cancelled',
  TRADE_LIST = 'trade_list',
}

export enum NotificationChannel {
  ALERTS = 'alerts',
  APPROVAL = 'approval',
  LIST = 'list',
}

function generateShortId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Entity for tracking sent Telegram notifications.
 * Prevents duplicate notifications and enables idempotent processing.
 */
@Entity('telegram_notification_logs')
@Index(['tradeId', 'type', 'tpIndex', 'channel'], { unique: true })
@Index(['tradeId', 'channel'])
export class TelegramNotificationLogEntity {
  @PrimaryColumn({ type: 'varchar', length: 8, unique: true })
  id: string;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = generateShortId();
    }
  }

  @Column({ type: 'varchar', length: 8, nullable: true })
  tradeId: string | null;

  @Column({ type: 'varchar' })
  type: NotificationType;

  @Column({ type: 'integer', nullable: true })
  tpIndex: number | null;

  @Column({ type: 'varchar' })
  channel: NotificationChannel;

  @Column({ type: 'integer' })
  messageId: number;

  @Column({ type: 'varchar', nullable: true })
  chatId: string | null;

  @CreateDateColumn()
  sentAt: Date;
}