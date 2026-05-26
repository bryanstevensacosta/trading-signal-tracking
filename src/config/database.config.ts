import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { TradeEntity } from '@trade/repository/infrastructure/persistence/trade.entity';

/**
 * Database configuration for SQLite.
 * Database path is configurable via DB_PATH environment variable.
 */
export const databaseConfig: TypeOrmModuleOptions = {
  type: 'better-sqlite3',
  database: process.env.DB_PATH || 'crypto-signals.db',
  entities: [TradeEntity],
  synchronize: true,
  logging: ['error', 'warn'],
};