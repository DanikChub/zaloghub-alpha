import { theme, type ThemeConfig } from 'antd'

export type AppThemeName = 'light' | 'dark' | 'brand'

const common = {
  borderRadius: 0,
  fontSize: 13,
  controlHeight: 30,
  fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}

export const themePresets: Record<AppThemeName, ThemeConfig> = {
  light: {
    algorithm: [theme.defaultAlgorithm, theme.compactAlgorithm],
    token: { ...common, colorPrimary: '#2563eb', colorBgLayout: '#f4f6f8', colorBorder: '#dfe4ea' },
  },
  dark: {
    algorithm: [theme.darkAlgorithm, theme.compactAlgorithm],
    token: { ...common, colorPrimary: '#5798f7', colorBgLayout: '#11151c', colorBgContainer: '#1b222d' },
  },
  brand: {
    algorithm: [theme.darkAlgorithm, theme.compactAlgorithm],
    token: { ...common, colorPrimary: '#34c759', colorBgLayout: '#000000', colorBgContainer: '#101410', colorBorder: '#29382e' },
  },
}
