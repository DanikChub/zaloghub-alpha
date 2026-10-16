import type { PropsWithChildren } from 'react'
import { App as AntdApp, ConfigProvider } from 'antd'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router'
import { store } from '../store/store'
import { antdTheme } from '../styles/theme'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <Provider store={store}>
      <ConfigProvider theme={antdTheme}>
        <AntdApp>
          <BrowserRouter>{children}</BrowserRouter>
        </AntdApp>
      </ConfigProvider>
    </Provider>
  )
}
