'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type OnboardingStep = {
  id: string
  label: string
  description: string
  icon: string
  done: boolean
  done_at: string | null
  notes: string | null
}

export type OnboardingSession = {
  id: string
  date: string
  duration_min: number | null
  agenda: string | null
  summary: string | null
  next_step: string | null
  mentor_name: string | null
}

export type OnboardingGoal = {
  id: string
  goal: string
  result: string | null
  achieved: boolean
  due_date: string | null
}

export type MemberOnboarding = {
  member_id: string
  steps: OnboardingStep[]
  sessions: OnboardingSession[]
  goals: OnboardingGoal[]
  progress_pct: number
  completed_at: string | null
}

// Estrutura armazenada no campo `onboarding_data` (JSON) dentro de club_members
type OnboardingData = {
  steps: Record<string, { done: boolean; done_at: string | null; notes: string | null }>
  sessions: OnboardingSession[]
  goals: OnboardingGoal[]
  completed_at: string | null
}

const DEFAULT_STEPS: Omit<OnboardingStep, 'done' | 'done_at' | 'notes'>[] = [
  { id: 'boas_vindas',   label: 'Boas-vindas',          description: 'Reunião de apresentação, regras do clube e expectativas alinhadas.',       icon: '👋' },
  { id: 'diagnostico',   label: 'Diagnóstico inicial',  description: 'Levantamento da situação atual: negócio, desafios e pontos de melhoria.',   icon: '🔍' },
  { id: 'plano_acao',    label: 'Plano de ação',        description: 'Definição das metas, estratégias e cronograma da mentoria.',                icon: '📋' },
  { id: 'sessoes',       label: 'Sessões de mentoria',  description: 'Acompanhamento contínuo com reuniões periódicas e registros.',              icon: '🎯' },
  { id: 'entregas',      label: 'Entregas & conteúdos', description: 'Materiais, tarefas e implementações práticas da mentoria.',                 icon: '📦' },
  { id: 'avaliacao',     label: 'Avaliação final',      description: 'Revisão dos resultados alcançados e decisão sobre renovação.',              icon: '⭐' },
]

function parseOnboardingData(raw: string | null): OnboardingData {
  if (!raw) return { steps: {}, sessions: [], goals: [], completed_at: null }
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && 'steps' in parsed) return parsed as OnboardingData
    return { steps: {}, sessions: [], goals: [], completed_at: null }
  } catch {
    return { steps: {}, sessions: [], goals: [], completed_at: null }
  }
}

function buildOnboarding(memberId: string, raw: string | null): MemberOnboarding {
  const data = parseOnboardingData(raw)
  const steps: OnboardingStep[] = DEFAULT_STEPS.map(s => ({
    ...s,
    done: data.steps[s.id]?.done ?? false,
    done_at: data.steps[s.id]?.done_at ?? null,
    notes: data.steps[s.id]?.notes ?? null,
  }))
  const donePct = Math.round((steps.filter(s => s.done).length / steps.length) * 100)
  return {
    member_id: memberId,
    steps,
    sessions: data.sessions ?? [],
    goals: data.goals ?? [],
    progress_pct: donePct,
    completed_at: data.completed_at,
  }
}

// ─── Read ──────────────────────────────────────────────────────────────────────

export async function getMemberOnboarding(memberId: string): Promise<{ success: boolean; data?: MemberOnboarding; error?: string }> {
  const supabase = await createClient()

  const { data: member, error } = await supabase
    .from('club_members')
    .select('id, onboarding_data')
    .eq('id', memberId)
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  if (!member) return { success: false, error: 'Membro não encontrado.' }

  return { success: true, data: buildOnboarding(memberId, (member as { id: string; onboarding_data: string | null }).onboarding_data) }
}

export async function getAllMembersOnboarding(memberIds: string[]): Promise<Record<string, MemberOnboarding>> {
  if (!memberIds.length) return {}
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('club_members')
    .select('id, onboarding_data')
    .in('id', memberIds)

  if (error || !data) return {}

  const result: Record<string, MemberOnboarding> = {}
  for (const row of data as { id: string; onboarding_data: string | null }[]) {
    result[row.id] = buildOnboarding(row.id, row.onboarding_data)
  }
  return result
}

// ─── Toggle step ──────────────────────────────────────────────────────────────

export async function toggleOnboardingStep(
  memberId: string,
  stepId: string,
  notes?: string | null,
): Promise<{ success: boolean; error?: string; data?: MemberOnboarding }> {
  const supabase = await createClient()

  const { data: member, error: fetchErr } = await supabase
    .from('club_members')
    .select('id, onboarding_data')
    .eq('id', memberId)
    .maybeSingle()

  if (fetchErr || !member) return { success: false, error: fetchErr?.message ?? 'Membro não encontrado.' }

  const raw = (member as { id: string; onboarding_data: string | null }).onboarding_data
  const parsed = parseOnboardingData(raw)
  const current = parsed.steps[stepId] ?? { done: false, done_at: null, notes: null }
  const toggled = !current.done

  parsed.steps[stepId] = {
    done: toggled,
    done_at: toggled ? new Date().toISOString() : null,
    notes: notes !== undefined ? notes : current.notes,
  }

  // Check if all done → mark completed
  const allDone = DEFAULT_STEPS.every(s => parsed.steps[s.id]?.done)
  if (allDone && !parsed.completed_at) parsed.completed_at = new Date().toISOString()
  if (!allDone) parsed.completed_at = null

  const { error: updateErr } = await supabase
    .from('club_members')
    .update({ onboarding_data: JSON.stringify(parsed), updated_at: new Date().toISOString() })
    .eq('id', memberId)

  if (updateErr) return { success: false, error: updateErr.message }

  revalidatePath('/dashboard/clube')
  return { success: true, data: buildOnboarding(memberId, JSON.stringify(parsed)) }
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function saveOnboardingSession(
  memberId: string,
  session: Omit<OnboardingSession, 'id'>,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: member, error: fetchErr } = await supabase
    .from('club_members')
    .select('id, onboarding_data')
    .eq('id', memberId)
    .maybeSingle()

  if (fetchErr || !member) return { success: false, error: fetchErr?.message ?? 'Membro não encontrado.' }

  const raw = (member as { id: string; onboarding_data: string | null }).onboarding_data
  const parsed = parseOnboardingData(raw)

  const newSession: OnboardingSession = {
    id: crypto.randomUUID(),
    ...session,
  }

  parsed.sessions = [newSession, ...(parsed.sessions ?? [])]

  const { error: updateErr } = await supabase
    .from('club_members')
    .update({ onboarding_data: JSON.stringify(parsed), updated_at: new Date().toISOString() })
    .eq('id', memberId)

  if (updateErr) return { success: false, error: updateErr.message }

  revalidatePath('/dashboard/clube')
  return { success: true }
}

export async function deleteOnboardingSession(
  memberId: string,
  sessionId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: member, error: fetchErr } = await supabase
    .from('club_members')
    .select('id, onboarding_data')
    .eq('id', memberId)
    .maybeSingle()

  if (fetchErr || !member) return { success: false, error: fetchErr?.message ?? 'Membro não encontrado.' }

  const raw = (member as { id: string; onboarding_data: string | null }).onboarding_data
  const parsed = parseOnboardingData(raw)
  parsed.sessions = (parsed.sessions ?? []).filter(s => s.id !== sessionId)

  const { error: updateErr } = await supabase
    .from('club_members')
    .update({ onboarding_data: JSON.stringify(parsed), updated_at: new Date().toISOString() })
    .eq('id', memberId)

  if (updateErr) return { success: false, error: updateErr.message }

  revalidatePath('/dashboard/clube')
  return { success: true }
}

// ─── Goals ────────────────────────────────────────────────────────────────────

export async function upsertOnboardingGoal(
  memberId: string,
  goal: Omit<OnboardingGoal, 'id'> & { id?: string },
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: member, error: fetchErr } = await supabase
    .from('club_members')
    .select('id, onboarding_data')
    .eq('id', memberId)
    .maybeSingle()

  if (fetchErr || !member) return { success: false, error: fetchErr?.message ?? 'Membro não encontrado.' }

  const raw = (member as { id: string; onboarding_data: string | null }).onboarding_data
  const parsed = parseOnboardingData(raw)

  if (goal.id) {
    parsed.goals = (parsed.goals ?? []).map(g => g.id === goal.id ? { ...g, ...goal, id: g.id } : g)
  } else {
    parsed.goals = [{ id: crypto.randomUUID(), ...goal }, ...(parsed.goals ?? [])]
  }

  const { error: updateErr } = await supabase
    .from('club_members')
    .update({ onboarding_data: JSON.stringify(parsed), updated_at: new Date().toISOString() })
    .eq('id', memberId)

  if (updateErr) return { success: false, error: updateErr.message }

  revalidatePath('/dashboard/clube')
  return { success: true }
}

export async function deleteOnboardingGoal(
  memberId: string,
  goalId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: member, error: fetchErr } = await supabase
    .from('club_members')
    .select('id, onboarding_data')
    .eq('id', memberId)
    .maybeSingle()

  if (fetchErr || !member) return { success: false, error: fetchErr?.message ?? 'Membro não encontrado.' }

  const raw = (member as { id: string; onboarding_data: string | null }).onboarding_data
  const parsed = parseOnboardingData(raw)
  parsed.goals = (parsed.goals ?? []).filter(g => g.id !== goalId)

  const { error: updateErr } = await supabase
    .from('club_members')
    .update({ onboarding_data: JSON.stringify(parsed), updated_at: new Date().toISOString() })
    .eq('id', memberId)

  if (updateErr) return { success: false, error: updateErr.message }

  revalidatePath('/dashboard/clube')
  return { success: true }
}
