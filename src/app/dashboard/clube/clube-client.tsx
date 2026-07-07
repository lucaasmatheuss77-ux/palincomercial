'use client'

import { useState, useTransition, useMemo } from 'react'
import type { ComponentType, CSSProperties } from 'react'
import { CalendarDays, Users, AlertTriangle, ChevronRight, Check, Clock, Star, Gem, MapPin, X, Plus, Trash2, Target, BookOpen, Route } from 'lucide-react'
import InsiderLogo from '@/components/insider-logo'
import { toast } from 'sonner'
import ActionDialog from '@/components/action-dialog'
import { updateClubMember, upsertDeliverable, toggleDeliverableDone } from '@/app/actions/clube'
import type { ClubMember, ClubDeliverable } from '@/app/actions/clube'
import {
  toggleOnboardingStep,
  saveOnboardingSession,
  deleteOnboardingSession,
  upsertOnboardingGoal,
  deleteOnboardingGoal,
} from '@/app/actions/clube-onboarding'
import type { MemberOnboarding, OnboardingStep, OnboardingSession, OnboardingGoal } from '@/app/actions/clube-onboarding'

type Profile = { id: string; full_name: string; avatar_url: string | null; role: string }
type EventRow = { id: string; name: string; date: string; location?: string | null; status?: string | null; type?: string | null; ends_at?: string | null }
type MemberStatus = ClubMember['status']
type MemberTier = ClubMember['tier']
type DeliverableCategory = ClubDeliverable['category']
type TierIcon = ComponentType<{ size?: number; className?: string; color?: string; style?: CSSProperties }>

const TIER_CONFIG: Record<string, { label: string; color: string; icon: TierIcon }> = {
  standard: { label: 'Standard', color: '#94a3b8', icon: InsiderLogo },
  plus: { label: 'Plus', color: '#60a5fa', icon: Star },
  vip: { label: 'VIP', color: '#f59e0b', icon: Gem },
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  ativo: { label: 'Ativo', bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  em_renovacao: { label: 'Em renovação', bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  inativo: { label: 'Inativo', bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
}

const CAT_COLORS: Record<string, string> = { mentoria: '#0ea5e9', conteudo: '#3b82f6', material: '#10b981', evento: '#f59e0b' }

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtEvt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

// ─── Onboarding Drawer ──────────────────────────────────────────────────────

function OnboardingDrawer({
  member,
  onboarding: initialOnboarding,
  onClose,
}: {
  member: ClubMember
  onboarding: MemberOnboarding
  onClose: () => void
}) {
  const [onboarding, setOnboarding] = useState(initialOnboarding)
  const [activeTab, setActiveTab] = useState<'journey' | 'sessions' | 'goals'>('journey')
  const [isPending, startTransition] = useTransition()

  // Session form
  const [showSessionForm, setShowSessionForm] = useState(false)
  const [sessionForm, setSessionForm] = useState({ date: '', duration_min: '', agenda: '', summary: '', next_step: '', mentor_name: '' })

  // Goal form
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [goalForm, setGoalForm] = useState({ goal: '', result: '', achieved: false, due_date: '' })

  const clientName = member.client?.name || 'Membro'
  const tierCfg = TIER_CONFIG[member.tier] || TIER_CONFIG.standard

  function handleToggleStep(step: OnboardingStep) {
    startTransition(async () => {
      const res = await toggleOnboardingStep(member.id, step.id)
      if (res.success && res.data) {
        setOnboarding(res.data)
        toast.success(res.data.steps.find(s => s.id === step.id)?.done ? 'Etapa concluída! ✅' : 'Etapa reaberta')
      } else {
        toast.error(res.error || 'Erro ao atualizar etapa')
      }
    })
  }

  function handleSaveSession() {
    if (!sessionForm.date) { toast.error('Informe a data da sessão'); return }
    startTransition(async () => {
      const res = await saveOnboardingSession(member.id, {
        date: sessionForm.date,
        duration_min: sessionForm.duration_min ? Number(sessionForm.duration_min) : null,
        agenda: sessionForm.agenda || null,
        summary: sessionForm.summary || null,
        next_step: sessionForm.next_step || null,
        mentor_name: sessionForm.mentor_name || null,
      })
      if (res.success) {
        // Re-fetch via parent or reload
        toast.success('Sessão registrada!')
        setShowSessionForm(false)
        setSessionForm({ date: '', duration_min: '', agenda: '', summary: '', next_step: '', mentor_name: '' })
        window.location.reload()
      } else {
        toast.error(res.error || 'Erro ao salvar sessão')
      }
    })
  }

  function handleDeleteSession(sessionId: string) {
    startTransition(async () => {
      const res = await deleteOnboardingSession(member.id, sessionId)
      if (res.success) {
        setOnboarding(prev => ({ ...prev, sessions: prev.sessions.filter(s => s.id !== sessionId) }))
        toast.success('Sessão removida')
      } else {
        toast.error(res.error || 'Erro ao remover sessão')
      }
    })
  }

  function handleSaveGoal() {
    if (!goalForm.goal.trim()) { toast.error('Informe a meta'); return }
    startTransition(async () => {
      const res = await upsertOnboardingGoal(member.id, {
        goal: goalForm.goal,
        result: goalForm.result || null,
        achieved: goalForm.achieved,
        due_date: goalForm.due_date || null,
      })
      if (res.success) {
        toast.success('Meta salva!')
        setShowGoalForm(false)
        setGoalForm({ goal: '', result: '', achieved: false, due_date: '' })
        window.location.reload()
      } else {
        toast.error(res.error || 'Erro ao salvar meta')
      }
    })
  }

  function handleDeleteGoal(goalId: string) {
    startTransition(async () => {
      const res = await deleteOnboardingGoal(member.id, goalId)
      if (res.success) {
        setOnboarding(prev => ({ ...prev, goals: prev.goals.filter(g => g.id !== goalId) }))
        toast.success('Meta removida')
      } else {
        toast.error(res.error || 'Erro ao remover meta')
      }
    })
  }

  const tabStyle = (tab: string): CSSProperties => ({
    padding: '8px 16px',
    borderRadius: '8px',
    fontWeight: 700,
    fontSize: '0.78rem',
    cursor: 'pointer',
    border: 'none',
    background: activeTab === tab ? 'rgba(14,165,233,0.2)' : 'transparent',
    color: activeTab === tab ? '#0ea5e9' : '#64748b',
    transition: 'all 0.15s',
  })

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50,
          animation: 'fadeIn 0.2s ease',
        }}
      />
      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(540px, 100vw)',
        background: '#0d1117', borderLeft: '1px solid rgba(255,255,255,0.08)',
        zIndex: 51, overflowY: 'auto', display: 'flex', flexDirection: 'column',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
        animation: 'slideInRight 0.25s ease',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: '14px', position: 'sticky', top: 0,
          background: '#0d1117', zIndex: 1,
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0,
            background: `${tierCfg.color}20`, border: `2px solid ${tierCfg.color}50`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.9rem', fontWeight: 900, color: tierCfg.color,
          }}>
            {initials(clientName)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: '1rem', color: '#f8fafc' }}>{clientName}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
              {member.client?.company_name || 'Onboarding da mentoria'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', color: '#64748b', borderRadius: '8px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8' }}>Progresso do onboarding</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 900, color: onboarding.progress_pct === 100 ? '#10b981' : '#0ea5e9' }}>
              {onboarding.progress_pct}%
            </span>
          </div>
          <div style={{ height: '6px', borderRadius: '99px', background: 'rgba(255,255,255,0.06)' }}>
            <div style={{
              height: '100%', borderRadius: '99px',
              width: `${onboarding.progress_pct}%`,
              background: onboarding.progress_pct === 100
                ? 'linear-gradient(90deg, #10b981, #34d399)'
                : 'linear-gradient(90deg, #0ea5e9, #38bdf8)',
              transition: 'width 0.5s ease',
            }} />
          </div>
          {onboarding.completed_at && (
            <div style={{ marginTop: '6px', fontSize: '0.72rem', color: '#10b981', fontWeight: 700 }}>
              ✅ Concluído em {fmtEvt(onboarding.completed_at)}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '6px' }}>
          <button style={tabStyle('journey')} onClick={() => setActiveTab('journey')}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Route size={13} /> Jornada</span>
          </button>
          <button style={tabStyle('sessions')} onClick={() => setActiveTab('sessions')}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><BookOpen size={13} /> Sessões ({onboarding.sessions.length})</span>
          </button>
          <button style={tabStyle('goals')} onClick={() => setActiveTab('goals')}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Target size={13} /> Metas ({onboarding.goals.length})</span>
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: '20px 24px' }}>

          {/* ── JOURNEY TAB ── */}
          {activeTab === 'journey' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {onboarding.steps.map((step, i) => (
                <div key={step.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '14px',
                  padding: '16px', borderRadius: '14px',
                  background: step.done ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)',
                  border: step.done ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,255,255,0.05)',
                  transition: 'all 0.2s',
                }}>
                  {/* Step number + connector */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <button
                      onClick={() => handleToggleStep(step)}
                      disabled={isPending}
                      style={{
                        width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                        background: step.done ? '#10b981' : 'rgba(255,255,255,0.04)',
                        border: step.done ? '2px solid #10b981' : '2px solid rgba(255,255,255,0.1)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s',
                        fontSize: '1rem',
                      }}
                    >
                      {step.done ? <Check size={16} color="#fff" /> : <span style={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 800 }}>{i + 1}</span>}
                    </button>
                    {i < onboarding.steps.length - 1 && (
                      <div style={{
                        width: '2px', height: '16px', marginTop: '4px',
                        background: step.done ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.06)',
                      }} />
                    )}
                  </div>
                  {/* Step info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1rem' }}>{step.icon}</span>
                      <span style={{ fontWeight: 800, fontSize: '0.88rem', color: step.done ? '#10b981' : '#e2e8f0' }}>
                        {step.label}
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '0.76rem', color: '#64748b', lineHeight: 1.5 }}>
                      {step.description}
                    </p>
                    {step.done_at && (
                      <div style={{ marginTop: '6px', fontSize: '0.68rem', color: '#10b981', fontWeight: 700 }}>
                        Concluído em {fmtEvt(step.done_at)}
                      </div>
                    )}
                    {step.notes && (
                      <div style={{ marginTop: '6px', fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>
                        📝 {step.notes}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── SESSIONS TAB ── */}
          {activeTab === 'sessions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={() => setShowSessionForm(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
                  borderRadius: '10px', border: '1px dashed rgba(14,165,233,0.3)',
                  background: 'rgba(14,165,233,0.05)', color: '#0ea5e9', fontWeight: 700,
                  fontSize: '0.82rem', cursor: 'pointer', width: '100%', justifyContent: 'center',
                }}
              >
                <Plus size={15} /> Registrar sessão
              </button>

              {showSessionForm && (
                <div style={{ padding: '16px', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: '4px' }}>Data *</label>
                      <input type="date" className="input-field" value={sessionForm.date} onChange={e => setSessionForm(f => ({ ...f, date: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: '4px' }}>Duração (min)</label>
                      <input type="number" className="input-field" placeholder="60" value={sessionForm.duration_min} onChange={e => setSessionForm(f => ({ ...f, duration_min: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: '4px' }}>Mentor</label>
                    <input type="text" className="input-field" placeholder="Nome do mentor" value={sessionForm.mentor_name} onChange={e => setSessionForm(f => ({ ...f, mentor_name: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: '4px' }}>Pauta</label>
                    <textarea className="input-field" rows={2} placeholder="O que foi discutido..." value={sessionForm.agenda} onChange={e => setSessionForm(f => ({ ...f, agenda: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: '4px' }}>Resumo / Resultado</label>
                    <textarea className="input-field" rows={2} placeholder="Decisões e aprendizados..." value={sessionForm.summary} onChange={e => setSessionForm(f => ({ ...f, summary: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: '4px' }}>Próximo passo</label>
                    <input type="text" className="input-field" placeholder="Ação definida para próxima sessão..." value={sessionForm.next_step} onChange={e => setSessionForm(f => ({ ...f, next_step: e.target.value }))} />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button className="btn-ghost" onClick={() => setShowSessionForm(false)}>Cancelar</button>
                    <button className="btn-primary" onClick={handleSaveSession} disabled={isPending}>Salvar sessão</button>
                  </div>
                </div>
              )}

              {onboarding.sessions.length === 0 && !showSessionForm && (
                <p style={{ textAlign: 'center', color: '#475569', fontSize: '0.82rem', padding: '30px 0' }}>
                  Nenhuma sessão registrada ainda.
                </p>
              )}

              {onboarding.sessions.map(session => (
                <div key={session.id} style={{
                  padding: '14px 16px', borderRadius: '12px',
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#e2e8f0' }}>
                        📅 {fmtEvt(session.date)}
                        {session.duration_min && <span style={{ fontWeight: 400, color: '#64748b', marginLeft: '8px' }}>{session.duration_min} min</span>}
                      </div>
                      {session.mentor_name && (
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>Mentor: {session.mentor_name}</div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteSession(session.id)}
                      disabled={isPending}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '4px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {session.agenda && (
                    <div style={{ marginTop: '8px', fontSize: '0.76rem', color: '#94a3b8' }}>
                      <span style={{ fontWeight: 700, color: '#64748b' }}>Pauta: </span>{session.agenda}
                    </div>
                  )}
                  {session.summary && (
                    <div style={{ marginTop: '4px', fontSize: '0.76rem', color: '#94a3b8' }}>
                      <span style={{ fontWeight: 700, color: '#64748b' }}>Resumo: </span>{session.summary}
                    </div>
                  )}
                  {session.next_step && (
                    <div style={{ marginTop: '8px', padding: '8px 10px', borderRadius: '8px', background: 'rgba(14,165,233,0.08)', fontSize: '0.74rem', color: '#0ea5e9', fontWeight: 600 }}>
                      ▶ Próximo: {session.next_step}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── GOALS TAB ── */}
          {activeTab === 'goals' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={() => setShowGoalForm(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
                  borderRadius: '10px', border: '1px dashed rgba(14,165,233,0.3)',
                  background: 'rgba(14,165,233,0.05)', color: '#0ea5e9', fontWeight: 700,
                  fontSize: '0.82rem', cursor: 'pointer', width: '100%', justifyContent: 'center',
                }}
              >
                <Plus size={15} /> Nova meta
              </button>

              {showGoalForm && (
                <div style={{ padding: '16px', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: '4px' }}>Meta *</label>
                    <textarea className="input-field" rows={2} placeholder="O que o mentorado quer alcançar..." value={goalForm.goal} onChange={e => setGoalForm(f => ({ ...f, goal: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: '4px' }}>Prazo</label>
                    <input type="date" className="input-field" value={goalForm.due_date} onChange={e => setGoalForm(f => ({ ...f, due_date: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: '4px' }}>Resultado alcançado</label>
                    <textarea className="input-field" rows={2} placeholder="Preencha quando concluída..." value={goalForm.result} onChange={e => setGoalForm(f => ({ ...f, result: e.target.value }))} />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', color: '#94a3b8' }}>
                    <input type="checkbox" checked={goalForm.achieved} onChange={e => setGoalForm(f => ({ ...f, achieved: e.target.checked }))} />
                    Meta alcançada
                  </label>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button className="btn-ghost" onClick={() => setShowGoalForm(false)}>Cancelar</button>
                    <button className="btn-primary" onClick={handleSaveGoal} disabled={isPending}>Salvar meta</button>
                  </div>
                </div>
              )}

              {onboarding.goals.length === 0 && !showGoalForm && (
                <p style={{ textAlign: 'center', color: '#475569', fontSize: '0.82rem', padding: '30px 0' }}>
                  Nenhuma meta definida ainda.
                </p>
              )}

              {onboarding.goals.map((goal: OnboardingGoal) => (
                <div key={goal.id} style={{
                  padding: '14px 16px', borderRadius: '12px',
                  background: goal.achieved ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)',
                  border: goal.achieved ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: '0.85rem', color: goal.achieved ? '#10b981' : '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {goal.achieved ? '✅' : '🎯'} {goal.goal}
                      </div>
                      {goal.due_date && (
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>Prazo: {fmt(goal.due_date)}</div>
                      )}
                      {goal.result && (
                        <div style={{ marginTop: '8px', fontSize: '0.76rem', color: '#94a3b8', padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)' }}>
                          <span style={{ fontWeight: 700, color: '#64748b' }}>Resultado: </span>{goal.result}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteGoal(goal.id)}
                      disabled={isPending}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '4px', flexShrink: 0 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ClubeClient({
  initialMembers, initialDeliverables, initialEvents, profiles,
  initialOnboardingMap = {},
}: {
  initialMembers: ClubMember[]
  initialDeliverables: ClubDeliverable[]
  initialEvents: EventRow[]
  profiles: Profile[]
  initialOnboardingMap?: Record<string, MemberOnboarding>
}) {
  const [members, setMembers] = useState(initialMembers)
  const [deliverables, setDeliverables] = useState(initialDeliverables)
  const [events] = useState(initialEvents)
  const [isPending, startTransition] = useTransition()

  // Modals
  const [editMember, setEditMember] = useState<ClubMember | null>(null)
  const [editForm, setEditForm] = useState({ status: 'ativo' as MemberStatus, tier: 'standard' as MemberTier, mentor_id: '', notes: '', contract_start: '', contract_end: '' })
  const [showDeliverable, setShowDeliverable] = useState(false)
  const [delivForm, setDelivForm] = useState({ title: '', description: '', category: 'mentoria' as DeliverableCategory, due_date: '', event_id: '' })

  // Onboarding drawer
  const [onboardingMember, setOnboardingMember] = useState<ClubMember | null>(null)

  // KPIs
  const activeCount = members.filter(m => m.status === 'ativo').length
  const renewalCount = members.filter(m => { const d = daysUntil(m.contract_end); return d !== null && d <= 30 && d >= 0 }).length
  const inactiveCount = members.filter(m => m.status === 'inativo').length

  // Upcoming events
  const upcomingEvents = useMemo(() => {
    const now = new Date()
    return events.filter(e => new Date(e.date) >= now).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 6)
  }, [events])

  const pastEvents = useMemo(() => {
    const now = new Date()
    return events.filter(e => new Date(e.date) < now).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 4)
  }, [events])

  function openEditMember(m: ClubMember) {
    setEditForm({
      status: m.status, tier: m.tier, mentor_id: m.mentor_id || '',
      notes: m.notes || '', contract_start: m.contract_start || '', contract_end: m.contract_end || ''
    })
    setEditMember(m)
  }

  function handleSaveMember() {
    if (!editMember) return
    startTransition(async () => {
      const res = await updateClubMember(editMember.id, {
        status: editForm.status, tier: editForm.tier,
        mentor_id: editForm.mentor_id || null, notes: editForm.notes || null,
        contract_start: editForm.contract_start || null, contract_end: editForm.contract_end || null,
      })
      if (res.success) {
        setMembers(prev => prev.map(m => m.id === editMember.id ? { ...m, ...editForm } : m))
        toast.success('Membro atualizado')
        setEditMember(null)
      } else toast.error(res.error)
    })
  }

  function handleSaveDeliverable() {
    startTransition(async () => {
      const res = await upsertDeliverable({
        title: delivForm.title, description: delivForm.description || null,
        category: delivForm.category, due_date: delivForm.due_date || null,
        is_global: true, event_id: delivForm.event_id || null,
      })
      if (res.success) {
        toast.success('Entrega criada')
        setShowDeliverable(false)
        setDelivForm({ title: '', description: '', category: 'mentoria', due_date: '', event_id: '' })
        window.location.reload()
      } else toast.error(res.error)
    })
  }

  function handleToggleDeliv(id: string, status: string) {
    startTransition(async () => {
      const res = await toggleDeliverableDone(id, status)
      if (res.success) {
        setDeliverables(prev => prev.map(d => d.id === id ? { ...d, status: status === 'concluido' ? 'pendente' : 'concluido' } : d))
      }
    })
  }

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '16px', padding: '20px',
  }
  const inputClass = 'input-field'

  return (
    <>
      <div className="animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <InsiderLogo size={32} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f8fafc', margin: 0 }}>Insider Club</h1>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>Controle de membros da mentoria</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-ghost" onClick={() => { setDelivForm({ title: '', description: '', category: 'mentoria', due_date: '', event_id: '' }); setShowDeliverable(true) }}>
              + Entrega
            </button>
          </div>
        </div>

        {/* RENEWAL ALERT */}
        {renewalCount > 0 && (
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '14px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle size={20} color="#f59e0b" />
            <span style={{ color: '#fbbf24', fontSize: '0.85rem', fontWeight: 700 }}>
              {renewalCount} contrato{renewalCount > 1 ? 's' : ''} vence{renewalCount > 1 ? 'm' : ''} nos próximos 30 dias
            </span>
          </div>
        )}

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
          {[
            { label: 'Total Membros', value: members.length, color: '#0ea5e9', icon: Users },
            { label: 'Ativos', value: activeCount, color: '#10b981', icon: Users },
            { label: 'Renovação', value: renewalCount, color: '#f59e0b', icon: Clock },
            { label: 'Inativos', value: inactiveCount, color: '#ef4444', icon: AlertTriangle },
          ].map(k => (
            <div key={k.label} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: `${k.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <k.icon size={20} color={k.color} />
              </div>
              <div>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#f8fafc' }}>{k.value}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>{k.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* MEMBERS TABLE */}
        <div style={cardStyle}>
          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#e2e8f0', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <InsiderLogo size={18} /> Membros do Clube
          </div>
          {members.length === 0 ? (
            <p style={{ color: '#475569', fontSize: '0.85rem', textAlign: 'center', padding: '30px' }}>
              Nenhum membro ainda. Cadastre um cliente com o produto <strong>Insider Club</strong> para adicioná-lo automaticamente.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {members.map(m => {
                const tierCfg = TIER_CONFIG[m.tier] || TIER_CONFIG.standard
                const statusCfg = STATUS_CONFIG[m.status] || STATUS_CONFIG.ativo
                const daysLeft = daysUntil(m.contract_end)
                const isUrgent = daysLeft !== null && daysLeft <= 30 && daysLeft >= 0
                const clientName = m.client?.name || 'Sem nome'
                const TierIcon = tierCfg.icon
                const onb = initialOnboardingMap[m.id]
                const progress = onb?.progress_pct ?? 0

                return (
                  <div key={m.id} style={{
                    ...cardStyle, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px',
                    border: isUrgent ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  }}>
                    {/* Avatar */}
                    <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: `${tierCfg.color}20`, border: `2px solid ${tierCfg.color}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.8rem', fontWeight: 900, color: tierCfg.color }}>
                      {initials(clientName)}
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#f8fafc' }}>{clientName}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '2px' }}>
                        {m.client?.company_name && <span>{m.client.company_name}</span>}
                        <span>Início: {fmt(m.contract_start)}</span>
                        <span style={{ color: isUrgent ? '#f59e0b' : undefined }}>Fim: {fmt(m.contract_end)}{daysLeft !== null && daysLeft <= 30 ? ` (${daysLeft}d)` : ''}</span>
                      </div>
                      {/* Mini progress bar */}
                      <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '3px', borderRadius: '99px', background: 'rgba(255,255,255,0.05)' }}>
                          <div style={{ height: '100%', borderRadius: '99px', width: `${progress}%`, background: progress === 100 ? '#10b981' : '#0ea5e9', transition: 'width 0.4s ease' }} />
                        </div>
                        <span style={{ fontSize: '0.65rem', color: progress === 100 ? '#10b981' : '#64748b', fontWeight: 700, flexShrink: 0 }}>
                          {progress}% onboarding
                        </span>
                      </div>
                    </div>
                    {/* Tier badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '8px', background: `${tierCfg.color}15`, fontSize: '0.7rem', fontWeight: 800, color: tierCfg.color, flexShrink: 0 }}>
                      <TierIcon size={12} /> {tierCfg.label}
                    </div>
                    {/* Status badge */}
                    <div style={{ padding: '4px 10px', borderRadius: '8px', background: statusCfg.bg, fontSize: '0.7rem', fontWeight: 800, color: statusCfg.color, flexShrink: 0 }}>
                      {statusCfg.label}
                    </div>
                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button
                        onClick={() => setOnboardingMember(m)}
                        title="Abrir onboarding"
                        style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(14,165,233,0.3)', background: 'rgba(14,165,233,0.08)', color: '#0ea5e9', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}
                      >
                        Jornada
                      </button>
                      <button
                        onClick={() => openEditMember(m)}
                        title="Editar membro"
                        style={{ padding: '6px 8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#64748b', cursor: 'pointer' }}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* EVENTS SECTION */}
        <div style={cardStyle}>
          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#e2e8f0', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarDays size={16} color="#f59e0b" /> Eventos do Clube
          </div>
          {events.length === 0 ? (
            <p style={{ color: '#475569', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>Nenhum evento vinculado ao clube.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {upcomingEvents.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f59e0b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Próximos</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                    {upcomingEvents.map(e => {
                      const dLeft = daysUntil(e.date)
                      return (
                        <div key={e.id} style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#f8fafc' }}>{e.name}</div>
                          <div style={{ display: 'flex', gap: '10px', fontSize: '0.72rem', color: '#94a3b8', flexWrap: 'wrap' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><CalendarDays size={12} /> {fmtEvt(e.date)}</span>
                            {e.location && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} /> {e.location}</span>}
                          </div>
                          {dLeft !== null && (
                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: dLeft <= 7 ? '#f59e0b' : '#10b981' }}>
                              {dLeft === 0 ? 'HOJE' : `em ${dLeft} dia${dLeft !== 1 ? 's' : ''}`}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {pastEvents.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Realizados</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                    {pastEvents.map(e => (
                      <div key={e.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px', opacity: 0.7 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#94a3b8' }}>{e.name}</div>
                        <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '4px' }}>{fmtEvt(e.date)}{e.location ? ` — ${e.location}` : ''}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* DELIVERABLES */}
        <div style={cardStyle}>
          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#e2e8f0', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={16} color="#10b981" /> Entregas &amp; Conteúdos</span>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{deliverables.filter(d => d.status === 'concluido').length}/{deliverables.length} concluídas</span>
          </div>
          {deliverables.length === 0 ? (
            <p style={{ color: '#475569', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>Nenhuma entrega cadastrada.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {deliverables.map(d => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '10px', background: d.status === 'concluido' ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <button onClick={() => handleToggleDeliv(d.id, d.status)} style={{ width: '22px', height: '22px', borderRadius: '6px', border: d.status === 'concluido' ? '2px solid #10b981' : '2px solid #475569', background: d.status === 'concluido' ? '#10b981' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {d.status === 'concluido' && <Check size={14} color="#fff" />}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: d.status === 'concluido' ? '#64748b' : '#e2e8f0', textDecoration: d.status === 'concluido' ? 'line-through' : 'none' }}>{d.title}</div>
                    <div style={{ display: 'flex', gap: '8px', fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                      <span style={{ color: CAT_COLORS[d.category] || '#94a3b8', fontWeight: 700 }}>{d.category}</span>
                      {d.due_date && <span>{fmt(d.due_date)}</span>}
                      {d.event?.name && <span>🎪 {d.event.name}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── ONBOARDING DRAWER ─────────────────────────────────────── */}
      {onboardingMember && initialOnboardingMap[onboardingMember.id] && (
        <OnboardingDrawer
          member={onboardingMember}
          onboarding={initialOnboardingMap[onboardingMember.id]}
          onClose={() => setOnboardingMember(null)}
        />
      )}

      {/* ── EDIT MEMBER MODAL ─────────────────────────────────────── */}
      <ActionDialog
        open={!!editMember}
        title={`Editar — ${editMember?.client?.name || 'Membro'}`}
        subtitle="Atualize status, nível e dados do contrato."
        onClose={() => setEditMember(null)}
        footer={<>
          <button type="button" className="btn-ghost" onClick={() => setEditMember(null)}>Cancelar</button>
          <button type="button" className="btn-primary" onClick={handleSaveMember} disabled={isPending}>Salvar</button>
        </>}
      >
        <div style={{ display: 'grid', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>Status</label>
              <select className={inputClass} value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as MemberStatus }))}>
                <option value="ativo">Ativo</option>
                <option value="em_renovacao">Em renovação</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>Nível</label>
              <select className={inputClass} value={editForm.tier} onChange={e => setEditForm(f => ({ ...f, tier: e.target.value as MemberTier }))}>
                <option value="standard">Standard</option>
                <option value="plus">Plus</option>
                <option value="vip">VIP</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>Início contrato</label>
              <input type="date" className={inputClass} value={editForm.contract_start} onChange={e => setEditForm(f => ({ ...f, contract_start: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>Fim contrato</label>
              <input type="date" className={inputClass} value={editForm.contract_end} onChange={e => setEditForm(f => ({ ...f, contract_end: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>Mentor</label>
            <select className={inputClass} value={editForm.mentor_id} onChange={e => setEditForm(f => ({ ...f, mentor_id: e.target.value }))}>
              <option value="">Sem mentor</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>Observações</label>
            <textarea className={inputClass} rows={3} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} placeholder="Anotações sobre o membro..." />
          </div>
        </div>
      </ActionDialog>

      {/* ── NEW DELIVERABLE MODAL ──────────────────────────────────── */}
      <ActionDialog
        open={showDeliverable}
        title="Nova entrega"
        subtitle="Adicione conteúdo ou material ao calendário do clube."
        onClose={() => setShowDeliverable(false)}
        footer={<>
          <button type="button" className="btn-ghost" onClick={() => setShowDeliverable(false)}>Cancelar</button>
          <button type="button" className="btn-primary" onClick={handleSaveDeliverable} disabled={isPending || !delivForm.title.trim()}>Salvar</button>
        </>}
      >
        <div style={{ display: 'grid', gap: '12px' }}>
          <input className={inputClass} placeholder="Título da entrega *" value={delivForm.title} onChange={e => setDelivForm(f => ({ ...f, title: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <select className={inputClass} value={delivForm.category} onChange={e => setDelivForm(f => ({ ...f, category: e.target.value as DeliverableCategory }))}>
              <option value="mentoria">Mentoria</option>
              <option value="conteudo">Conteúdo</option>
              <option value="material">Material</option>
              <option value="evento">Evento</option>
            </select>
            <input type="date" className={inputClass} value={delivForm.due_date} onChange={e => setDelivForm(f => ({ ...f, due_date: e.target.value }))} />
          </div>
          {delivForm.category === 'evento' && events.length > 0 && (
            <select className={inputClass} value={delivForm.event_id} onChange={e => setDelivForm(f => ({ ...f, event_id: e.target.value }))}>
              <option value="">Vincular a um evento</option>
              {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name} — {fmtEvt(ev.date)}</option>)}
            </select>
          )}
          <textarea className={inputClass} rows={2} placeholder="Descrição (opcional)" value={delivForm.description} onChange={e => setDelivForm(f => ({ ...f, description: e.target.value }))} />
        </div>
      </ActionDialog>
    </>
  )
}
