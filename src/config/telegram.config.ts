export interface TelegramConfig {
  groupId: number;
  tradeAlertsThreadId: number;
  tradeListThreadId: number;
}

export function getTelegramConfig(): TelegramConfig {
  return {
    groupId: parseInt(process.env.TELEGRAM_GROUP_ID || '0', 10),
    tradeAlertsThreadId: parseInt(process.env.TELEGRAM_TRADE_ALERTS_THREAD_ID || '0', 10),
    tradeListThreadId: parseInt(process.env.TELEGRAM_TRADE_LIST_THREAD_ID || '0', 10),
  };
}