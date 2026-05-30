import { Injectable } from '@nestjs/common';

export interface EditState {
  tradeId: string;
  chatId: number;
  messageId: number;
  field: string;
  phase: 'waiting_for_value' | 'confirming';
  confirmationMessageId?: number;
}

export interface InlineButton {
  text: string;
  callback_data: string;
}

export interface PendingTrade {
  tradeId: string;
  chatId: number;
  messageId: number;
  confirmationMessageId: number;
  editButtons: InlineButton[][];
}

@Injectable()
export class EditStateManager {
  private readonly editingStates = new Map<string, EditState & { timestamp: number }>();
  private readonly pendingTrades = new Map<string, PendingTrade>();

  startEditing(chatId: number, tradeId: string, messageId: number, field: string, confirmationMessageId?: number): void {
    const key = this.getKey(chatId, tradeId);
    this.editingStates.set(key, {
      tradeId,
      chatId,
      messageId,
      field,
      phase: 'waiting_for_value',
      timestamp: Date.now(),
      confirmationMessageId,
    });
    this.cleanupOldStates();
  }

  getEditingState(chatId: number, tradeId: string): EditState | undefined {
    const state = this.editingStates.get(this.getKey(chatId, tradeId));
    if (!state) return undefined;
    const { timestamp: _t, ...rest } = state;
    void _t;
    return rest;
  }

  isWaitingForValue(chatId: number, tradeId: string): boolean {
    const state = this.editingStates.get(this.getKey(chatId, tradeId));
    return state?.phase === 'waiting_for_value';
  }

  clearEditingState(chatId: number, tradeId: string): void {
    this.editingStates.delete(this.getKey(chatId, tradeId));
  }

  getAllEditingStates(): EditState[] {
    this.cleanupOldStates();
    return Array.from(this.editingStates.values()).map((state) => {
      const { timestamp: _t, ...rest } = state;
      void _t;
      return rest;
    });
  }

  addPendingTrade(chatId: number, tradeId: string, messageId: number, confirmationMessageId: number, editButtons: InlineButton[][] = []): void {
    const key = this.getKey(chatId, tradeId);
    this.pendingTrades.set(key, {
      tradeId,
      chatId,
      messageId,
      confirmationMessageId,
      editButtons,
    });
  }

  getPendingTrade(chatId: number, tradeId: string): PendingTrade | undefined {
    return this.pendingTrades.get(this.getKey(chatId, tradeId));
  }

  removePendingTrade(chatId: number, tradeId: string): void {
    this.pendingTrades.delete(this.getKey(chatId, tradeId));
  }

  private getKey(chatId: number, tradeId: string): string {
    return `${chatId}:${tradeId}`;
  }

  private cleanupOldStates(): void {
    const now = Date.now();
    const timeout = 120000;
    for (const [key, state] of this.editingStates.entries()) {
      if (now - state.timestamp > timeout) {
        this.editingStates.delete(key);
      }
    }
  }
}