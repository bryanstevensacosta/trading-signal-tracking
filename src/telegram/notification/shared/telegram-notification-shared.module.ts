import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegramNotificationLogEntity } from './domain/entities/telegram-notification-log.entity';
import { TelegramNotificationLogAdapterProvider } from './infrastructure/adapters/sqlite-telegram-notification-log.adapter';

@Module({
  imports: [
    TypeOrmModule.forFeature([TelegramNotificationLogEntity]),
  ],
  providers: [TelegramNotificationLogAdapterProvider],
  exports: [TelegramNotificationLogAdapterProvider],
})
export class TelegramNotificationSharedModule {}