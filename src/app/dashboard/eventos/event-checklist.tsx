'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, Circle, Plus, Trash2, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { createChecklistItem, toggleChecklistItem, deleteChecklistItem } from '@/app/actions/eventos'
import type { ChecklistItem } from '@/lib/types'

interface EventChecklistProps {
  eventId: string
  initialItems: ChecklistItem[]
  profiles?: { id: string; full_name: string | null }[]
  compact?: boolean
}

export default function EventChecklist({ eventId, initialItems, profiles, compact }: EventChecklistProps) {
  const [items, setItems] = useState<ChecklistItem[]>(initialItems)
  const [isPending, startTransition] = useTransition()
  const [newTitle, setNewTitle] = useState('')
  const [newDueAt, setNewDueAt] = useState('')
  const [newAssignee, setNewAssignee] = useState('')
  const [showForm, setShowForm] = useState(false)

  const doneCount = items.filter(i => i.done).length
  const totalCount = items.length
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  function handleAdd() {
    if (!newTitle.trim()) { toast.error('Informe o titulo do item.'); return }
    const assigneeName = profiles?.find(p => p.id === newAssignee)?.full_name || null

    startTransition(async () => {
      const result = await createChecklistItem({
        event_id: eventId,
        title: newTitle.trim(),
        due_at: newDueAt || null,
        assigned_to: newAssignee || null,
        assigned_name: assigneeName,
      })
      if (result.success) {
        setItems(prev => [...prev, {
          id: `temp-${Date.now()}`,
          event_id: eventId,
          title: newTitle.trim(),
          done: false,
          due_at: newDueAt || null,
          assigned_to: newAssignee || null,
          assigned_name: assigneeName,
          created_at: new Date().toISOString(),
        }])
        setNewTitle('')
        setNewDueAt('')
        setNewAssignee('')
        setShowForm(false)
        toast.success('Item adicionado ao checklist.')
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleToggle(itemId: string, done: boolean) {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, done } : i))
    startTransition(async () => {
      const result = await toggleChecklistItem(itemId, done)
      if (!result.success) {
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, done: !done } : i))
        toast.error('Erro ao atualizar item.')
      }
    })
  }

  function handleDelete(itemId: string) {
    if (!confirm('Remover este item do checklist?')) return
    setItems(prev => prev.filter(i => i.id !== itemId))
    startTransition(async () => {
      await deleteChecklistItem(itemId)
      toast.success('Item removido.')
    })
  }

  const isOverdue = (dueAt: string | null) => {
    if (!dueAt) return false
    return new Date(dueAt) < new Date()
  }

  return (
    <div className="glass-card" style={{ padding: compact ? '16px 18px' : '20px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h3 style={{ fontSize: compact ? '0.9rem' : '1rem', fontWeight: 800, color: 'var(--brand-text)', margin: 0 }}>
            Checklist Pre-Evento
          </h3>
          <span style={{
            padding: '2px 8px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 800,
            background: progress === 100 ? 'rgba(34,197,94,0.1)' : 'rgba(96,165,250,0.1)',
            color: progress === 100 ? '#86efac' : '#93c5fd',
          }}>
            {doneCount}/{totalCount}
          </span>
        </div>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setShowForm(!showForm)}
          style={{ padding: '5px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <Plus size={13} /> Adicionar
        </button>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div style={{ marginBottom: '14px' }}>
          <div className="progress-bar" style={{ height: '6px' }}>
            <div
              className="progress-fill"
              style={{
                width: `${progress}%`,
                background: progress === 100 ? '#10b981' : '#60a5fa',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div style={{
          padding: '12px 14px', borderRadius: '10px', marginBottom: '12px',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          display: 'grid', gap: '10px',
        }}>
          <input
            className="input-field"
            placeholder="Ex: Reservar hotel para equipe"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            style={{ fontSize: '0.85rem' }}
            autoFocus
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <input
              type="datetime-local"
              className="input-field"
              value={newDueAt}
              onChange={e => setNewDueAt(e.target.value)}
              style={{ fontSize: '0.8rem' }}
              title="Prazo"
            />
            {profiles && profiles.length > 0 && (
              <select
                className="input-field"
                value={newAssignee}
                onChange={e => setNewAssignee(e.target.value)}
                style={{ fontSize: '0.8rem' }}
              >
                <option value="">Responsavel</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)} style={{ fontSize: '0.78rem', padding: '5px 12px' }}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={handleAdd} disabled={isPending} style={{ fontSize: '0.78rem', padding: '5px 12px' }}>
              {isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {/* Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {items.length === 0 ? (
          <div style={{
            padding: '20px', textAlign: 'center', borderRadius: '10px',
            border: '1px dashed rgba(255,255,255,0.06)', color: '#334155', fontSize: '0.83rem',
          }}>
            Nenhum item no checklist. Adicione tarefas de preparacao.
          </div>
        ) : items.map(item => {
          const overdue = !item.done && isOverdue(item.due_at)
          return (
            <div
              key={item.id}
              style={{
                display: 'flex', gap: '10px', alignItems: 'center',
                padding: '8px 12px', borderRadius: '8px',
                background: item.done ? 'rgba(34,197,94,0.03)' : overdue ? 'rgba(248,113,113,0.04)' : 'rgba(255,255,255,0.015)',
                border: `1px solid ${overdue ? 'rgba(248,113,113,0.12)' : 'rgba(255,255,255,0.04)'}`,
                transition: 'all 0.15s',
              }}
            >
              <button
                type="button"
                onClick={() => handleToggle(item.id, !item.done)}
                style={{
                  color: item.done ? '#22c55e' : '#334155', background: 'none', border: 'none',
                  cursor: 'pointer', padding: 0, flexShrink: 0, display: 'flex',
                }}
                aria-label={item.done ? 'Desmarcar' : 'Concluir'}
              >
                {item.done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  fontSize: '0.84rem', fontWeight: 600,
                  color: item.done ? '#334155' : '#cbd5e1',
                  textDecoration: item.done ? 'line-through' : 'none',
                }}>
                  {item.title}
                </span>
                <div style={{ display: 'flex', gap: '10px', marginTop: '2px', fontSize: '0.7rem', color: overdue ? '#f87171' : '#475569' }}>
                  {item.due_at && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <Clock size={10} />
                      {new Date(item.due_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </span>
                  )}
                  {item.assigned_name && (
                    <span>{item.assigned_name.split(' ')[0]}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(item.id)}
                style={{
                  color: '#475569', background: 'none', border: 'none',
                  cursor: 'pointer', padding: '2px', flexShrink: 0, display: 'flex',
                  opacity: 0.5, transition: 'opacity 0.15s',
                }}
                title="Remover item"
                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#ef4444' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.color = '#475569' }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
