import { Module, Provider } from '@nestjs/common';
import { PinoLoggerAdapter } from './infrastructure/adapters/pino-logger.adapter';
import { LOGGER_PORT } from './domain/ports/logger.port';

const LOGGER_PORT_PROVIDER: Provider = {
  provide: LOGGER_PORT,
  useClass: PinoLoggerAdapter,
};

/**
 * Shared module providing application-wide logging infrastructure.
 * 
 * @example
 * // Inject via LOGGER_PORT token
 * constructor(@Inject(LOGGER_PORT) private logger: LoggerPort) {}
 * 
 * // Or inject the adapter directly
 * constructor(private logger: PinoLoggerAdapter) {}
 */
@Module({
  providers: [PinoLoggerAdapter, LOGGER_PORT_PROVIDER],
  exports: [LOGGER_PORT, PinoLoggerAdapter],
})
export class LoggerModule {}
