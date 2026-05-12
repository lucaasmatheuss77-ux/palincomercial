'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

type ThemeContextType = {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme] = useState<Theme>('dark')

  useEffect(() => {
    // Force dark mode
    document.documentElement.classList.remove('light')
    localStorage.removeItem('theme')
  }, [])

  const setTheme = () => {
    // No-op: only dark mode allowed
  }

  const toggleTheme = () => {
    // No-op: only dark mode allowed
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
