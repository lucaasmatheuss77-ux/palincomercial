import { ReactNode } from 'react'
import { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Pocket CRM | Palin & Martins',
  description: 'Versão mobile integrada do hub comercial',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function MobileLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mobile-environment min-h-screen bg-brand-darker overflow-x-hidden">
      {children}
    </div>
  )
}
