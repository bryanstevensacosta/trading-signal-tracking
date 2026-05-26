import { IQuery } from '@nestjs/cqrs';

/**
 * Query to retrieve a trade by ID.
 */
export class GetTradeByIdQuery implements IQuery {
  constructor(public readonly id: string) {}
}