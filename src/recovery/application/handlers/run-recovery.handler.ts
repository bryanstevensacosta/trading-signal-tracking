import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RunRecoveryCommand } from '../commands/run-recovery.command';
import { RecoveryOrchestratorService } from '../../domain/services/recovery-orchestrator.service';
import { RecoveryResult } from '../../domain/ports/recovery-engine.port';

@CommandHandler(RunRecoveryCommand)
export class RunRecoveryHandler implements ICommandHandler<RunRecoveryCommand> {
  constructor(
    private readonly recoveryEngine: RecoveryOrchestratorService,
  ) {}

  async execute(_command: RunRecoveryCommand): Promise<RecoveryResult> {
    return this.recoveryEngine.recoverMissedTriggers();
  }
}