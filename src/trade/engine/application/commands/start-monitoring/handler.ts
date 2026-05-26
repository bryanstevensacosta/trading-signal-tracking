import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { StartMonitoringCommand } from './command';
import { TradingEngineService } from '../../../domain/services/trading-engine.service';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '@trade/repository/domain/ports/trade-repository.port';

@CommandHandler(StartMonitoringCommand)
export class StartMonitoringHandler implements ICommandHandler<StartMonitoringCommand> {
  constructor(
    private readonly engine: TradingEngineService,
    @Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort,
  ) {}

  async execute(command: StartMonitoringCommand): Promise<void> {
    const trade = await this.repository.findById(command.tradeId);
    if (!trade) {
      throw new Error(`Trade ${command.tradeId} not found`);
    }

    await this.engine.startMonitoring(trade);
  }
}