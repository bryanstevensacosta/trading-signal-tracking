export interface TelegramConfig {
  groupId: number;
  singleTradeThreadId: number;
  tradeListThreadId: number;
}

export function getTelegramConfig(): TelegramConfig {
  return {
    groupId: parseInt(process.env.TELEGRAM_GROUP_ID || '0', 10),
    singleTradeThreadId: parseInt(process.env.TELEGRAM_SINGLE_TRADE_THREAD_ID || '0', 10),
    tradeListThreadId: parseInt(process.env.TELEGRAM_TRADE_LIST_THREAD_ID || '0', 10),
  };
}