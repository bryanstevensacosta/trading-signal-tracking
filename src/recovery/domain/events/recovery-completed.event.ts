import { RecoveryResult } from '../ports/recovery-engine.port';

export class RecoveryCompletedEvent {
  constructor(
    public readonly result: RecoveryResult,
  ) {}
}