'use client'

import { useMemo, useState } from 'react'
import { Building2 } from 'lucide-react'

export type ClienteOption = {
  id: string
  nome: string
  company_name?: string | null
  documento?: string | null
  email?: string | null
  phone?: string | null
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

export function ClientSearchField({
  clientes,
  selected,
  onSelect,
  onClear,
  onQueryChange,
  initialQuery = '',
  placeholder = 'Buscar cliente cadastrado',
}: {
  clientes: ClienteOption[]
  selected: ClienteOption | null
  onSelect: (cliente: ClienteOption) => void
  onClear: () => void
  /** Chamado a cada tecla digitada. Use quando o campo aceitar texto livre alem de um cliente cadastrado. */
  onQueryChange?: (value: string) => void
  initialQuery?: string
  placeholder?: string
}) {
  const [query, setQuery] = useState(initialQuery)
  const [open, setOpen] = useState(false)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || selected) return []
    const qDigits = onlyDigits(q)
    return clientes
      .filter((cliente) => {
        const haystack = [cliente.nome, cliente.company_name, cliente.email, cliente.phone]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        const matchesText = haystack.includes(q)
        const matchesDocumento = qDigits.length >= 3 && onlyDigits(cliente.documento || '').includes(qDigits)
        return matchesText || matchesDocumento
      })
      .slice(0, 8)
  }, [clientes, query, selected])

  return (
    <div className="client-search-field">
      {selected ? (
        <div className="client-search-locked">
          <span className="client-search-locked-info">
            <Building2 size={16} aria-hidden="true" />
            <strong>{selected.nome}</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              onClear()
              setQuery('')
            }}
          >
            Trocar
          </button>
        </div>
      ) : (
        <div className="client-search-input">
          <Building2 size={16} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setOpen(true)
              onQueryChange?.(event.target.value)
            }}
            onFocus={() => setOpen(true)}
            autoComplete="off"
            placeholder={placeholder}
          />
        </div>
      )}
      {open && !selected && query.trim() && (
        <div className="client-search-results">
          {results.length > 0 ? (
            results.map((cliente) => (
              <button
                type="button"
                key={cliente.id}
                onMouseDown={() => {
                  onSelect(cliente)
                  setOpen(false)
                }}
              >
                <strong>{cliente.nome}</strong>
                <small>{[cliente.company_name, cliente.documento].filter(Boolean).join(' · ') || 'Sem dados adicionais'}</small>
              </button>
            ))
          ) : (
            <div className="client-search-empty">Nenhum cliente cadastrado encontrado. Cadastre em Clientes.</div>
          )}
        </div>
      )}
    </div>
  )
}
