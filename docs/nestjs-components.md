# NestJS Components - Guards, Pipes, Interceptors, Filters

## Guards

Authorization for commands.

```typescript
@Injectable()
@Guard()
export class TelegramAuthGuard {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    return request.user?.id === config.allowedUserId;
  }
}
```

## Pipes

Data validation with Zod.

```typescript
@Injectable()
@Pipe()
export class TradeParsePipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    return TradeSchema.parse(value);
  }
}
```

## Interceptors

Response transformation.

```typescript
@Interceptor()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(tap(() => log()));
  }
}
```

## Filters

Exception handling.

```typescript
@Catch()
export class TelegramExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    ctx.getResponse().status(500).json({ error: exception.message });
  }
}
```

## Custom Decorators

Custom decorators for extraction.

```typescript
// Extract trade ID from message
export const TradeId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.body.message?.text?.split(' ')[1];
  },
);

// Usage
@Get('trade')
getTrade(@TradeId() tradeId: string) {
  return this.tradeService.findById(tradeId);
}
```

## Microservices

Optional: Use TCP or RabbitMQ for inter-service communication.

```typescript
// Main entry
app.connectMicroservice({
  transport: Transport.TCP,
  port: 3001,
});
```

---

## Usage Examples

### Apply Guard to Controller

```typescript
@Controller('trades')
@UseGuards(TelegramAuthGuard)
export class TradesController {
  // All endpoints require auth
}
```

### Apply Pipe to Route

```typescript
@Post()
@UsePipes(new ValidationPipe({ transform: true }))
async createTrade(@Body() dto: CreateTradeDto): Promise<Trade> {
  return this.commandBus.execute(new CreateTradeCommand(dto));
}
```

### Apply Interceptor

```typescript
@Controller('trades')
@UseInterceptors(LoggingInterceptor, TransformInterceptor)
export class TradesController {}
```

### Apply Filter

```typescript
@Controller()
@UseFilters(TelegramExceptionFilter)
export class AppController {}
```