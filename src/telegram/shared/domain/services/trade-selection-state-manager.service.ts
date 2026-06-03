import { Injectable } from '@nestjs/common';

export interface TradeSelectionPage {
  chatId: number;
  page: number;
  totalPages: number;
  totalTrades: number;
  messageId: number;
  timestamp: number;
}

export interface TradeSelectionState {
  chatId: number;
  tradeId: string;
  messageId: number;
  listMessageId: number;
  timestamp: number;
}

const PAGE_TIMEOUT_MS = 15 * 60 * 1000;
const STATE_TIMEOUT_MS = 15 * 60 * 1000;

@Injectable()
export class TradeSelectionStateManager {
  private readonly selectionPages = new Map<number, TradeSelectionPage>();
  private readonly selectionStates = new Map<number, TradeSelectionState>();

  setSelectionPage(chatId: number, page: number, totalPages: number, totalTrades: number, messageId: number): void {
    this.cleanupOldPages();
    this.selectionPages.set(chatId, {
      chatId,
      page,
      totalPages,
      totalTrades,
      messageId,
      timestamp: Date.now(),
    });
  }

  getSelectionPage(chatId: number): TradeSelectionPage | undefined {
    const page = this.selectionPages.get(chatId);
    if (!page) return undefined;
    if (Date.now() - page.timestamp > PAGE_TIMEOUT_MS) {
      this.selectionPages.delete(chatId);
      return undefined;
    }
    return page;
  }

  clearSelectionPage(chatId: number): void {
    this.selectionPages.delete(chatId);
  }

  setSelectionState(chatId: number, tradeId: string, messageId: number, listMessageId: number): void {
    this.cleanupOldStates();
    this.selectionStates.set(chatId, {
      chatId,
      tradeId,
      messageId,
      listMessageId,
      timestamp: Date.now(),
    });
  }

  getSelectionState(chatId: number): TradeSelectionState | undefined {
    const state = this.selectionStates.get(chatId);
    if (!state) return undefined;
    if (Date.now() - state.timestamp > STATE_TIMEOUT_MS) {
      this.selectionStates.delete(chatId);
      return undefined;
    }
    return state;
  }

  clearSelectionState(chatId: number): void {
    this.selectionStates.delete(chatId);
  }

  clearAll(chatId: number): void {
    this.selectionPages.delete(chatId);
    this.selectionStates.delete(chatId);
  }

  private cleanupOldPages(): void {
    const now = Date.now();
    for (const [key, page] of this.selectionPages.entries()) {
      if (now - page.timestamp > PAGE_TIMEOUT_MS) {
        this.selectionPages.delete(key);
      }
    }
  }

  private cleanupOldStates(): void {
    const now = Date.now();
    for (const [key, state] of this.selectionStates.entries()) {
      if (now - state.timestamp > STATE_TIMEOUT_MS) {
        this.selectionStates.delete(key);
      }
    }
  }
}