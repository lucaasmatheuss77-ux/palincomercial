import type { Metadata } from 'next'
import { Inter, Fira_Code, Space_Grotesk } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/theme-provider'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const firaCode = Fira_Code({
  subsets: ['latin'],
  variable: '--font-fira-code',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  weight: ['300', '400', '500', '600', '700'],
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

      <body className={`${inter.className} ${inter.variable} ${firaCode.variable} ${spaceGrotesk.variable}`} suppressHydrationWarning>
        <ThemeProvider>
          {children}
          <Toaster position="top-right" theme="dark" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  )
}
// SEO Helper: og: name="description" <title>
