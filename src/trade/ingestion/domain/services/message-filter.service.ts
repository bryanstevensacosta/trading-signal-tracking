import { Injectable } from '@nestjs/common';

/**
 * Result of filtering a Telegram message.
 * 
 * @interface FilterResult
 * @property shouldProcess - Whether the message should be processed
 * @property reason - Reason for rejection if shouldProcess is false
 */
export interface FilterResult {
  shouldProcess: boolean;
  reason?: string;
}

/**
 * Domain service that filters incoming Telegram messages.
 * Determines if a message should be processed as a trade or filtered out.
 * 
 * @class MessageFilterService
 * @description Filters empty messages, commands, and non-trade content
 * 
 * @example
 * const result = filterService.filter('LONG BTCUSDT Entry: 50000', chatId);
 * if (result.shouldProcess) {
 *   // Process as trade
 * }
 */
@Injectable()
export class MessageFilterService {
  private readonly ignoredCommands = [
    '/start',
    '/help',
    '/settings',
    '/stats',
    '/trades',
  ];

  private readonly channelKeywords = [
    'long', 'short', 'spot', 'entry', 'sl', 'tp',
    'take profit', 'stop loss', 'usdt', 'usdc', 'btc', 'eth',
  ];

  /**
   * Filters a message to determine if it should be processed as a trade.
   * 
   * @param text - The message text to filter
   * @param chatId - The Telegram chat ID (unused but available for future logic)
   * @returns FilterResult indicating whether to process and why if rejected
   * 
   * @example
   * const result = filterService.filter('LONG BTCUSDT Entry: 50000', 123456789);
   * // result.shouldProcess === true
   * 
   * @example
   * const result = filterService.filter('/help', 123456789);
   * // result.shouldProcess === false
   * // result.reason === 'is_command'
   */
  filter(text: string, _chatId: number): FilterResult {
    const lowerText = text.toLowerCase().trim();

    if (!text || text.trim().length === 0) {
      return { shouldProcess: false, reason: 'empty_message' };
    }

    if (this.isCommand(lowerText)) {
      return { shouldProcess: false, reason: 'is_command' };
    }

    if (!this.looksLikeTrade(lowerText)) {
      return { shouldProcess: false, reason: 'not_trade_related' };
    }

    return { shouldProcess: true };
  }

  /**
   * Checks if the text is a bot command.
   * 
   * @param text - Lowercase text to check
   * @returns True if text starts with a known command
   */
  private isCommand(text: string): boolean {
    return this.ignoredCommands.some((cmd) => text.startsWith(cmd));
  }

  /**
   * Checks if the text appears to be trade-related.
   * 
   * @param text - Lowercase text to check
   * @returns True if text contains trade-related keywords
   */
  private looksLikeTrade(text: string): boolean {
    return this.channelKeywords.some((keyword) => text.includes(keyword));
  }
}