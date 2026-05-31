import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { LoggerPort, LOGGER_PORT } from '@shared/domain/ports/logger.port';
import { StartMonitoringCommand } from './command';
import { TriggerOrchestratorService } from '../../../domain/services/trigger-orchestrator.service';
import { TradeRepositoryPort, TRADE_REPOSITORY_PORT } from '@trade/repository/domain/ports/trade-repository.port';

@CommandHandler(StartMonitoringCommand)
export class StartMonitoringHandler implements ICommandHandler<StartMonitoringCommand> {
  private readonly logger: LoggerPort;

  constructor(
    private readonly engine: TriggerOrchestratorService,
    @Inject(TRADE_REPOSITORY_PORT) private readonly repository: TradeRepositoryPort,
    @Inject(LOGGER_PORT) logger: LoggerPort,
  ) {
    this.logger = logger;
  }

  async execute(command: StartMonitoringCommand): Promise<void> {
    const startTime = Date.now();
    this.logger.info(`[PERF] StartMonitoringHandler START: tradeId=${command.tradeId} timestamp=${startTime}`);

    const trade = await this.repository.findById(command.tradeId);
    if (!trade) {
      throw new Error(`Trade ${command.tradeId} not found`);
    }

    await this.engine.startMonitoring(trade);
    
    const endTime = Date.now();
    this.logger.info(`[PERF] StartMonitoringHandler END: tradeId=${command.tradeId} duration=${endTime - startTime}ms`);
  }
}