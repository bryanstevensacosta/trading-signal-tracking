import { NestFactory } from '@nestjs/core';
import { config } from 'dotenv';
import { AppModule } from './app.module';
import { PINO_LOGGER_ADAPTER } from './shared';

config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(PINO_LOGGER_ADAPTER));

  const logger = app.get(PINO_LOGGER_ADAPTER);
  const port = process.env.PORT || 3015;
  await app.listen(port);

  logger.info(`Application is running on: http://localhost:${port}`, 'Bootstrap');
}

bootstrap();