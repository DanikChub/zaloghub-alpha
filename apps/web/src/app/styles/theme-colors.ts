import type { AppThemeName } from './theme-presets'

export interface AppThemeColors {
  background: string
  surface: string
  sidebar: string
  sidebarBorder: string
  text: string
  muted: string
  accent: string
}

export const themeColors: Record<AppThemeName, AppThemeColors> = {
  light: {
    background: '#f5f7fb',
    surface: '#ffffff',
    sidebar: '#ffffff',
    sidebarBorder: '#e8edf3',
    text: '#17263b',
    muted: '#76859a',
    accent: '#2563eb',
  },
  dark: {
    background: '#11151c',
    surface: '#1b222d',
    sidebar: '#181e28',
    sidebarBorder: '#2a3543',
    text: '#edf2f8',
    muted: '#9cabbc',
    accent: '#5798f7',
  },
  brand: {
    background: '#000000',
    surface: '#101410',
    sidebar: '#090e0b',
    sidebarBorder: '#213127',
    text: '#f0f8f2',
    muted: '#94a99b',
    accent: '#34C759',
  },
}
