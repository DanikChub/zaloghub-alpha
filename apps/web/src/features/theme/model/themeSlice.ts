import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { AppThemeName } from '../../../app/styles/theme-presets'

const storageKey = 'zaloghub-theme'

function getInitialTheme(): AppThemeName {
  try {
    const value = localStorage.getItem(storageKey)
    if (value === 'light' || value === 'dark' || value === 'brand') return value
  } catch {
    return 'light'
  }
  return 'light'
}

const themeSlice = createSlice({
  name: 'theme',
  initialState: { name: getInitialTheme() },
  reducers: {
    setTheme(state, action: PayloadAction<AppThemeName>) {
      state.name = action.payload
    },
  },
  selectors: {
    selectTheme: (state) => state.name,
  },
})

export const { setTheme } = themeSlice.actions
export const { selectTheme } = themeSlice.selectors
export const themeReducer = themeSlice.reducer
export { storageKey as themeStorageKey }
