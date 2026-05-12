'use server'

import { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export type CommercialActivityRecord = {
  id: string
  lead_id?: string | null
  deal_id?: string | null
  client_id?: string | null
  contract_id?: string | null
  meeting_id?: string | null
  activity_type?: string | null
  subject: string
  agenda?: string | null
  summary?: string | null
  next_step?: string | null
  next_contact_at?: string | null
  status?: string | null
  outcome?: string | null
  consultant_id?: string | null
  created_by?: string | null
  created_at?: string
  updated_at?: string
}

export type CommercialActivityInput = {
  leadId?: string | null
  dealId?: string | null
  clientId?: string | null
  contractId?: string | null
  meetingId?: string | null
  activityType: string
  subject: string
  agenda?: string | null
  summary?: string | null
  nextStep?: string | null
  nextContactAt?: string | null
  status?: string | null
  outcome?: string | null
  consultantId?: string | null
  createdBy?: string | null
}

function isMissingSchemaError(error: unknown) {
  if (!error || typeof error !== 'object') return false

  const maybeError = error as { code?: string; message?: string }
  const message = (maybeError.message || '').toLowerCase()

  return (
    maybeError.code === '42P01' ||
    maybeError.code === '42703' ||
    message.includes('does not exist') ||
    message.includes('could not find the') ||
    (message.includes('column') && message.includes('does not exist'))
  )
}

async function resolveCreatedBy(supabase: SupabaseServerClient, createdBy?: string | null) {
  if (createdBy) return createdBy

  const { data } = await supabase.auth.getUser()
  return data.user?.id || null
}

export async function recordCommercialActivity(
  input: CommercialActivityInput
): Promise<{ success: boolean; error?: string; data?: CommercialActivityRecord | null }> {
  const supabase = await createClient()
  const createdBy = await resolveCreatedBy(supabase, input.createdBy)

  const { data, error } = await supabase
    .from('commercial_activities')
    .insert({
      lead_id: input.leadId ?? null,
      deal_id: input.dealId ?? null,
      client_id: input.clientId ?? null,
      contract_id: input.contractId ?? null,
      meeting_id: input.meetingId ?? null,
      activity_type: input.activityType,
      subject: input.subject,
      agenda: input.agenda ?? null,
      summary: input.summary ?? null,
      next_step: input.nextStep ?? null,
      next_contact_at: input.nextContactAt ?? null,
      status: input.status ?? 'registrada',
      outcome: input.outcome ?? null,
      consultant_id: input.consultantId ?? null,
      created_by: createdBy,
    })
    .select('*')
    .maybeSingle()

  if (error) {
    if (isMissingSchemaError(error)) {
      console.warn('Trilha comercial indisponivel:', error.message)
      return { success: true, data: null }
    }

    console.warn('Falha ao registrar atividade comercial:', error.message)
    return { success: false, error: error.message, data: null }
  }

  return { success: true, data: (data as CommercialActivityRecord | null) || null }
}

export async function listCommercialActivities(filters: {
  leadId?: string | null
  dealId?: string | null
  clientId?: string | null
  contractId?: string | null
  meetingId?: string | null
  limit?: number
}): Promise<{ success: boolean; error?: string; data: CommercialActivityRecord[] }> {
  const supabase = await createClient()
  let query = supabase.from('commercial_activities').select('*').order('created_at', { ascending: false })

  if (filters.leadId) query = query.eq('lead_id', filters.leadId)
  if (filters.dealId) query = query.eq('deal_id', filters.dealId)
  if (filters.clientId) query = query.eq('client_id', filters.clientId)
  if (filters.contractId) query = query.eq('contract_id', filters.contractId)
  if (filters.meetingId) query = query.eq('meeting_id', filters.meetingId)
  if (filters.limit && filters.limit > 0) query = query.limit(filters.limit)

  const { data, error } = await query

  if (error) {
    if (isMissingSchemaError(error)) {
      return { success: true, data: [] }
    }

    return { success: false, error: error.message, data: [] }
  }

  return { success: true, data: (data || []) as CommercialActivityRecord[] }
}
