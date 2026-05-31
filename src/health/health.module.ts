import { Module, forwardRef } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PriceStreamModule } from '@price/stream/price-stream.module';
import { TriggerModule } from '@trade/trigger/trigger.module';
import { TradeRepositoryModule } from '@trade/repository/trade-repository.module';

@Module({
  imports: [
    forwardRef(() => PriceStreamModule),
    forwardRef(() => TriggerModule),
    forwardRef(() => TradeRepositoryModule),
  ],
  controllers: [HealthController],
})
export class HealthModule {}
