/**
 * Regex patterns for extracting trade fields from messages.
 */
export const TRADE_PATTERNS = {
  symbol: {
    pattern: /([A-Z]{2,10})(USDT|USD|BTC|ETH)/i,
    group: 0,
  },
  side: {
    pattern: /(?:^|\s)(LONG|SHORT|SPOT)(?:$|\s)/i,
    group: 1,
  },
  entry: {
    pattern: /(?:entry|entry\s*price|buy\s*price)[:\s]*([\d,.]+)/i,
    group: 1,
  },
  entryMax: {
    pattern: /(?:entry\s*max|max\s*entry|entry\s*range)[:\s]*([\d,.]+)/i,
    group: 1,
  },
  sl: {
    pattern: /(?:sl|stop\s*loss)[:\s]*([\d,.]+)/i,
    group: 1,
  },
  tp: {
    pattern: /(?:tp\d*|take\s*profit)[:\s]*([\d,.]+)/gi,
    group: 1,
  },
  chart: {
    pattern: /(?:chart|chart\s*url|img|image)[:\s]*(https?:\/\/[^\s]+)/i,
    group: 1,
  },
  notes: {
    pattern: /(?:notes?|comment|reason)[:]\s*(.+)/i,
    group: 1,
  },
  quantity: {
    pattern: /(?:qty|quantity|amount|size)[:\s]*([\d,.]+)/i,
    group: 1,
  },
  leverage: {
    pattern: /(\d+)\s*x|leverage[:\s]*(\d+)/i,
    group: 1,
  },
} as const;

/**
 * Extracts a field value from text using a regex pattern.
 * @param text - Input text to search
 * @param pattern - Regex pattern
 * @param group - Capture group index (default: 1)
 * @returns Extracted value or null
 */
export function extractField(
  text: string,
  pattern: RegExp,
  group: number = 1
): string | null {
  const match = text.match(pattern);
  if (match && match[group]) {
    return match[group].trim();
  }
  return null;
}

/**
 * Extracts a numeric field from text.
 * @param text - Input text to search
 * @param field - Field name from TRADE_PATTERNS
 * @returns Parsed number or null
 */
export function extractNumber(text: string, field: keyof typeof TRADE_PATTERNS): number | null {
  const pattern = TRADE_PATTERNS[field];
  if (!pattern) return null;

  const value = extractField(text, pattern.pattern, pattern.group);
  if (value) {
    return parseFloat(value.replace(/,/g, ''));
  }
  return null;
}

/**
 * Extracts multiple numeric values (e.g., multiple TPs).
 * @param text - Input text to search
 * @param field - Field name (only 'tp' supported)
 * @returns Array of extracted numbers
 */
export function extractNumbers(text: string, field: 'tp'): number[] {
  const pattern = TRADE_PATTERNS[field];
  if (!pattern) return [];

  const matches = text.matchAll(new RegExp(pattern.pattern.source, 'gi'));
  const numbers: number[] = [];

  for (const match of matches) {
    const value = match[pattern.group];
    const num = parseFloat(value?.replace(/,/g, '') || '');
    if (!isNaN(num)) {
      numbers.push(num);
    }
  }

  return numbers;
}