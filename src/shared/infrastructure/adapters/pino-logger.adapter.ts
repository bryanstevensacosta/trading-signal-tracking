import { Injectable, OnModuleDestroy, LoggerService } from '@nestjs/common';
import pino from 'pino';
import { createWriteStream, readFileSync, statSync, existsSync, openSync, writeSync, closeSync } from 'fs';
import { join } from 'path';
import { LoggerPort } from '../../domain/ports/logger.port';

const LOG_FILE_PATH = join(process.cwd(), 'app.log');
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const PURGE_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class PinoLoggerAdapter implements LoggerPort, LoggerService, OnModuleDestroy {
  private readonly logger: pino.Logger;
  private purgeTimer: NodeJS.Timeout | null = null;

  constructor() {
    const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';

    this.logger = pino({
      level: isDev ? 'debug' : 'info',
      base: { pid: process.pid },
    }, isDev
      ? pino.multistream([
          { stream: process.stdout },
          { stream: createWriteStream(LOG_FILE_PATH, { flags: 'a' }) },
        ])
      : createWriteStream(LOG_FILE_PATH, { flags: 'a' })
    );

    this.startPeriodicPurge();
  }

  trace(message: string, context?: string): void {
    this.logger.trace({ context }, message);
  }

  debug(message: string, context?: string): void {
    this.logger.debug({ context }, message);
  }

  info(message: string, context?: string): void {
    this.logger.info({ context }, message);
  }

  warn(message: string, context?: string): void {
    this.logger.warn({ context }, message);
  }

  error(message: string, error?: Error | string, context?: string): void {
    if (error instanceof Error) {
      this.logger.error({ context, err: { message: error.message, stack: error.stack } }, message);
    } else if (typeof error === 'string') {
      this.logger.error({ context, trace: error }, message);
    } else {
      this.logger.error({ context }, message);
    }
  }

  fatal(message: string, error?: Error | string, context?: string): void {
    if (error instanceof Error) {
      this.logger.fatal({ context, err: { message: error.message, stack: error.stack } }, message);
    } else if (typeof error === 'string') {
      this.logger.fatal({ context, trace: error }, message);
    } else {
      this.logger.fatal({ context }, message);
    }
  }

  log(message: string, context?: string): void {
    this.info(message, context);
  }

  onModuleDestroy(): void {
    if (this.purgeTimer) {
      clearInterval(this.purgeTimer);
      this.purgeTimer = null;
    }
  }

  private startPeriodicPurge(): void {
    this.purgeTimer = setInterval(() => {
      this.purgeOldLogs();
    }, PURGE_INTERVAL_MS);

    this.purgeTimer.unref();
  }

  private purgeOldLogs(): void {
    try {
      if (!existsSync(LOG_FILE_PATH)) {
        return;
      }

      const stats = statSync(LOG_FILE_PATH);
      if (stats.size === 0) {
        return;
      }

      const content = readFileSync(LOG_FILE_PATH, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim() !== '');
      const cutoffTime = Date.now() - MAX_AGE_MS;

      const filteredLines = lines.filter((line) => {
        try {
          const entry = JSON.parse(line);
          const logTime = entry?.time ? new Date(entry.time).getTime() : Date.now();
          return logTime > cutoffTime;
        } catch {
          return true;
        }
      });

      if (filteredLines.length < lines.length) {
        const fd = openSync(LOG_FILE_PATH, 'w');
        writeSync(fd, filteredLines.join('\n') + '\n');
        closeSync(fd);
      }
    } catch (error) {
      console.error('Failed to purge old logs:', error);
    }
  }
}

export const PINO_LOGGER_ADAPTER = PinoLoggerAdapter;
