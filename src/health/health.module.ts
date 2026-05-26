import { Module, forwardRef } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PriceStreamModule } from '@price/stream/price-stream.module';
import { TradeEngineModule } from '@trade/engine/trade-engine.module';
import { TradeRepositoryModule } from '@trade/repository/trade-repository.module';

@Module({
  imports: [
    forwardRef(() => PriceStreamModule),
    forwardRef(() => TradeEngineModule),
    forwardRef(() => TradeRepositoryModule),
  ],
  controllers: [HealthController],
})
export class HealthModule {}
