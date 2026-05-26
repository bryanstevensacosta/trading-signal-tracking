import { IQuery } from '@nestjs/cqrs';

/**
 * Query to retrieve all trades.
 */
export class GetAllTradesQuery implements IQuery {}