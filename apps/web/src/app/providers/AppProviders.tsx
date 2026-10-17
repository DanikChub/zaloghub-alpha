import { useEffect, type PropsWithChildren } from 'react'
import { App as AntdApp, ConfigProvider } from 'antd'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router'
import { useAppSelector } from '../store/hooks'
import { store } from '../store/store'
import { selectTheme, themeStorageKey } from '../../features/theme/model/themeSlice'
import { themePresets } from '../styles/theme-presets'

function ThemeProviders({ children }: PropsWithChildren) {
  const selectedTheme = useAppSelector(selectTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = selectedTheme
    document.documentElement.style.colorScheme = selectedTheme === 'light' ? 'light' : 'dark'
    try {
      localStorage.setItem(themeStorageKey, selectedTheme)
    } catch {
      return
    }
  }, [selectedTheme])

  return (
    <ConfigProvider theme={themePresets[selectedTheme]} componentSize="small">
      <AntdApp>
        <BrowserRouter>{children}</BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  )
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <Provider store={store}>
      <ThemeProviders>{children}</ThemeProviders>
    </Provider>
  )
}
