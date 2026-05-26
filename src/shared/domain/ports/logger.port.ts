export const LOGGER_PORT = 'LOGGER_PORT';

export enum LogLevel {
  TRACE = 'trace',
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  timestamp: Date;
  error?: {
    message: string;
    stack?: string;
  };
}

/**
 * Port for application logging operations.
 * Defines the contract for logging that infrastructure implements.
 * @see Ports in domain define interfaces, infrastructure implements them.
 */
export interface LoggerPort {
  /**
   * Logs a trace message.
   * @param message - The message to log
   * @param context - Optional context (e.g., class name)
   */
  trace(message: string, context?: string): void;

  /**
   * Logs a debug message.
   * @param message - The message to log
   * @param context - Optional context
   */
  debug(message: string, context?: string): void;

  /**
   * Logs an info message.
   * @param message - The message to log
   * @param context - Optional context
   */
  info(message: string, context?: string): void;

  /**
   * Logs a warning message.
   * @param message - The message to log
   * @param context - Optional context
   */
  warn(message: string, context?: string): void;

  /**
   * Logs an error message.
   * @param message - The message to log
   * @param error - Optional error object with stack trace
   * @param context - Optional context
   */
  error(message: string, error?: Error | string, context?: string): void;

  /**
   * Logs a fatal/critical message.
   * @param message - The message to log
   * @param error - Optional error object with stack trace
   * @param context - Optional context
   */
  fatal(message: string, error?: Error | string, context?: string): void;
}
