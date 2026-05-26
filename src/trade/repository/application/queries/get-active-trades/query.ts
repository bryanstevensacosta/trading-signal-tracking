import { IQuery } from '@nestjs/cqrs';

/**
 * Query to retrieve all active trades.
 */
export class GetActiveTradesQuery implements IQuery {}