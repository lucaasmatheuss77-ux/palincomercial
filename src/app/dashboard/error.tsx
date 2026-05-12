'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { RefreshCcw, TriangleAlert } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Erro na area do dashboard:', error)
  }, [error])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        background: 'radial-gradient(circle at top, rgba(251,191,36,0.08), transparent 24%), #05070b',
        color: '#e2e8f0',
      }}
    >
      <div
        style={{
          width: 'min(100%, 640px)',
          borderRadius: '24px',
          border: '1px solid rgba(148,163,184,0.16)',
          background: 'rgba(15,23,42,0.92)',
          padding: '28px',
          boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
          <TriangleAlert size={24} color="var(--brand-primary)" />
          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#f8fafc' }}>O dashboard encontrou um erro</div>
        </div>
        <p style={{ color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
          A pagina principal falhou ao carregar os dados. A interface abaixo permite tentar novamente sem travar o navegador.
        </p>
        <pre
          style={{
            marginTop: '16px',
            padding: '14px',
            borderRadius: '14px',
            background: 'rgba(2,6,23,0.8)',
            color: '#cbd5e1',
            overflowX: 'auto',
            fontSize: '0.82rem',
            lineHeight: 1.5,
          }}
        >
          {error.message}
        </pre>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '18px' }}>
          <button type="button" onClick={reset} className="btn-primary">
            <RefreshCcw size={16} />
            Tentar novamente
          </button>
          <Link href="/dashboard/clientes" className="btn-ghost" style={{ textDecoration: 'none' }}>
            Ver clientes
          </Link>
        </div>
      </div>
    </div>
  )
}
