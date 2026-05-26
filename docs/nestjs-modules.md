# NestJS Modules, Controllers & Providers

NestJS provides a modular architecture that maps well to our Bounded Contexts.

## Modules

Organize code by Bounded Context.

```typescript
// trade/trade.module.ts
@Module({
  imports: [],
  controllers: [],
  providers: [TradeIngestionService, TradeParsingService],
  exports: [TradeIngestionService],
})
export class TradeModule {}
```

**Mapping to our architecture:**

| Bounded Context | NestJS Module |
|-----------------|---------------|
| trade/ingestion | TradeIngestionModule |
| trade/parsing | TradeParsingModule |
| trade/repository | TradeRepositoryModule |
| trade/state | TradeStateModule |
| telegram/command | TelegramCommandModule |
| telegram/notification | TelegramNotificationModule |
| price/stream | PriceStreamModule |
| price/cache | PriceCacheModule |
| price/exchange | ExchangeModule |

## Controllers

Handle Telegram Bot API webhooks.

```typescript
// telegram/command/telegram-command.controller.ts
@Controller('telegram')
export class TelegramCommandController {
  @Post('webhook')
  handleUpdate(@Body() update: Update): void {
    // Handle incoming Telegram updates
  }
}
```

## Providers (Services)

Business logic.

```typescript
@Injectable()
export class TradeIngestionService {
  constructor(
    private readonly parser: TradeParsingService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async processMessage(message: IncomingMessage): Promise<void> {
    const result = this.parser.parse(message.text);
    if (result.success) {
      this.eventEmitter.emit('trade.created', result.data);
    }
  }
}
```

## Dependency Injection

NestJS IoC container manages dependencies.

```typescript
// Constructor injection
constructor(
  private readonly tradeRepository: TradeRepositoryService,
  private readonly priceCache: PriceCacheService,
) {}

// Inject by name
@Inject('EXCHANGE_PORT') private readonly exchange: ExchangePort
```

---

## Project Structure (NestJS)

```
src/
├── main.ts
├── app.module.ts
├── config/
│   └── configuration.ts
├── common/
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   └── pipes/
├── trade/
│   ├── ingestion/
│   │   ├── trade-ingestion.module.ts
│   │   ├── trade-ingestion.controller.ts
│   │   ├── trade-ingestion.service.ts
│   │   └── trade-ingestion.gateway.ts
│   ├── parsing/
│   │   ├── trade-parsing.module.ts
│   │   ├── trade-parsing.service.ts
│   │   └── adapters/
│   │       └── regex-parser.adapter.ts
│   ├── repository/
│   │   ├── trade-repository.module.ts
│   │   ├── trade-repository.service.ts
│   │   └── adapters/
│   │       └── sqlite.adapter.ts
│   └── state/
│       ├── trade-state.module.ts
│       ├── trade-state.service.ts
│       └── state-machine.service.ts
├── telegram/
│   ├── command/
│   │   ├── telegram-command.module.ts
│   │   ├── telegram-command.controller.ts
│   │   └── handlers/
│   └── notification/
│       ├── telegram-notification.module.ts
│       ├── single-trade/
│       │   ├── single-trade.module.ts
│       │   └── single-trade.service.ts
│       └── trade-list/
│           ├── trade-list.module.ts
│           └── trade-list-cache.service.ts
├── price/
│   ├── stream/
│   │   ├── price-stream.module.ts
│   │   ├── price-stream.gateway.ts
│   │   └── price-stream.service.ts
│   ├── cache/
│   │   ├── price-cache.module.ts
│   │   └── price-cache.service.ts
│   └── exchange/
│       ├── exchange.module.ts
│       ├── exchange.service.ts
│       └── adapters/
│           ├── binance.adapter.ts
│           └── exchange.port.ts
```

## Key NestJS Decorators

| Decorator | Usage |
|-----------|-------|
| `@Module()` | Define module |
| `@Controller()` | Handle requests |
| `@Injectable()` | Define service |
| `@Get()`, `@Post()`, etc. | Route methods |
| `@Body()`, `@Param()`, `@Query()` | Extract params |
| `@Inject()` | Manual injection |
| `@OnEvent()` | Event listener |
| `@Catch()` | Exception filter |
| `@UseGuards()` | Apply guard |
| `@UsePipes()` | Apply pipe |
| `@UseInterceptors()` | Apply interceptor |