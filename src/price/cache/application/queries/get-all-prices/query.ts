import { IQuery } from '@nestjs/cqrs';

/**
 * Query to get all cached prices.
 */
export class GetAllPricesQuery implements IQuery {}