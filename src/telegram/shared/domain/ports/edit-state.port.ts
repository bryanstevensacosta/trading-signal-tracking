export interface InlineButton {
  text: string;
  callback_data: string;
}

export interface EditState {
  tradeId: string;
  chatId: number;
  messageId: number;
  field: string;
  phase: 'waiting_for_value' | 'confirming';
  confirmationMessageId?: number;
}

export interface PendingTrade {
  tradeId: string;
  chatId: number;
  messageId: number;
  confirmationMessageId: number;
  editButtons: InlineButton[][];
}

export const EDIT_STATE_PORT = Symbol('EditStatePort');

export interface EditStatePort {
  startEditing(chatId: number, tradeId: string, messageId: number, field: string, confirmationMessageId?: number): void;
  getEditingState(chatId: number, tradeId: string): EditState | undefined;
  isWaitingForValue(chatId: number, tradeId: string): boolean;
  clearEditingState(chatId: number, tradeId: string): void;
  getAllEditingStates(): EditState[];

  addPendingTrade(chatId: number, tradeId: string, messageId: number, confirmationMessageId: number, editButtons?: InlineButton[][]): void;
  getPendingTrade(chatId: number, tradeId: string): PendingTrade | undefined;
  removePendingTrade(chatId: number, tradeId: string): void;
}