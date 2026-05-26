import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IngestMessageCommand } from './command';
import { IngestionService } from '../../../domain/services/ingestion.service';

/**
 * Handler for IngestMessageCommand.
 */
@CommandHandler(IngestMessageCommand)
export class IngestMessageHandler implements ICommandHandler<IngestMessageCommand> {
  constructor(private readonly ingestionService: IngestionService) {}

  /**
   * Executes the ingest command.
   * @param command - IngestMessageCommand with text and source
   */
  async execute(command: IngestMessageCommand): Promise<void> {
    await this.ingestionService.ingest(command.text, command.source);
  }
}