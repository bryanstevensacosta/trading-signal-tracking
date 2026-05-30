import { Injectable } from '@nestjs/common';
import { Trade, isActiveTrade, canCancel, canManualClose, canMoveToBreakeven, canModifyEntry } from '../../shared';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

@Injectable()
export class TradeValidationService {
  validateTradeId(tradeId: string): ValidationResult {
    const errors: string[] = [];

    if (!tradeId || tradeId.trim() === '') {
      errors.push('Trade ID is required');
    }

    return { valid: errors.length === 0, errors };
  }

  validateEntryPrice(price: number): ValidationResult {
    const errors: string[] = [];

    if (!price || price <= 0) {
      errors.push('Entry must be a positive number');
    }

    return { valid: errors.length === 0, errors };
  }

  validateModifyEntry(trade: Trade, newEntry: number): ValidationResult {
    const errors: string[] = [];

    if (!canModifyEntry(trade.status)) {
      errors.push('Can only modify entry for pending trades');
    }

    if (newEntry <= 0) {
      errors.push('Entry must be positive');
    }

    if (trade.sl && newEntry < trade.sl) {
      errors.push('Entry cannot be below SL');
    }

    return { valid: errors.length === 0, errors };
  }

  validateModifySL(trade: Trade, newSL: number): ValidationResult {
    const errors: string[] = [];

    if (!isActiveTrade(trade.status)) {
      errors.push('Can only modify SL for active trades');
    }

    if (newSL <= 0) {
      errors.push('SL must be positive');
    }

    if (trade.side === 'LONG' && trade.entry && newSL >= trade.entry) {
      errors.push('SL must be below entry for LONG trades');
    }

    if (trade.side === 'SHORT' && trade.entry && newSL <= trade.entry) {
      errors.push('SL must be above entry for SHORT trades');
    }

    return { valid: errors.length === 0, errors };
  }

  validateModifyTP(trade: Trade, newTPs: number[]): ValidationResult {
    const errors: string[] = [];

    if (!isActiveTrade(trade.status)) {
      errors.push('Can only modify TP for active trades');
    }

    newTPs.forEach((tp, index) => {
      if (tp <= 0) {
        errors.push(`TP${index + 1} must be positive`);
      }
    });

    return { valid: errors.length === 0, errors };
  }

  validateCancel(trade: Trade): ValidationResult {
    const errors: string[] = [];

    if (!canCancel(trade.status)) {
      errors.push('Can only cancel pending trades');
    }

    return { valid: errors.length === 0, errors };
  }

  validateClose(trade: Trade): ValidationResult {
    const errors: string[] = [];

    if (!canManualClose(trade.status)) {
      errors.push('Can only close active trades');
    }

    return { valid: errors.length === 0, errors };
  }

  validateBreakeven(trade: Trade): ValidationResult {
    const errors: string[] = [];

    if (!canMoveToBreakeven(trade.status)) {
      errors.push('Can only move to breakeven for active or partial TP trades');
    }

    return { valid: errors.length === 0, errors };
  }

  validateDelete(trade: Trade): ValidationResult {
    const errors: string[] = [];

    if (!trade.status.startsWith('closed_') && trade.status !== 'cancelled') {
      errors.push('Can only delete closed or cancelled trades');
    }

    return { valid: errors.length === 0, errors };
  }
}