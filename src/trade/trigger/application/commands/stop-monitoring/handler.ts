import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { StopMonitoringCommand } from './command';
import { TriggerOrchestratorService } from '../../../domain/services/trigger-orchestrator.service';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '@trade/repository/domain/ports/trade-repository.port';

@CommandHandler(StopMonitoringCommand)
export class StopMonitoringHandler implements ICommandHandler<StopMonitoringCommand> {
  constructor(
    private readonly engine: TriggerOrchestratorService,
    @Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort,
  ) {}

  async execute(command: StopMonitoringCommand): Promise<void> {
    const trade = await this.repository.findById(command.tradeId);
    if (!trade) {
      throw new Error(`Trade ${command.tradeId} not found`);
    }

    await this.engine.stopMonitoring(trade, command.reason);
  }
}