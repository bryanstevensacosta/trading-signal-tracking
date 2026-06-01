export class RunRecoveryCommand {
  constructor(
    public readonly triggeredOnly: boolean = false,
  ) {}
}