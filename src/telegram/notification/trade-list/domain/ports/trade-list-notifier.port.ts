export const TRADE_LIST_NOTIFIER_PORT = 'TRADE_LIST_NOTIFIER_PORT';

export interface TradeListNotifierPort {
  notify(chatId: number): Promise<void>;
}
