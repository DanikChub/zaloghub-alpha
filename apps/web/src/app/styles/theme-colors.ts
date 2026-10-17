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
  light: { background: '#f4f6f8', surface: '#ffffff', sidebar: '#ffffff', sidebarBorder: '#dfe4ea', text: '#1f2937', muted: '#64748b', accent: '#2563eb' },
  dark: { background: '#11151c', surface: '#1b222d', sidebar: '#181e28', sidebarBorder: '#303947', text: '#e6edf5', muted: '#9ba9bb', accent: '#5798f7' },
  brand: { background: '#000000', surface: '#101410', sidebar: '#090e0b', sidebarBorder: '#29382e', text: '#e8f5eb', muted: '#93a99a', accent: '#34c759' },
}
