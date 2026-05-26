# NestJS Features

NestJS provides a modular architecture for Node.js with support for CQRS, WebSockets, and more.

## NestJS Documentation Files

| File | Content |
|------|---------|
| `nestjs-modules.md` | Modules, Controllers, Providers, DI |
| `nestjs-cqrs.md` | Commands, Queries, Events, Aggregates |
| `nestjs-components.md` | Guards, Pipes, Interceptors, Filters |

## Quick Reference

### Dependencies

```json
{
  "@nestjs/common": "^10.0.0",
  "@nestjs/core": "^10.0.0",
  "@nestjs/platform-express": "^10.0.0",
  "@nestjs/platform-ws": "^10.0.0",
  "@nestjs/websockets": "^10.0.0",
  "@nestjs/config": "^3.0.0",
  "@nestjs/event-emitter": "^2.0.0",
  "@nestjs/cqrs": "^10.0.0",
  "@nestjs/serve-static": "^4.0.0",
  "reflect-metadata": "^0.1.13",
  "rxjs": "^7.8.1"
}
```

## Testing

NestJS provides testing utilities.

```typescript
// trade-ingestion.service.spec.ts
describe('TradeIngestionService', () => {
  let service: TradeIngestionService;
  let parser: TradeParsingService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TradeIngestionService,
        { provide: TradeParsingService, useValue: mockParser },
      ],
    }).compile();

    service = module.get<TradeIngestionService>(TradeIngestionService);
  });

  it('should process valid trade message', async () => {
    const result = await service.processMessage(validMessage);
    expect(result).toBeDefined();
  });
});
```

## WebSocket Gateway

Binance WebSocket connection.

```typescript
@WebSocketGateway()
export class PriceStreamGateway {
  @WebSocketSubscription('price/update')
  handlePriceUpdate(data: PriceData): void {
    // Handle price update
  }
}
```

## Event Emitter (NestJS Event Emitter)

Inter-context communication.

```typescript
// Emit event
this.eventEmitter.emit('trade.state.changed', trade, oldStatus, newStatus);

// Listen event
@OnEvent('trade.state.changed')
handleStateChange(payload: TradeStatePayload): void {
  // Update trade list cache
}
```

## Config

Configuration management.

```typescript
// config/configuration.ts
export default registerAs('telegram', () => ({
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  channelId: process.env.TELEGRAM_CHANNEL_ID,
}));

// Usage
@Injectable()
export class TelegramConfigService {
  @Config() private readonly config: ConfigType<typeof telegramConfig>;
}
```