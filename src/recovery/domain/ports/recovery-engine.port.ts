import { TriggerResult } from '@trade/trigger/domain/services/trigger-detector.service';

export interface RecoveryResult {
  triggers: Map<string, TriggerResult>;
  fixedStates: number;
  duration: number;
}

export interface RecoveryEnginePort {
  recoverMissedTriggers(): Promise<RecoveryResult>;
}