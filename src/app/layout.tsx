import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/theme-provider'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Palin & Martins Comercial',
  description: 'Sistema de Controle Restrito — Palin & Martins',
  openGraph: {
    title: 'Palin & Martins Comercial',
    description: 'Sistema de Controle Restrito — Palin & Martins',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head />

      <body className={inter.variable} suppressHydrationWarning>
        <ThemeProvider>
          {children}
          <Toaster position="top-right" theme="dark" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  )
}
