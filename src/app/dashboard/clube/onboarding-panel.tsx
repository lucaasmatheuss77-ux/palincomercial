'use client'

import { useState, useTransition } from 'react'
import { Check, ChevronDown, ChevronUp, Plus, Trash2, Target, BookOpen, X } from 'lucide-react'
import { toast } from 'sonner'
import ActionDialog from '@/components/action-dialog'
import {
  toggleOnboardingStep,
  saveOnboardingSession,
  deleteOnboardingSession,
  upsertOnboardingGoal,
  deleteOnboardingGoal,
} from '@/app/actions/clube-onboarding'
import type { MemberOnboarding, OnboardingSession, OnboardingGoal } from '@/app/actions/clube-onboarding'
import type { ClubMember } from '@/app/actions/clube'

// ─── Progress Ring ─────────────────────────────────────────────────────────────
function ProgressRing({ pct, size = 56 }: { pct: number; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const fill = (pct / 100) * circ
  const color = pct === 100 ? '#10b981' : pct >= 50 ? '#0ea5e9' : '#f59e0b'
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth={7} fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        stroke={color} strokeWidth={7} fill="none"
        strokeDasharray={`${fill} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.5s ease' }}
      />
      <text
        x={size / 2} y={size / 2}
        textAnchor="middle" dominantBaseline="middle"
        style={{ transform: 'rotate(90deg)', transformOrigin: `${size / 2}px ${size / 2}px`, fontSize: '11px', fontWeight: 800, fill: color }}
      >
        {pct}%
      </text>
    </svg>
  )
}

// ─── Step item ─────────────────────────────────────────────────────────────────
function StepItem({
  step, memberId, onUpdate
}: {
  step: MemberOnboarding['steps'][number]
  memberId: string
  onUpdate: (memberId: string, updated: Partial<MemberOnboarding>) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [expanded, setExpanded] = useState(false)
  const [notes, setNotes] = useState(step.notes ?? '')

  function handleToggle() {
    startTransition(async () => {
      const res = await toggleOnboardingStep(memberId, step.id, notes || null)
      if (res.success && res.data) {
        onUpdate(memberId, res.data)
        toast.success(res.data.steps.find(s => s.id === step.id)?.done ? 'Etapa concluída! ✅' : 'Etapa reaberta')
      } else {
        toast.error(res.error ?? 'Erro ao atualizar etapa')
      }
    })
  }

  return (
    <div style={{
      background: step.done ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.02)',
      border: `1px solid ${step.done ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)'}`,
      borderRadius: '12px', overflow: 'hidden', transition: 'all 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}>
        {/* Checkbox */}
        <button
          onClick={e => { e.stopPropagation(); handleToggle() }}
          disabled={isPending}
          style={{
            width: '26px', height: '26px', borderRadius: '8px', flexShrink: 0, cursor: 'pointer',
            border: step.done ? '2px solid #10b981' : '2px solid #475569',
            background: step.done ? '#10b981' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s', opacity: isPending ? 0.5 : 1,
          }}
        >
          {step.done && <Check size={14} color="#fff" />}
        </button>
        {/* Icon + label */}
        <span style={{ fontSize: '1.1rem' }}>{step.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: step.done ? '#64748b' : '#e2e8f0', textDecoration: step.done ? 'line-through' : 'none' }}>
            {step.label}
          </div>
          {step.done_at && (
            <div style={{ fontSize: '0.68rem', color: '#10b981', marginTop: '1px' }}>
              Concluído em {new Date(step.done_at).toLocaleDateString('pt-BR')}
            </div>
          )}
        </div>
        {expanded ? <ChevronUp size={14} color="#475569" /> : <ChevronDown size={14} color="#475569" />}
      </div>
      {expanded && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '10px 0 8px' }}>{step.description}</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={() => {
              if (notes !== (step.notes ?? '')) {
                startTransition(async () => {
                  await toggleOnboardingStep(memberId, step.id + '_notes_only', notes || null)
                })
              }
            }}
            placeholder="Anotações sobre esta etapa..."
            rows={2}
            className="input-field"
            style={{ fontSize: '0.78rem', resize: 'vertical' }}
          />
        </div>
      )}
    </div>
  )
}

// ─── Sessions panel ────────────────────────────────────────────────────────────
function SessionsPanel({ memberId, sessions, onUpdate }: {
  memberId: string
  sessions: OnboardingSession[]
  onUpdate: (memberId: string, updated: Partial<MemberOnboarding>) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ date: '', duration_min: '', agenda: '', summary: '', next_step: '', mentor_name: '' })

  function handleSave() {
    if (!form.date) { toast.error('Informe a data da sessão'); return }
    startTransition(async () => {
      const res = await saveOnboardingSession(memberId, {
        date: form.date,
        duration_min: form.duration_min ? Number(form.duration_min) : null,
        agenda: form.agenda || null,
        summary: form.summary || null,
        next_step: form.next_step || null,
        mentor_name: form.mentor_name || null,
      })
      if (res.success) {
        toast.success('Sessão registrada')
        setShowForm(false)
        setForm({ date: '', duration_min: '', agenda: '', summary: '', next_step: '', mentor_name: '' })
        onUpdate(memberId, {})
      } else {
        toast.error(res.error ?? 'Erro ao salvar sessão')
      }
    })
  }

  function handleDelete(sessionId: string) {
    startTransition(async () => {
      const res = await deleteOnboardingSession(memberId, sessionId)
      if (res.success) { toast.success('Sessão removida'); onUpdate(memberId, {}) }
      else toast.error(res.error ?? 'Erro ao remover sessão')
    })
  }

  const inputStyle = 'input-field'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0ea5e9', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <BookOpen size={14} /> Sessões de mentoria ({sessions.length})
        </span>
        <button className="btn-ghost" style={{ fontSize: '0.75rem', padding: '4px 10px' }} onClick={() => setShowForm(true)}>
          <Plus size={12} /> Nova sessão
        </button>
      </div>

      {sessions.length === 0 && !showForm && (
        <p style={{ color: '#475569', fontSize: '0.78rem', textAlign: 'center', padding: '16px' }}>
          Nenhuma sessão registrada ainda.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {sessions.map(s => (
          <div key={s.id} style={{ background: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.15)', borderRadius: '10px', padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#e2e8f0' }}>
                  {new Date(s.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {s.duration_min && <span style={{ color: '#64748b', fontWeight: 400, marginLeft: '8px' }}> · {s.duration_min} min</span>}
                  {s.mentor_name && <span style={{ color: '#64748b', fontWeight: 400, marginLeft: '8px' }}> · {s.mentor_name}</span>}
                </div>
                {s.agenda && <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}><strong style={{ color: '#64748b' }}>Pauta:</strong> {s.agenda}</div>}
                {s.summary && <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}><strong style={{ color: '#64748b' }}>Resumo:</strong> {s.summary}</div>}
                {s.next_step && <div style={{ fontSize: '0.72rem', color: '#0ea5e9', marginTop: '4px' }}>→ {s.next_step}</div>}
              </div>
              <button onClick={() => handleDelete(s.id)} disabled={isPending}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', opacity: 0.5 }}>
                <Trash2 size={13} color="#ef4444" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ActionDialog open={showForm} title="Nova sessão de mentoria" subtitle="Registre os detalhes desta sessão."
        onClose={() => setShowForm(false)}
        footer={<>
          <button className="btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={isPending || !form.date}>Salvar</button>
        </>}
      >
        <div style={{ display: 'grid', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.78rem', fontWeight: 700, color: '#c9d1d9' }}>Data *</label>
              <input type="date" className={inputStyle} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.78rem', fontWeight: 700, color: '#c9d1d9' }}>Duração (min)</label>
              <input type="number" className={inputStyle} placeholder="60" value={form.duration_min} onChange={e => setForm(f => ({ ...f, duration_min: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.78rem', fontWeight: 700, color: '#c9d1d9' }}>Mentor</label>
            <input className={inputStyle} placeholder="Nome do mentor" value={form.mentor_name} onChange={e => setForm(f => ({ ...f, mentor_name: e.target.value }))} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.78rem', fontWeight: 700, color: '#c9d1d9' }}>Pauta</label>
            <textarea className={inputStyle} rows={2} placeholder="Tópicos discutidos..." value={form.agenda} onChange={e => setForm(f => ({ ...f, agenda: e.target.value }))} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.78rem', fontWeight: 700, color: '#c9d1d9' }}>Resumo / Resultado</label>
            <textarea className={inputStyle} rows={2} placeholder="O que foi decidido e alcançado..." value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.78rem', fontWeight: 700, color: '#c9d1d9' }}>Próximo passo</label>
            <input className={inputStyle} placeholder="O que fazer até a próxima sessão?" value={form.next_step} onChange={e => setForm(f => ({ ...f, next_step: e.target.value }))} />
          </div>
        </div>
      </ActionDialog>
    </div>
  )
}

// ─── Goals panel ───────────────────────────────────────────────────────────────
function GoalsPanel({ memberId, goals, onUpdate }: {
  memberId: string
  goals: OnboardingGoal[]
  onUpdate: (memberId: string, updated: Partial<MemberOnboarding>) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ goal: '', result: '', due_date: '', achieved: false })

  function handleSave() {
    if (!form.goal) { toast.error('Informe a meta'); return }
    startTransition(async () => {
      const res = await upsertOnboardingGoal(memberId, { goal: form.goal, result: form.result || null, due_date: form.due_date || null, achieved: form.achieved })
      if (res.success) {
        toast.success('Meta salva')
        setShowForm(false)
        setForm({ goal: '', result: '', due_date: '', achieved: false })
        onUpdate(memberId, {})
      } else toast.error(res.error ?? 'Erro ao salvar meta')
    })
  }

  function handleDelete(goalId: string) {
    startTransition(async () => {
      const res = await deleteOnboardingGoal(memberId, goalId)
      if (res.success) { toast.success('Meta removida'); onUpdate(memberId, {}) }
    })
  }

  function handleToggleAchieved(goal: OnboardingGoal) {
    startTransition(async () => {
      await upsertOnboardingGoal(memberId, { ...goal, achieved: !goal.achieved })
      onUpdate(memberId, {})
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Target size={14} /> Metas ({goals.filter(g => g.achieved).length}/{goals.length} alcançadas)
        </span>
        <button className="btn-ghost" style={{ fontSize: '0.75rem', padding: '4px 10px' }} onClick={() => setShowForm(true)}>
          <Plus size={12} /> Nova meta
        </button>
      </div>

      {goals.length === 0 && (
        <p style={{ color: '#475569', fontSize: '0.78rem', textAlign: 'center', padding: '16px' }}>
          Nenhuma meta definida.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {goals.map(g => (
          <div key={g.id} style={{ background: g.achieved ? 'rgba(16,185,129,0.05)' : 'rgba(245,158,11,0.05)', border: `1px solid ${g.achieved ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.15)'}`, borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <button onClick={() => handleToggleAchieved(g)} disabled={isPending}
              style={{ width: '22px', height: '22px', borderRadius: '6px', border: g.achieved ? '2px solid #10b981' : '2px solid #f59e0b', background: g.achieved ? '#10b981' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
              {g.achieved && <Check size={12} color="#fff" />}
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: g.achieved ? '#64748b' : '#e2e8f0', textDecoration: g.achieved ? 'line-through' : 'none' }}>
                {g.goal}
              </div>
              {g.result && <div style={{ fontSize: '0.72rem', color: '#10b981', marginTop: '3px' }}>✓ {g.result}</div>}
              {g.due_date && <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>Prazo: {new Date(g.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}</div>}
            </div>
            <button onClick={() => handleDelete(g.id)} disabled={isPending}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', opacity: 0.5 }}>
              <Trash2 size={12} color="#ef4444" />
            </button>
          </div>
        ))}
      </div>

      <ActionDialog open={showForm} title="Nova meta" subtitle="Defina o objetivo e prazo." onClose={() => setShowForm(false)}
        footer={<>
          <button className="btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={isPending || !form.goal}>Salvar</button>
        </>}
      >
        <div style={{ display: 'grid', gap: '10px' }}>
          <input className="input-field" placeholder="Qual é a meta? *" value={form.goal} onChange={e => setForm(f => ({ ...f, goal: e.target.value }))} />
          <input type="date" className="input-field" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
          <textarea className="input-field" rows={2} placeholder="Resultado alcançado (preencher quando concluída)" value={form.result} onChange={e => setForm(f => ({ ...f, result: e.target.value }))} />
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#c9d1d9', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.achieved} onChange={e => setForm(f => ({ ...f, achieved: e.target.checked }))} />
            Meta já alcançada
          </label>
        </div>
      </ActionDialog>
    </div>
  )
}

// ─── Main Onboarding Panel ─────────────────────────────────────────────────────
export default function OnboardingPanel({
  member,
  onboarding: initialOnboarding,
  onClose,
}: {
  member: ClubMember
  onboarding: MemberOnboarding
  onClose: () => void
}) {
  const [onboarding, setOnboarding] = useState(initialOnboarding)
  const [activeTab, setActiveTab] = useState<'jornada' | 'sessoes' | 'metas'>('jornada')

  function handleUpdate(_memberId: string, updated: Partial<MemberOnboarding>) {
    setOnboarding(prev => ({ ...prev, ...updated }))
    // Refresh full data from server
    setTimeout(() => window.location.reload(), 800)
  }

  const clientName = member.client?.name || 'Mentorado'
  const progress = onboarding.progress_pct
  const completedSteps = onboarding.steps.filter(s => s.done).length
  const totalSteps = onboarding.steps.length

  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    padding: '7px 16px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
    border: 'none', transition: 'all 0.15s',
    background: active ? 'rgba(14,165,233,0.15)' : 'transparent',
    color: active ? '#0ea5e9' : '#64748b',
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
      <div style={{ width: '100%', maxWidth: '520px', height: '100dvh', background: '#0f1117', borderLeft: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'sticky', top: 0, background: '#0f1117', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                Onboarding do Mentorado
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#f8fafc' }}>{clientName}</div>
              {member.client?.company_name && (
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{member.client.company_name}</div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <ProgressRing pct={progress} />
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                <X size={20} color="#64748b" />
              </button>
            </div>
          </div>

          {/* Progress summary */}
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ flex: 1, height: '4px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: progress === 100 ? '#10b981' : '#0ea5e9', borderRadius: '4px', transition: 'width 0.5s ease' }} />
            </div>
            <span style={{ fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap' }}>
              {completedSteps}/{totalSteps} etapas · {onboarding.sessions.length} sessões · {onboarding.goals.filter(g => g.achieved).length}/{onboarding.goals.length} metas
            </span>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px', marginTop: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '3px' }}>
            {(['jornada', 'sessoes', 'metas'] as const).map(tab => (
              <button key={tab} style={TAB_STYLE(activeTab === tab)} onClick={() => setActiveTab(tab)}>
                {tab === 'jornada' ? '🗺️ Jornada' : tab === 'sessoes' ? '🎯 Sessões' : '⭐ Metas'}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {activeTab === 'jornada' && (
            <>
              {onboarding.completed_at && (
                <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.2rem' }}>🎉</span>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#10b981' }}>Onboarding Concluído!</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{new Date(onboarding.completed_at).toLocaleDateString('pt-BR')}</div>
                  </div>
                </div>
              )}
              {onboarding.steps.map(step => (
                <StepItem key={step.id} step={step} memberId={member.id} onUpdate={handleUpdate} />
              ))}
            </>
          )}

          {activeTab === 'sessoes' && (
            <SessionsPanel memberId={member.id} sessions={onboarding.sessions} onUpdate={handleUpdate} />
          )}

          {activeTab === 'metas' && (
            <GoalsPanel memberId={member.id} goals={onboarding.goals} onUpdate={handleUpdate} />
          )}
        </div>
      </div>
    </div>
  )
}
