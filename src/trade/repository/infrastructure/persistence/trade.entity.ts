import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { TradeStatus, TradeSide, OrderType } from '@trade/shared';

function generateShortId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * TypeORM entity for trade persistence.
 * @see DB entity maps to domain entity via mapper.
 */
@Entity('trades')
@Index(['symbol'])
@Index(['status'])
@Index(['createdAt'])
export class TradeEntity {
  @PrimaryColumn({ type: 'varchar', length: 8, unique: true })
  id: string;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = generateShortId();
    }
  }

  @Column()
  symbol: string;

  @Column({ type: 'varchar' })
  side: TradeSide;

  @Column({ type: 'varchar', default: 'limit' })
  orderType: OrderType;

  @Column({ type: 'real' })
  entry: number;

  @Column({ type: 'real', nullable: true })
  entryMax: number | null;

  @Column({ type: 'real', nullable: true })
  entryExecutedPrice: number | null;

  @Column({ type: 'datetime', nullable: true })
  entryExecutedAt: Date | null;

  @Column({ type: 'real', nullable: true })
  sl: number | null;

  @Column({ type: 'simple-json', nullable: true })
  tps: number[] | null;

  @Column({ type: 'text', nullable: true })
  chartUrl: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar' })
  status: TradeStatus;

  @Column({ type: 'simple-json', nullable: true })
  tpsHit: number[];

  @Column({ type: 'integer', nullable: true })
  notificationMessageId: number | null;

  @Column({ type: 'text', nullable: true })
  sourceMessage: string | null;

  @Column({ type: 'varchar', nullable: true })
  sourceChat: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  closedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  cancelledBy: string | null;

  @Column({ type: 'datetime', nullable: true })
  approvedAt: Date | null;
}