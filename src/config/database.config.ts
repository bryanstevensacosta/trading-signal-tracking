import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { TradeEntity } from '@trade/repository/infrastructure/persistence/trade.entity';

/**
 * Database configuration for SQLite.
 */
export const databaseConfig: TypeOrmModuleOptions = {
  type: 'better-sqlite3',
  database: 'crypto-signals.db',
  entities: [TradeEntity],
  synchronize: true,
  logging: ['error', 'warn'],
};