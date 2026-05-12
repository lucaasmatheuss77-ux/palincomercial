'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const ADMIN_ROLES = ['admin', 'gestor', 'manager']

export type ClientMeeting = {
  id: string
  client_id: string
  meeting_date: string
  title: string
  recording_link: string | null
  pauta: string | null
  notes: string | null
  participants: string | null
  duration_min: number | null
  ai_generated: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export type ClientMeetingInput = {
  meeting_date: string
  title: string
  recording_link?: string | null
  pauta?: string | null
  notes?: string | null
  participants?: string | null
  duration_min?: number | null
  ai_generated?: boolean
}

function isMissingSchemaError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: string; message?: string }
  const msg = (e.message || '').toLowerCase()
  return (
    e.code === '42P01' ||
    e.code === '42703' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the')
  )
}

export async function listClientMeetings(
  clientId: string
): Promise<{ success: boolean; data: ClientMeeting[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, data: [], error: 'Nao autorizado.' }

  const { data, error } = await supabase
    .from('client_meetings')
    .select('*')
    .eq('client_id', clientId)
    .order('meeting_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    if (isMissingSchemaError(error)) return { success: true, data: [] }
    return { success: false, data: [], error: error.message }
  }

  return { success: true, data: (data || []) as ClientMeeting[] }
}

export async function createClientMeeting(
  clientId: string,
  input: ClientMeetingInput
): Promise<{ success: boolean; data?: ClientMeeting | null; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Nao autorizado.' }

  const title = input.title?.trim()
  if (!title) return { success: false, error: 'Informe o titulo da reuniao.' }
  if (!input.meeting_date) return { success: false, error: 'Informe a data da reuniao.' }

  const { data, error } = await supabase
    .from('client_meetings')
    .insert({
      client_id: clientId,
      meeting_date: input.meeting_date,
      title,
      recording_link: input.recording_link?.trim() || null,
      pauta: input.pauta?.trim() || null,
      notes: input.notes?.trim() || null,
      participants: input.participants?.trim() || null,
      duration_min: input.duration_min ?? null,
      ai_generated: input.ai_generated ?? false,
      created_by: user.id,
    })
    .select('*')
    .maybeSingle()

  if (error) {
    if (isMissingSchemaError(error)) return { success: false, error: 'Tabela de reunioes indisponivel. Rode o schema SQL primeiro.' }
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/clientes')
  return { success: true, data: data as ClientMeeting | null }
}

export async function updateClientMeeting(
  meetingId: string,
  input: Partial<ClientMeetingInput>
): Promise<{ success: boolean; data?: ClientMeeting | null; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Nao autorizado.' }

  const payload: Record<string, unknown> = {}
  if (input.title !== undefined) payload.title = input.title.trim()
  if (input.meeting_date !== undefined) payload.meeting_date = input.meeting_date
  if (input.recording_link !== undefined) payload.recording_link = input.recording_link?.trim() || null
  if (input.pauta !== undefined) payload.pauta = input.pauta?.trim() || null
  if (input.notes !== undefined) payload.notes = input.notes?.trim() || null
  if (input.participants !== undefined) payload.participants = input.participants?.trim() || null
  if (input.duration_min !== undefined) payload.duration_min = input.duration_min ?? null
  if (input.ai_generated !== undefined) payload.ai_generated = input.ai_generated

  const { data, error } = await supabase
    .from('client_meetings')
    .update(payload)
    .eq('id', meetingId)
    .select('*')
    .maybeSingle()

  if (error) {
    if (isMissingSchemaError(error)) return { success: false, error: 'Tabela de reunioes indisponivel.' }
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/clientes')
  return { success: true, data: data as ClientMeeting | null }
}

export async function deleteClientMeeting(
  meetingId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Nao autorizado.' }

  // Verificar role — apenas admin/gestor pode excluir
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = (profile?.role as string | null) ?? null

  // Permitir também o próprio criador excluir
  const { data: meeting } = await supabase
    .from('client_meetings')
    .select('created_by')
    .eq('id', meetingId)
    .maybeSingle()

  const isOwner = meeting?.created_by === user.id
  const isAdmin = role && ADMIN_ROLES.includes(role)

  if (!isOwner && !isAdmin) {
    return { success: false, error: 'Sem permissao para excluir esta reuniao.' }
  }

  const { error } = await supabase
    .from('client_meetings')
    .delete()
    .eq('id', meetingId)

  if (error) {
    if (isMissingSchemaError(error)) return { success: false, error: 'Tabela de reunioes indisponivel.' }
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/clientes')
  return { success: true }
}
