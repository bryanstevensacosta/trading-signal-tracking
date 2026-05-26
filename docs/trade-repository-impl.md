# trade/repository Implementation Guide

Implementation details for `src/trade/repository/` - persistence layer with SQLite.

---

## Directory Structure

```
src/trade/repository/
├── domain/
│   ├── ports/
│   │   ├── trade-repository.port.ts    # Interface defining repository contract
│   │   └── index.ts
│   └── events/
│       ├── trade-created.event.ts
│       ├── trade-updated.event.ts
│       ├── trade-deleted.event.ts
│       └── index.ts
├── application/
│   ├── commands/
│   │   ├── save-trade.command.ts
│   │   ├── update-trade.command.ts
│   │   ├── delete-trade.command.ts
│   │   └── index.ts
│   └── queries/
│       ├── get-trade-by-id.query.ts
│       ├── get-all-trades.query.ts
│       ├── get-active-trades.query.ts
│       ├── get-pending-trades.query.ts
│       ├── get-trades-by-status.query.ts
│       └── index.ts
├── infrastructure/
│   └── adapters/
│       ├── sqlite-trade.adapter.ts     # SQLite implementation
│       ├── typeorm-config.ts           # TypeORM configuration
│       └── index.ts
├── entity/
│   └── trade.entity.ts                 # TypeORM entity
├── mapper/
│   └── trade.mapper.ts                  # Entity <-> Domain mapping
└── index.ts                             # Main barrel export
```

---

## entity/trade.entity.ts

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { TradeStatus, TradeSide } from '../../shared/types';

@Entity('trades')
@Index(['symbol'])
@Index(['status'])
@Index(['createdAt'])
export class TradeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  symbol: string;

  @Column({ type: 'varchar' })
  side: TradeSide;

  @Column({ type: 'real' })
  entry: number;

  @Column({ type: 'real', nullable: true })
  entryMax: number | null;

  @Column({ type: 'real', nullable: true })
  sl: number | null;

  @Column({ type: 'simple-json', nullable: true })
  tps: number[] | null;

  @Column({ type: 'text', nullable: true })
  chartUrl: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar' })
  status: TradeStatus;

  @Column({ type: 'simple-json', nullable: true })
  tpsHit: number[];

  @Column({ type: 'text', nullable: true })
  sourceMessage: string | null;

  @Column({ type: 'bigint', nullable: true })
  sourceChat: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  closedAt: Date | null;
}
```

---

## domain/ports/trade-repository.port.ts

```typescript
import { Trade, CreateTradeInput, UpdateTradeInput } from '../../shared/types';

export interface TradeRepositoryPort {
  save(input: CreateTradeInput): Promise<Trade>;
  findById(id: string): Promise<Trade | null>;
  findAll(): Promise<Trade[]>;
  findActive(): Promise<Trade[]>;
  findPending(): Promise<Trade[]>;
  findByStatus(status: string): Promise<Trade[]>;
  findBySymbol(symbol: string): Promise<Trade[]>;
  update(id: string, input: UpdateTradeInput): Promise<Trade | null>;
  delete(id: string): Promise<boolean>;
}
```

---

## mapper/trade.mapper.ts

```typescript
import { Trade } from '../../shared/types';
import { TradeEntity } from '../entity/trade.entity';

export class TradeMapper {
  static toDomain(entity: TradeEntity): Trade {
    return {
      id: entity.id,
      symbol: entity.symbol.toUpperCase(),
      side: entity.side,
      entry: entity.entry,
      entryMax: entity.entryMax,
      sl: entity.sl,
      tps: entity.tps,
      chartUrl: entity.chartUrl,
      notes: entity.notes,
      status: entity.status,
      tpsHit: entity.tpsHit || [],
      sourceMessage: entity.sourceMessage || '',
      sourceChat: entity.sourceChat,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      closedAt: entity.closedAt,
    };
  }

  static toEntity(trade: Trade): Partial<TradeEntity> {
    return {
      id: trade.id,
      symbol: trade.symbol,
      side: trade.side,
      entry: trade.entry,
      entryMax: trade.entryMax,
      sl: trade.sl,
      tps: trade.tps,
      chartUrl: trade.chartUrl,
      notes: trade.notes,
      status: trade.status,
      tpsHit: trade.tpsHit,
      sourceMessage: trade.sourceMessage,
      sourceChat: trade.sourceChat,
      closedAt: trade.closedAt,
    };
  }
}
```

---

## infrastructure/adapters/sqlite-trade.adapter.ts

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TradeRepositoryPort } from '../../domain/ports/trade-repository.port';
import { Trade, CreateTradeInput, UpdateTradeInput } from '../../shared/types';
import { TradeEntity } from '../../entity/trade.entity';
import { TradeMapper } from '../../mapper/trade.mapper';

@Injectable()
export class SqliteTradeAdapter implements TradeRepositoryPort {
  constructor(
    @InjectRepository(TradeEntity)
    private readonly repository: Repository<TradeEntity>,
  ) {}

  async save(input: CreateTradeInput): Promise<Trade> {
    const entity = this.repository.create({
      ...input,
      symbol: input.symbol.toUpperCase(),
      status: 'pending' as any,
      tpsHit: [],
    });
    const saved = await this.repository.save(entity);
    return TradeMapper.toDomain(saved);
  }

  async findById(id: string): Promise<Trade | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? TradeMapper.toDomain(entity) : null;
  }

  async findAll(): Promise<Trade[]> {
    const entities = await this.repository.find({
      order: { createdAt: 'DESC' },
    });
    return entities.map(TradeMapper.toDomain);
  }

  async findActive(): Promise<Trade[]> {
    const entities = await this.repository
      .createQueryBuilder('trade')
      .where('trade.status IN (:...statuses)', {
        statuses: ['pending', 'active', 'partial_tp', 'breakeven'],
      })
      .orderBy('trade.createdAt', 'DESC')
      .getMany();
    return entities.map(TradeMapper.toDomain);
  }

  async findPending(): Promise<Trade[]> {
    const entities = await this.repository.find({
      where: { status: 'pending' as any },
      order: { createdAt: 'DESC' },
    });
    return entities.map(TradeMapper.toDomain);
  }

  async findByStatus(status: string): Promise<Trade[]> {
    const entities = await this.repository.find({
      where: { status: status as any },
      order: { createdAt: 'DESC' },
    });
    return entities.map(TradeMapper.toDomain);
  }

  async findBySymbol(symbol: string): Promise<Trade[]> {
    const entities = await this.repository.find({
      where: { symbol: symbol.toUpperCase() },
      order: { createdAt: 'DESC' },
    });
    return entities.map(TradeMapper.toDomain);
  }

  async update(id: string, input: UpdateTradeInput): Promise<Trade | null> {
    await this.repository.update(id, {
      ...input,
      ...(input.tpsHit !== undefined && { tpsHit: input.tpsHit }),
    });
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }
}
```

---

## application/commands/save-trade.command.ts

```typescript
import { ICommand } from '@nestjs/cqrs';
import { CreateTradeInput } from '../../shared/types';

export class SaveTradeCommand implements ICommand {
  constructor(public readonly input: CreateTradeInput) {}
}
```

---

## application/commands/update-trade.command.ts

```typescript
import { ICommand } from '@nestjs/cqrs';
import { UpdateTradeInput } from '../../shared/types';

export class UpdateTradeCommand implements ICommand {
  constructor(
    public readonly id: string,
    public readonly input: UpdateTradeInput,
  ) {}
}
```

---

## application/commands/delete-trade.command.ts

```typescript
import { ICommand } from '@nestjs/cqrs';

export class DeleteTradeCommand implements ICommand {
  constructor(public readonly id: string) {}
}
```

---

## application/commands/handler/save-trade.handler.ts

```typescript
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SaveTradeCommand } from '../save-trade.command';
import { TradeRepositoryPort } from '../../domain/ports/trade-repository.port';

@CommandHandler(SaveTradeCommand)
export class SaveTradeHandler implements ICommandHandler<SaveTradeCommand> {
  constructor(private readonly repository: TradeRepositoryPort) {}

  async execute(command: SaveTradeCommand) {
    return this.repository.save(command.input);
  }
}
```

---

## application/queries/get-trade-by-id.query.ts

```typescript
import { IQuery } from '@nestjs/cqrs';

export class GetTradeByIdQuery implements IQuery {
  constructor(public readonly id: string) {}
}
```

---

## application/queries/get-all-trades.query.ts

```typescript
import { IQuery } from '@nestjs/cqrs';

export class GetAllTradesQuery implements IQuery {}
```

---

## application/queries/get-active-trades.query.ts

```typescript
import { IQuery } from '@nestjs/cqrs';

export class GetActiveTradesQuery implements IQuery {}
```

---

## application/queries/handler/get-active-trades.handler.ts

```typescript
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetActiveTradesQuery } from '../get-active-trades.query';
import { TradeRepositoryPort } from '../../domain/ports/trade-repository.port';

@QueryHandler(GetActiveTradesQuery)
export class GetActiveTradesHandler
  implements IQueryHandler<GetActiveTradesQuery>
{
  constructor(private readonly repository: TradeRepositoryPort) {}

  async execute() {
    return this.repository.findActive();
  }
}
```

---

## domain/events/trade-created.event.ts

```typescript
import { Trade } from '../../shared/types';

export class TradeCreatedEvent {
  constructor(public readonly trade: Trade) {}
}
```

---

## infrastructure/typeorm-config.ts

```typescript
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { TradeEntity } from '../entity/trade.entity';

export const typeormConfig: TypeOrmModuleOptions = {
  type: 'sqlite',
  database: 'crypto-signals.db',
  entities: [TradeEntity],
  synchronize: true,
  logging: ['error', 'warn'],
};
```

---

## Module Configuration

```typescript
// trade.repository.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { TradeEntity } from './entity/trade.entity';
import { SqliteTradeAdapter } from './infrastructure/adapters/sqlite-trade.adapter';
import { SaveTradeHandler } from './application/commands/handler/save-trade.handler';
import { GetActiveTradesHandler } from './application/queries/handler/get-active-trades.handler';

const CommandHandlers = [SaveTradeHandler];
const QueryHandlers = [GetActiveTradesHandler];

@Module({
  imports: [TypeOrmModule.forFeature([TradeEntity]), CqrsModule],
  providers: [SqliteTradeAdapter, ...CommandHandlers, ...QueryHandlers],
  exports: [SqliteTradeAdapter],
})
export class TradeRepositoryModule {}
```

---

## Usage Example

```typescript
import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { SaveTradeCommand } from './commands/save-trade.command';
import { GetActiveTradesQuery } from './queries/get-active-trades.query';
import { CreateTradeInput } from '../shared/types';

@Injectable()
export class TradeService {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  async createTrade(input: CreateTradeInput) {
    return this.commandBus.execute(new SaveTradeCommand(input));
  }

  async getActiveTrades() {
    return this.queryBus.execute(new GetActiveTradesQuery());
  }
}
```

---

## Dependencies

```json
{
  "@nestjs/common": "^10.0.0",
  "@nestjs/core": "^10.0.0",
  "@nestjs/cqrs": "^10.0.0",
  "@nestjs/typeorm": "^10.0.0",
  "typeorm": "^0.3.17",
  "sqlite3": "^5.1.6",
  "uuid": "^9.0.0"
}
```

---

## Next Context

After completing `trade/repository`, proceed to **trade/parsing** for parsing incoming messages.