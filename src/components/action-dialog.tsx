'use client'

import type { CSSProperties, ReactNode } from 'react'
import { X } from 'lucide-react'

type ActionDialogProps = {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: CSSProperties['maxWidth']
}

export default function ActionDialog({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = '680px',
}: ActionDialogProps) {
  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(1, 4, 9, 0.8)',
        backdropFilter: 'blur(10px)',
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="glass-card"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: width,
          maxHeight: 'calc(100vh - 48px)',
          display: 'flex',
          flexDirection: 'column',
          padding: '28px',
          border: '1px solid rgba(251, 191, 36, 0.18)',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.45)',
        }}
      >
        {/* Header - Fixed */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
            marginBottom: '20px',
            flexShrink: 0,
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--brand-text)' }}>{title}</h2>
            {subtitle ? (
              <p style={{ color: 'var(--brand-muted)', fontSize: '0.85rem', marginTop: '6px' }}>{subtitle}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="dialog-close-button"
            style={{ 
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '8px', 
              color: 'var(--brand-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              outline: 'none'
            }}
            aria-label="Fechar"
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'
              e.currentTarget.style.color = '#ef4444'
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
              e.currentTarget.style.color = 'var(--brand-muted)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px', minHeight: 0 }}>
          {children}
        </div>

        {/* Footer - Fixed */}
        {footer ? (
          <div
            style={{
              marginTop: '20px',
              paddingTop: '20px',
              borderTop: '1px solid var(--brand-border)',
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
              flexWrap: 'wrap',
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        ) : null}

      </div>
    </div>
  )
}
