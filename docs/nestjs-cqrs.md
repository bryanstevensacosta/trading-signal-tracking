# NestJS CQRS - Commands, Queries, Events

NestJS provides `@nestjs/cqrs` for Command Query Responsibility Segregation.

## Folder Structure

Commands and queries follow a consistent folder structure:

```
src/trade/repository/application/
├── commands/
│   ├── save-trade/
│   │   ├── command.ts
│   │   ├── handler.ts
│   │   └── dto.ts          (optional)
│   ├── update-trade/
│   │   ├── command.ts
│   │   ├── handler.ts
│   │   └── dto.ts          (optional)
│   └── delete-trade/
│       ├── command.ts
│       └── handler.ts
└── queries/
    ├── get-trade-by-id/
    │   ├── query.ts
    │   └── handler.ts
    ├── get-all-trades/
    │   ├── query.ts
    │   └── handler.ts
    │   └── response.ts     (optional)
    └── get-active-trades/
        ├── query.ts
        └── handler.ts
```

## Installation

```bash
npm install @nestjs/cqrs
```

## Commands (Mutations)

Commands represent write operations that change state.

```typescript
// src/trade/repository/application/commands/save-trade/command.ts
export class SaveTradeCommand implements ICommand {
  constructor(public readonly input: CreateTradeInput) {}
}
```

```typescript
// src/trade/repository/application/commands/save-trade/handler.ts
@CommandHandler(SaveTradeCommand)
export class SaveTradeHandler implements ICommandHandler<SaveTradeCommand> {
  constructor(
    private readonly repository: TradeRepositoryPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: SaveTradeCommand): Promise<Trade> {
    const trade = await this.repository.save(command.input);
    this.eventBus.publish(new TradeCreatedEvent(trade));
    return trade;
  }
}
```

## Queries (Read)

Queries represent read operations that don't change state.

```typescript
// src/trade/repository/application/queries/get-all-trades/query.ts
export class GetAllTradesQuery implements IQuery {}
```

```typescript
// src/trade/repository/application/queries/get-all-trades/handler.ts
@QueryHandler(GetAllTradesQuery)
export class GetAllTradesHandler implements IQueryHandler<GetAllTradesQuery> {
  constructor(private readonly repository: TradeRepositoryPort) {}

  async execute(query: GetAllTradesQuery): Promise<Trade[]> {
    return this.repository.findAll();
  }
}
```

## Command Bus & Query Bus

Inject and dispatch commands/queries.

```typescript
@Controller('trades')
export class TradesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  async createTrade(@Body() dto: CreateTradeDto): Promise<Trade> {
    return this.commandBus.execute(
      new CreateTradeCommand(
        dto.symbol,
        dto.side,
        dto.entry,
        dto.sl,
        dto.tps,
      ),
    );
  }

  @Get('active')
  async getActiveTrades(): Promise<Trade[]> {
    return this.queryBus.execute(new GetActiveTradesQuery());
  }
}
```

## Events

Events represent something that happened.

```typescript
// trade/events/trade-created.event.ts
export class TradeCreatedEvent {
  constructor(public readonly trade: Trade) {}
}
```

```typescript
// trade/events/handlers/notify-trade-created.handler.ts
@EventsHandler(TradeCreatedEvent)
export class NotifyTradeCreatedHandler implements IEventHandler<TradeCreatedEvent> {
  constructor(private readonly notification: NotificationService) {}

  handle(event: TradeCreatedEvent) {
    this.notification.sendTradeCreated(event.trade);
  }
}
```

## Sagas (Optional)

Sagas handle long-running processes with chained events.

```typescript
@Injectable()
export class TradeSaga {
  @Saga()
  tradeCreated(event: TradeCreatedEvent): ICommand {
    return new StartMonitoringCommand(event.trade.id);
  }

  @Saga()
  entryHit(event: EntryHitEvent): ICommand {
    return new MoveToActiveCommand(event.trade.id);
  }

  @Saga()
  tpHit(event: TpHitEvent): ICommand {
    return new UpdateTradeCommand(event.trade.id, { status: 'partial_tp' });
  }
}
```

## Aggregates & Entities

### Entities

Entities have identity and can be mutated.

```typescript
// trade/entities/trade.entity.ts
@Entity()
export class Trade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  symbol: string;

  @Column()
  side: 'LONG' | 'SHORT' | 'SPOT';

  @Column('float')
  entry: number;

  @Column('float', { nullable: true })
  entryMax: number;

  @Column('float', { nullable: true })
  sl: number;

  @Column('simple-array', { nullable: true })
  tps: number[];

  @Column()
  status: TradeStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  closedAt: Date;

  // Domain methods
  hitEntry(currentPrice: number): boolean {
    if (this.entryMax) {
      return currentPrice >= this.entry && currentPrice <= this.entryMax;
    }
    return currentPrice === this.entry;
  }

  hitTP(currentPrice: number, tpIndex: number): boolean {
    if (!this.tps || !this.tps[tpIndex]) return false;
    if (this.side === 'LONG') {
      return currentPrice >= this.tps[tpIndex];
    }
    return currentPrice <= this.tps[tpIndex];
  }

  hitSL(currentPrice: number): boolean {
    if (!this.sl) return false;
    if (this.side === 'LONG') {
      return currentPrice <= this.sl;
    }
    return currentPrice >= this.sl;
  }
}
```

### Aggregates

Aggregates manage state changes and enforce invariants.

```typescript
// trade/aggregates/trade.aggregate.ts
export class TradeAggregate {
  private trade: Trade;

  static create(data: CreateTradeDto): TradeAggregate {
    const trade = new Trade();
    trade.symbol = data.symbol;
    trade.side = data.side;
    trade.entry = data.entry;
    trade.entryMax = data.entryMax;
    trade.sl = data.sl;
    trade.tps = data.tps;
    trade.status = 'pending';
    trade.tpsHit = [];

    return new TradeAggregate(trade);
  }

  // State transitions
  activate(): void {
    if (this.trade.status !== 'pending') {
      throw new Error('Can only activate pending trades');
    }
    this.trade.status = 'active';
  }

  markTPHit(tpIndex: number): void {
    if (!this.trade.tpsHit.includes(tpIndex)) {
      this.trade.tpsHit.push(tpIndex);
    }
    if (this.trade.tpsHit.length === this.trade.tps.length) {
      this.trade.status = 'closed_win';
    } else {
      this.trade.status = 'partial_tp';
    }
  }

  closeOnSL(): void {
    if (this.trade.tpsHit.length > 0) {
      this.trade.status = 'closed_partial';
    } else {
      this.trade.status = 'closed_loss';
    }
  }

  moveToBreakeven(): void {
    this.trade.sl = this.trade.entry;
    this.trade.status = 'breakeven';
  }

  closeManually(reason: string): void {
    this.trade.status = 'closed_manual';
    this.trade.closedAt = new Date();
  }

  getState(): Trade {
    return this.trade;
  }
}
```

### Repository Pattern

```typescript
// trade/repositories/trade.repository.ts
@Repository(Trade)
export class TradeRepository {
  constructor(
    @InjectRepository(Trade)
    private readonly repository: Repository<Trade>,
  ) {}

  async findAll(): Promise<Trade[]> {
    return this.repository.find();
  }

  async findById(id: string): Promise<Trade> {
    return this.repository.findOne({ where: { id } });
  }

  async findActive(): Promise<Trade[]> {
    return this.repository.find({
      where: [
        { status: 'pending' },
        { status: 'active' },
        { status: 'partial_tp' },
        { status: 'breakeven' },
      ],
    });
  }

  async save(trade: Trade): Promise<Trade> {
    return this.repository.save(trade);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
```

## Complete CQRS Module Setup

```typescript
// trade/trade.module.ts
@Module({
  imports: [CqrsModule],
  controllers: [TradesController],
  providers: [
    // Handlers
    CreateTradeHandler,
    ModifyEntryHandler,
    CloseTradeHandler,
    GetTradeByIdHandler,
    GetActiveTradesHandler,
    GetStatsHandler,
    // Event Handlers
    NotifyTradeCreatedHandler,
    UpdateTradeListHandler,
    // Services
    TradeRepositoryService,
    TradeStateService,
  ],
  exports: [TradeRepositoryService, TradeStateService],
})
export class TradeModule {}
```

```typescript
// app.module.ts
@Module({
  imports: [
    CqrsModule,
    TradeModule,
    TelegramModule,
    PriceModule,
  ],
})
export class AppModule {}
```

## Summary: NestJS + CQRS Mapping

| Pattern | NestJS Implementation |
|---------|----------------------|
| Create Trade | `CreateTradeCommand` + `CreateTradeHandler` |
| Get Active Trades | `GetActiveTradesQuery` + `GetActiveTradesHandler` |
| State Change | `ChangeStateCommand` + `ChangeStateHandler` |
| Trade Created | `TradeCreatedEvent` + `NotifyTradeCreatedHandler` |
| Trade Entity | `@Entity()` + TypeORM/Prisma |
| Trade Aggregate | Domain class with state transitions |