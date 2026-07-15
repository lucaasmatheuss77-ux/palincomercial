'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { recordCommercialActivity } from './commercial-activities'

type MeetingPayload = {
  title: string
  scheduled_for: string
  ends_at?: string | null
  location?: string | null
  meeting_type?: string | null
  status?: string | null
  objective?: string | null
  notes?: string | null
  lead_id?: string | null
  lead_name?: string | null
  company_name?: string | null
  client_id?: string | null
  deal_id?: string | null
  contract_id?: string | null
  agenda?: string | null
  summary?: string | null
  next_step?: string | null
  next_contact_at?: string | null
  owner_profile_id?: string | null
  requires_logistics?: boolean
  event_id?: string | null
}

type TaskPayload = {
  meeting_id?: string | null
  title: string
  due_at?: string | null
  priority?: string | null
  owner_profile_id?: string | null
}

type LogisticsPayload = {
  meeting_id?: string | null
  title: string
  detail?: string | null
  status?: string | null
}

function getMissingColumn(message?: string) {
  if (!message) return null
  return (
    message.match(/'([^']+)' column/)?.[1] ||
    message.match(/column "([^"]+)"/)?.[1] ||
    null
  )
}

async function getOwnerName(ownerId: string | null | undefined): Promise<string> {
  if (!ownerId) return 'Sem responsavel'
  try {
    const supabase = await createClient()
    const { data } = await supabase.from('profiles').select('full_name').eq('id', ownerId).single()
    return data?.full_name || 'Responsavel'
  } catch {
    return 'Responsavel'
  }
}

export async function createMeeting(payload: MeetingPayload) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    const ownerProfileId = payload.owner_profile_id ?? user?.id ?? null

    const ownerName = await getOwnerName(ownerProfileId)

    let meetingPayload: Record<string, unknown> = {
      title: payload.title,
      scheduled_for: payload.scheduled_for,
      ends_at: payload.ends_at ?? null,
      location: payload.location ?? null,
      meeting_type: payload.meeting_type ?? 'Presencial',
      status: payload.status ?? 'agendada',
      lead_id: payload.lead_id ?? null,
      lead_name: payload.lead_name ?? null,
      company_name: payload.company_name ?? null,
      client_id: payload.client_id ?? null,
      deal_id: payload.deal_id ?? null,
      contract_id: payload.contract_id ?? null,
      objective: payload.objective ?? null,
      notes: payload.notes ?? null,
      agenda: payload.agenda ?? payload.objective ?? null,
      summary: payload.summary ?? payload.notes ?? null,
      next_step: payload.next_step ?? null,
      next_contact_at: payload.next_contact_at ?? null,
      owner_profile_id: ownerProfileId,
      owner_name: ownerName,
      requires_logistics: payload.requires_logistics ?? false,
      event_id: payload.event_id ?? null,
    }

    let meetingData: { id: string } | null = null
    let error: { message: string } | null = null

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const result = await supabase
        .from('meetings')
        .insert(meetingPayload)
        .select('id')
        .single()

      meetingData = result.data as { id: string } | null
      error = result.error
      if (!error) break

      const missingColumn = getMissingColumn(error.message)
      if (!missingColumn || !(missingColumn in meetingPayload)) break

      const nextPayload = { ...meetingPayload }
      delete nextPayload[missingColumn]
      meetingPayload = nextPayload
    }

    if (error) throw error
    if (!meetingData?.id) throw new Error('Reuniao criada sem identificador.')

    const id = meetingData.id

    const activityResult = await recordCommercialActivity({
      leadId: payload.lead_id ?? null,
      clientId: payload.client_id ?? null,
      dealId: payload.deal_id ?? null,
      contractId: payload.contract_id ?? null,
      meetingId: id,
      activityType: 'reuniao',
      subject: payload.title,
      agenda: payload.agenda ?? payload.objective ?? null,
      summary: payload.summary ?? payload.notes ?? null,
      nextStep: payload.next_step ?? null,
      nextContactAt: payload.next_contact_at ?? null,
      consultantId: ownerProfileId,
      status: payload.status ?? 'agendada',
    })

    if (activityResult.success && activityResult.data?.id) {
      await supabase
        .from('meetings')
        .update({ commercial_activity_id: activityResult.data.id })
        .eq('id', id)
    }

    if (ownerProfileId) {
      try {
        await supabase.from('xp_logs').insert({
          profile_id: ownerProfileId,
          action: 'Reuniao agendada',
          xp_amount: 50,
          reference_id: id,
        })
      } catch {}
    }

    revalidatePath('/dashboard/agenda')
    revalidatePath('/dashboard/ranking')
    return { success: true, data: { id } }
  } catch (error) {
    console.error('Erro ao criar reuniao:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao criar reuniao' }
  }
}

export async function updateMeetingStatus(meetingId: string, status: string) {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('meetings')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', meetingId)

    if (error) throw error
    revalidatePath('/dashboard/agenda')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao atualizar reuniao' }
  }
}

export async function createMeetingTask(payload: TaskPayload) {
  try {
    const supabase = await createClient()
    const ownerName = await getOwnerName(payload.owner_profile_id)

    const { data, error } = await supabase
      .from('meeting_tasks')
      .insert({
        meeting_id: payload.meeting_id ?? null,
        title: payload.title,
        due_at: payload.due_at ?? null,
        priority: payload.priority ?? 'Media',
        status: 'aberta',
        owner_profile_id: payload.owner_profile_id ?? null,
        owner_name: ownerName,
      })
      .select('id')
      .single()

    if (error) throw error
    revalidatePath('/dashboard/agenda')
    return { success: true, data: { id: data.id } }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao criar tarefa' }
  }
}

export async function toggleMeetingTask(taskId: string, done: boolean) {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('meeting_tasks')
      .update({
        status: done ? 'concluida' : 'aberta',
        completed_at: done ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)

    if (error) throw error
    revalidatePath('/dashboard/agenda')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao atualizar tarefa' }
  }
}

export async function createLogisticsItem(payload: LogisticsPayload) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('meeting_logistics')
      .insert({
        meeting_id: payload.meeting_id ?? null,
        title: payload.title,
        detail: payload.detail ?? null,
        status: payload.status ?? 'pendente',
      })
      .select('id')
      .single()

    if (error) throw error
    revalidatePath('/dashboard/agenda')
    return { success: true, data: { id: data.id } }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao criar item logistico' }
  }
}

export async function updateLogisticsStatus(itemId: string, status: string) {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('meeting_logistics')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', itemId)

    if (error) throw error
    revalidatePath('/dashboard/agenda')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao atualizar logistica' }
  }
}
