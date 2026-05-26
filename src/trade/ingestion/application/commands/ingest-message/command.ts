import { ICommand } from '@nestjs/cqrs';
import { MessageSourceVO } from '../../../domain/value-objects/message-source.vo';

/**
 * Command to ingest a Telegram message.
 */
export class IngestMessageCommand implements ICommand {
  constructor(
    public readonly text: string,
    public readonly source: MessageSourceVO,
  ) {}
}