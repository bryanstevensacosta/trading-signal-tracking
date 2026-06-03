import { IQuery } from '@nestjs/cqrs';

export class GetTradesForSelectionQuery implements IQuery {
  constructor(
    public readonly page: number = 1,
    public readonly pageSize: number = 5,
  ) {}
}