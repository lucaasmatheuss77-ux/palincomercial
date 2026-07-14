'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type StepAttachment = {
  id: string
  file_name: string
  file_path: string
  file_type: string | null
  signed_url: string | null
  uploaded_at: string
}

export type OnboardingStep = {
  id: string
  label: string
  description: string
  icon: string
  done: boolean
  done_at: string | null
  notes: string | null
  attachments: StepAttachment[]
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

const DEFAULT_STEPS: Omit<OnboardingStep, 'done' | 'done_at' | 'notes' | 'attachments'>[] = [
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

function buildOnboarding(memberId: string, raw: string | null, attachmentsByStep: Record<string, StepAttachment[]> = {}): MemberOnboarding {
  const data = parseOnboardingData(raw)
  const steps: OnboardingStep[] = DEFAULT_STEPS.map(s => ({
    ...s,
    done: data.steps[s.id]?.done ?? false,
    done_at: data.steps[s.id]?.done_at ?? null,
    notes: data.steps[s.id]?.notes ?? null,
    attachments: attachmentsByStep[s.id] ?? [],
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

const CLUBE_JORNADA_BUCKET = 'clube-jornada'

async function loadAttachmentsForMembers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  memberIds: string[],
): Promise<Record<string, Record<string, StepAttachment[]>>> {
  if (!memberIds.length) return {}
  const { data, error } = await supabase
    .from('club_onboarding_attachments')
    .select('id, member_id, step_id, file_name, file_path, file_type, uploaded_at')
    .in('member_id', memberIds)
    .order('uploaded_at', { ascending: false })

  if (error || !data) return {}

  const rows = data as { id: string; member_id: string; step_id: string; file_name: string; file_path: string; file_type: string | null; uploaded_at: string }[]

  const withUrls = await Promise.all(
    rows.map(async (row) => {
      const { data: signed } = await supabase.storage.from(CLUBE_JORNADA_BUCKET).createSignedUrl(row.file_path, 60 * 60)
      return { ...row, signed_url: signed?.signedUrl || null }
    })
  )

  const result: Record<string, Record<string, StepAttachment[]>> = {}
  for (const row of withUrls) {
    result[row.member_id] ||= {}
    result[row.member_id][row.step_id] ||= []
    result[row.member_id][row.step_id].push({
      id: row.id, file_name: row.file_name, file_path: row.file_path, file_type: row.file_type, signed_url: row.signed_url, uploaded_at: row.uploaded_at,
    })
  }
  return result
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

  const attachments = await loadAttachmentsForMembers(supabase, [memberId])
  return { success: true, data: buildOnboarding(memberId, (member as { id: string; onboarding_data: string | null }).onboarding_data, attachments[memberId] || {}) }
}

export async function getAllMembersOnboarding(memberIds: string[]): Promise<Record<string, MemberOnboarding>> {
  if (!memberIds.length) return {}
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('club_members')
    .select('id, onboarding_data')
    .in('id', memberIds)

  if (error || !data) return {}

  const attachmentsByMember = await loadAttachmentsForMembers(supabase, memberIds)
  const result: Record<string, MemberOnboarding> = {}
  for (const row of data as { id: string; onboarding_data: string | null }[]) {
    result[row.id] = buildOnboarding(row.id, row.onboarding_data, attachmentsByMember[row.id] || {})
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

// ─── Step attachments (documento, audio ou video por etapa) ───────────────────

export async function uploadStepAttachment(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const memberId = String(formData.get('member_id') || '').trim()
  const stepId = String(formData.get('step_id') || '').trim()
  const file = formData.get('file')

  if (!memberId || !stepId) return { success: false, error: 'Membro ou etapa nao informados.' }
  if (!(file instanceof File) || file.size <= 0) return { success: false, error: 'Selecione um arquivo valido.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Nao autorizado.' }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${memberId}/${stepId}/${Date.now()}-${safeName}`

  const { error: uploadError } = await supabase.storage.from(CLUBE_JORNADA_BUCKET).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })

  if (uploadError) return { success: false, error: uploadError.message }

  const { error } = await supabase.from('club_onboarding_attachments').insert({
    member_id: memberId,
    step_id: stepId,
    file_name: file.name,
    file_path: path,
    file_type: file.type || null,
    file_size: file.size,
    uploaded_by: user.id,
  })

  if (error) {
    await supabase.storage.from(CLUBE_JORNADA_BUCKET).remove([path]).catch(() => {})
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/clube')
  return { success: true }
}

export async function deleteStepAttachment(attachmentId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Nao autorizado.' }

  const { data: attachment } = await supabase
    .from('club_onboarding_attachments')
    .select('file_path')
    .eq('id', attachmentId)
    .maybeSingle()

  if (attachment?.file_path) {
    await supabase.storage.from(CLUBE_JORNADA_BUCKET).remove([attachment.file_path]).catch(() => {})
  }

  const { error } = await supabase.from('club_onboarding_attachments').delete().eq('id', attachmentId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/clube')
  return { success: true }
}
