# NestJS Lifecycle Hooks

NestJS provides lifecycle hooks to tap into key moments in the application lifecycle.

## Lifecycle Sequence

```
onModuleInit()        → Called once when module is initialized
onApplicationBootstrap() → Called once when app fully bootstrapped
onModuleDestroy()     → Called before module is destroyed
onApplicationShutdown() → Called before application shuts down
```

## OnModuleInit

Called when the module has been initialized by NestJS.

```typescript
@Injectable()
export class PriceStreamService implements OnModuleInit {
  private streams = new Map<string, WebSocket>();

  onModuleInit() {
    console.log('PriceStreamService initialized');
    this.connectToBinance();
  }

  private async connectToBinance() {
    // Establish WebSocket connections
  }
}
```

## OnApplicationBootstrap

Called after all modules are initialized and NestJS is fully bootstrapped.

```typescript
@Injectable()
export class AppStartupService implements OnApplicationBootstrap {
  onApplicationBootstrap() {
    console.log('Application fully bootstrapped');
    // Start monitoring active trades
    this.tradeMonitor.start();
  }
}
```

## OnModuleDestroy

Called before the NestJS container is destroyed.

```typescript
@Injectable()
export class CleanupService implements OnModuleDestroy {
  onModuleDestroy() {
    console.log('Cleaning up...');
    this.disconnectAll();
    this.saveState();
  }

  private disconnectAll() {
    // Clean up WebSocket connections
  }

  private saveState() {
    // Persist any in-memory state
  }
}
```

## OnApplicationShutdown

Called when the application is shutting down (after all connections closed).

```typescript
@Injectable()
export class ShutdownService implements OnApplicationShutdown {
  constructor(private readonly httpAdapter: HttpAdapterHost) {}

  async onApplicationShutdown(signal?: string) {
    console.log(`Shutting down due to: ${signal}`);
    await this.cleanupDatabase();
    await this.closeConnections();
  }

  private async cleanupDatabase() {
    // Close DB connections
  }

  private async closeConnections() {
    // Close Redis, external APIs, etc.
  }
}
```

## Usage in Modules

```typescript
@Module({
  providers: [PriceStreamService, CleanupService],
})
export class PriceModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PriceModule.name);

  async onModuleInit() {
    this.logger.log('PriceModule initializing...');
  }

  async onModuleDestroy() {
    this.logger.log('PriceModule destroying...');
  }
}
```

## Signals

NestJS handles these shutdown signals:
- `SIGINT` (Ctrl+C)
- `SIGTERM` (Docker/Kubernetes)
- `SIGQUIT`

## Practical Examples

### WebSocket Cleanup

```typescript
@Injectable()
export class BinanceGateway implements OnModuleDestroy {
  private clients: WebSocket[] = [];

  onModuleDestroy() {
    this.clients.forEach(client => client.close());
    this.clients = [];
  }
}
```

### Price Cache Persistence

```typescript
@Injectable()
export class PriceCacheService implements OnModuleDestroy {
  onModuleDestroy() {
    const prices = this.cache.toJSON();
    fs.writeFileSync('prices.json', JSON.stringify(prices));
  }
}
```

### Graceful Shutdown

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();

  await app.listen(3000);
}
```

## Summary

| Hook | When | Use Case |
|------|------|----------|
| `onModuleInit` | After constructor, before init | Initialize connections, load config |
| `onApplicationBootstrap` | After all modules init | Start background jobs |
| `onModuleDestroy` | Before cleanup | Clean up resources |
| `onApplicationShutdown` | After cleanup | Close DB, external connections |