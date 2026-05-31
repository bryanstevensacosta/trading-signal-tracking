import { ParserPort, ParseResult } from '../../domain/ports/parser.port';
import { TRADE_PATTERNS, extractField, extractNumbers } from '../patterns/trade-patterns';
import { TradeSide, OrderType } from '@trade/shared';

const URL_PATTERN = /(https?:\/\/[^\s]+)/i;
const NUMBER_PATTERN = /[\d,]+(?:\.\d+)?/g;

/**
 * Regex-based adapter for parsing Telegram trade messages.
 */
export class RegexParserAdapter implements ParserPort {
  /**
   * Parses a Telegram message into trade data.
   * @param message - Raw message text
   * @returns Parsed trade data
   */
  parse(message: string): ParseResult {
    const rawValues: Record<string, string> = {};
    const errors: string[] = [];

    const compactParse = this.tryParseCompactFormat(message, rawValues);

    let symbol: string | null = null;
    let side: TradeSide | null = null;
    let orderType: OrderType = OrderType.LIMIT;
    let entry: number | null = null;
    let entryMax: number | null = null;
    let sl: number | null = null;
    let tps: number[] = [];
    let chartUrl: string | null = null;
    const notes = this.extractNotes(message, rawValues);

    if (compactParse) {
      symbol = compactParse.symbol;
      entry = compactParse.entry;
      sl = compactParse.sl;
      tps = compactParse.tps;
      chartUrl = compactParse.chartUrl;
      orderType = compactParse.orderType;
      side = this.inferSide(entry, sl);
    } else {
      orderType = this.extractOrderType(message, rawValues);
      symbol = this.extractSymbol(message, rawValues);
      side = this.extractSide(message, rawValues);
      entry = this.extractNumber(message, 'entry', rawValues, errors);
      entryMax = this.extractNumber(message, 'entryMax', rawValues, errors);
      sl = this.extractNumber(message, 'sl', rawValues, errors);
      tps = this.extractNumbers(message, 'tp', rawValues);
      chartUrl = this.extractChart(message, rawValues);
    }

    const hasData = Boolean(symbol && side && entry);
    const hasErrors = errors.length > 0;

    if (!hasData) {
      return { success: false, data: null, errors: ['Missing required trade data (symbol, side, or entry)'] };
    }

    return {
      success: !hasErrors,
      data: {
        symbol: symbol!,
        side: side!,
        orderType,
        entry: entry!,
        entryMax,
        sl,
        tps: tps.length > 0 ? tps : null,
        chartUrl,
        notes,
      },
      errors,
    };
  }

  private extractOrderType(text: string, raw: Record<string, string>): OrderType {
    const upperText = text.toUpperCase();
    
    if (/\bMARKET\b/i.test(upperText)) {
      raw['orderType'] = 'MARKET';
      return OrderType.MARKET;
    }
    
    raw['orderType'] = 'LIMIT';
    return OrderType.LIMIT;
  }

  private tryParseCompactFormat(
    text: string,
    raw: Record<string, string>
  ): { symbol: string; entry: number; sl: number; tps: number[]; chartUrl: string | null; orderType: OrderType } | null {
    let cleanText = text.replace(/\n/g, ' ').trim();

    if (/entry[:\s]|sl[:\s]|tp\d*[:\s]|take\s*profit/i.test(cleanText)) {
      return null;
    }

    const sideMatch = cleanText.match(/^(LONG|SHORT|SPOT)\s+/i);
    if (sideMatch) {
      cleanText = cleanText.slice(sideMatch[0].length);
    }

    const symbolMatch = cleanText.match(/^([A-Z]{2,10})(?:USDT|USD|BTC|ETH)?(?=\s|$)/i);
    if (!symbolMatch) return null;

    const symbolRaw = symbolMatch[1].toUpperCase();
    const symbol = symbolRaw.endsWith('USDT') ? symbolRaw : symbolRaw + 'USDT';

    const restOfText = cleanText.slice(symbolMatch[0].length).trim();
    if (!restOfText) return null;

    const urlMatch = restOfText.match(URL_PATTERN);
    let numbersText = restOfText;
    let chartUrl: string | null = null;

    if (urlMatch) {
      chartUrl = urlMatch[0];
      numbersText = restOfText.replace(chartUrl, '').trim();
    }

    const numberMatches = numbersText.match(NUMBER_PATTERN);
    if (!numberMatches || numberMatches.length < 2) return null;

    const entry = this.parseNumber(numberMatches[0]);
    const sl = this.parseNumber(numberMatches[1]);

    if (entry === null || sl === null) return null;

    const tps: number[] = [];
    for (let i = 2; i < numberMatches.length; i++) {
      const tp = this.parseNumber(numberMatches[i]);
      if (tp !== null) tps.push(tp);
    }

    raw['symbol'] = symbol;
    raw['entry'] = numberMatches[0];
    raw['sl'] = numberMatches[1];
    if (tps.length > 0) raw['tp'] = tps.join(', ');
    if (chartUrl) raw['chart'] = chartUrl;

    return { symbol, entry, sl, tps, chartUrl, orderType: OrderType.LIMIT };
  }

  private inferSide(entry: number | null, sl: number | null): TradeSide | null {
    if (entry === null || sl === null) return null;
    return sl < entry ? TradeSide.LONG : TradeSide.SHORT;
  }

  private extractSymbol(text: string, raw: Record<string, string>): string | null {
    const match = text.match(TRADE_PATTERNS.symbol.pattern);
    if (match) {
      const full = match[0].toUpperCase();
      raw['symbol'] = full;
      return full.replace(/USDT$/i, '').replace(/USD$/i, '') + 'USDT';
    }
    return null;
  }

  private extractSide(text: string, raw: Record<string, string>): TradeSide | null {
    const match = text.match(TRADE_PATTERNS.side.pattern);
    if (match) {
      const side = match[1].toUpperCase() as TradeSide;
      raw['side'] = side;
      return side;
    }
    return null;
  }

  private extractNumber(
    text: string,
    field: keyof typeof TRADE_PATTERNS,
    raw: Record<string, string>,
    errors: string[]
  ): number | null {
    const pattern = TRADE_PATTERNS[field];
    if (!pattern) return null;

    const value = extractField(text, pattern.pattern, pattern.group);
    if (value) {
      const num = this.parseNumber(value);
      if (num !== null) {
        raw[field] = value;
        return num;
      } else {
        errors.push(`Invalid ${field} value: ${value}`);
      }
    }
    return null;
  }

  private extractNumbers(
    text: string,
    field: 'tp',
    raw: Record<string, string>
  ): number[] {
    const numbers = extractNumbers(text, field);

    if (numbers.length > 0) {
      raw[field] = numbers.join(', ');
    }

    return numbers;
  }

  private extractChart(text: string, raw: Record<string, string>): string | null {
    const value = extractField(text, TRADE_PATTERNS.chart.pattern, TRADE_PATTERNS.chart.group);
    if (value) {
      raw['chart'] = value;
      return value;
    }
    return null;
  }

  private extractNotes(text: string, raw: Record<string, string>): string | null {
    const value = extractField(text, TRADE_PATTERNS.notes.pattern, TRADE_PATTERNS.notes.group);
    if (value) {
      raw['notes'] = value;
      return value;
    }
    return null;
  }

  private parseNumber(value: string): number | null {
    const cleaned = value.replace(/,/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
}