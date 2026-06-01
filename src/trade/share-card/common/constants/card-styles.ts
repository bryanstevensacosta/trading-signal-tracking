import { CardTheme, CardConfig } from '@trade/share-card/common/types';

/**
 * Default dark theme for share cards.
 */
export const DARK_THEME: CardTheme = {
  colors: {
    primary: '#3b82f6',
    success: '#22c55e',
    danger: '#ef4444',
    warning: '#f59e0b',
    text: '#ffffff',
    textMuted: '#9ca3af',
    background: '#0f172a',
    card: '#1e293b',
    border: '#334155',
  },
  fonts: {
    primary: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
    mono: 'JetBrains Mono, Consolas, Monaco, monospace',
  },
  borderRadius: 12,
};

/**
 * Default light theme for share cards.
 */
export const LIGHT_THEME: CardTheme = {
  colors: {
    primary: '#2563eb',
    success: '#16a34a',
    danger: '#dc2626',
    warning: '#d97706',
    text: '#1f2937',
    textMuted: '#6b7280',
    background: '#f8fafc',
    card: '#ffffff',
    border: '#e5e7eb',
  },
  fonts: {
    primary: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
    mono: 'JetBrains Mono, Consolas, Monaco, monospace',
  },
  borderRadius: 12,
};

/**
 * Default card dimensions for position cards.
 */
export const POSITION_CARD_CONFIG: CardConfig = {
  width: 400,
  height: 280,
  theme: DARK_THEME,
};

/**
 * Default card dimensions for account cards.
 */
export const ACCOUNT_CARD_CONFIG: CardConfig = {
  width: 600,
  height: 400,
  theme: DARK_THEME,
};

/**
 * Standard padding for cards.
 */
export const CARD_PADDING = 24;

/**
 * Standard spacing between elements.
 */
export const CARD_SPACING = 16;

/**
 * Small spacing between elements.
 */
export const CARD_SPACING_SMALL = 8;

/**
 * Large spacing between sections.
 */
export const CARD_SPACING_LARGE = 32;