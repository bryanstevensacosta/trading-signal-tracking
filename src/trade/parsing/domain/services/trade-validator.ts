import { TradeSide } from '@trade/shared';

/**
 * Result of validation check.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Domain service for validating trade data.
 * Ensures parsed trade data meets business rules.
 */
export class TradeValidator {
  /**
   * Validates trading symbol format.
   * @param symbol - Symbol to validate
   * @returns Validation result
   */
  validateSymbol(symbol: string | null): ValidationResult {
    if (!symbol) {
      return { valid: false, errors: ['Symbol is required'] };
    }

    const validPairs = ['USDT', 'USD', 'BTC', 'ETH'];
    const hasValidPair = validPairs.some(pair =>
      symbol.toUpperCase().endsWith(pair)
    );

    if (!hasValidPair) {
      return { valid: false, errors: ['Symbol must end with USDT, USD, BTC, or ETH'] };
    }

    return { valid: true, errors: [] };
  }

  /**
   * Validates entry price.
   * @param entry - Entry price to validate
   * @returns Validation result
   */
  validateEntry(entry: number | null): ValidationResult {
    if (entry === null) {
      return { valid: false, errors: ['Entry price is required'] };
    }

    if (entry <= 0) {
      return { valid: false, errors: ['Entry price must be positive'] };
    }

    return { valid: true, errors: [] };
  }

  /**
   * Validates stop loss price.
   * @param entry - Entry price
   * @param sl - Stop loss to validate
   * @returns Validation result
   */
  validateSL(entry: number, sl: number | null): ValidationResult {
    if (sl === null) {
      return { valid: true, errors: [] };
    }

    if (sl <= 0) {
      return { valid: false, errors: ['SL must be positive'] };
    }

    return { valid: true, errors: [] };
  }

  /**
   * Validates take profit levels.
   * @param entry - Entry price
   * @param tps - Array of take profits
   * @returns Validation result
   */
  validateTPs(entry: number, tps: number[] | null): ValidationResult {
    if (!tps || tps.length === 0) {
      return { valid: true, errors: [] };
    }

    const errors: string[] = [];

    tps.forEach((tp, index) => {
      if (tp <= 0) {
        errors.push(`TP${index + 1} must be positive`);
      }
    });

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validates complete trade data.
   * @param symbol - Trading symbol
   * @param side - Trade direction
   * @param entry - Entry price
   * @param sl - Stop loss
   * @param tps - Take profits
   * @returns Validation result
   */
  validateTrade(
    symbol: string | null,
    side: TradeSide | null,
    entry: number | null,
    sl: number | null,
    tps: number[] | null
  ): ValidationResult {
    const errors: string[] = [];

    const symbolResult = this.validateSymbol(symbol);
    errors.push(...symbolResult.errors);

    if (!side) {
      errors.push('Side is required (LONG, SHORT, or SPOT)');
    }

    const entryResult = this.validateEntry(entry);
    errors.push(...entryResult.errors);

    if (entry && sl) {
      const slResult = this.validateSL(entry, sl);
      errors.push(...slResult.errors);
    }

    if (entry && tps) {
      const tpResult = this.validateTPs(entry, tps);
      errors.push(...tpResult.errors);
    }

    return { valid: errors.length === 0, errors };
  }
}