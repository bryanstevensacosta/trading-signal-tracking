import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradeEntity } from '../../src/trade/repository/infrastructure/persistence/trade.entity';
import { TradeStatus, TradeSide, CreateTradeInput } from '../../src/trade/shared';
import { TelegramCommandModule } from '../../src/telegram/cmd/telegram-command.module';

describe('Telegram Command Module (e2e)', () => {
  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [TradeEntity],
          synchronize: true,
        }),
        TelegramCommandModule,
      ],
    }).compile();
  });

  describe('Module initialization', () => {
    it('should compile the module without errors', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({
            type: 'better-sqlite3',
            database: ':memory:',
            entities: [TradeEntity],
            synchronize: true,
          }),
          TelegramCommandModule,
        ],
      }).compile();

      expect(module).toBeDefined();
    });
  });
});