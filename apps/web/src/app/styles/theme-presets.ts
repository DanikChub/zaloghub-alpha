import { theme, type ThemeConfig } from 'antd'

export type AppThemeName = 'light' | 'dark' | 'brand'

const commonTokens = {
  borderRadius: 10,
  fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}

export const themePresets: Record<AppThemeName, ThemeConfig> = {
  light: {
    algorithm: theme.defaultAlgorithm,
    token: {
      ...commonTokens,
      colorPrimary: '#2563eb',
      colorBgLayout: '#f5f7fb',
    },
  },
  dark: {
    algorithm: theme.darkAlgorithm,
    token: {
      ...commonTokens,
      colorPrimary: '#5798f7',
      colorBgLayout: '#11151c',
      colorBgContainer: '#1b222d',
    },
  },
  brand: {
    algorithm: theme.darkAlgorithm,
    token: {
      ...commonTokens,
      colorPrimary: '#34C759',
      colorBgLayout: '#000000',
      colorBgContainer: '#101410',
      colorBorder: '#29382e',
    },
  },
}

export const defaultThemeName: AppThemeName = 'light'
