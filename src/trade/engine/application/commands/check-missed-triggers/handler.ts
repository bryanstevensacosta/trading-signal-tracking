import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CheckMissedTriggersCommand } from './command';
import { RecoveryService } from '../../recovery.service';
import { TriggerResult } from '../../../domain/services/trigger-detector.service';
import { LoggerPort, LOGGER_PORT } from '../../../../../shared/domain/ports/logger.port';

export interface MissedTriggerResult {
  tradeId: string;
  symbol: string;
  result: TriggerResult;
}

/**
 * Handler for CheckMissedTriggersCommand.
 * Executes recovery check for missed triggers.
 */
@CommandHandler(CheckMissedTriggersCommand)
export class CheckMissedTriggersHandler implements ICommandHandler<CheckMissedTriggersCommand> {
  private readonly logger: LoggerPort;

  constructor(
    private readonly recoveryService: RecoveryService,
    @Inject(LOGGER_PORT) logger: LoggerPort,
  ) {
    this.logger = logger;
  }

  async execute(_command: CheckMissedTriggersCommand): Promise<MissedTriggerResult[]> {
    this.logger.info('Starting missed triggers recovery check');

    const results = await this.recoveryService.recoverMissedTriggers();

    const missedTriggers: MissedTriggerResult[] = [];

    results.forEach((result, tradeId) => {
      missedTriggers.push({
        tradeId,
        symbol: '',
        result,
      });
    });

    this.logger.info(`Recovery check complete. Found ${missedTriggers.length} missed triggers`);

    return missedTriggers;
  }
}