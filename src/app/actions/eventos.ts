'use server'

import { EventDbResult } from '@/lib/types'

export async function createEvent(data: {
  name: string
  tipo?: 'proprio' | 'externo'
  date?: string
  local?: string
  capacidade?: number
  status?: string
  product_id?: string
  description?: string
  ends_at?: string
  organizer_name?: string
  organizer_contact?: string
  participation_type?: string
  investment?: number
  expected_leads?: number
  objectives?: string
  notes_logistics?: string
}) {
  const { createClient } = await import('@/lib/supabase/server')
  const { revalidatePath } = await import('next/cache')
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Nao autorizado.' }
    
    // Use user.id directly instead of querying profiles, which could throw due to RLS
    const { error, data: createdEvent } = await supabase.from('events').insert({
      name: data.name.trim(),
      type: data.tipo ?? 'proprio',
      date: data.date ? new Date(data.date).toISOString() : new Date().toISOString(),
      location: data.local || 'Sede Palin',
      capacity: data.capacidade ?? 30,
      status: data.status ?? 'planejamento',
      product_id: data.product_id || null,
      description: data.description || '',
      created_by: user.id,
      ends_at: data.ends_at ? new Date(data.ends_at).toISOString() : null,
      organizer_name: data.organizer_name || null,
      organizer_contact: data.organizer_contact || null,
      participation_type: data.participation_type || 'visitante',
      investment: data.investment ?? 0,
      expected_leads: data.expected_leads ?? 0,
      objectives: data.objectives || null,
      notes_logistics: data.notes_logistics || null,
    }).select().single()

    if (error) throw error

    revalidatePath('/dashboard/eventos')
    return { success: true, event: createdEvent }
  } catch (error) {
    console.error('Erro ao criar evento:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao criar evento' }
  }
}

export async function getEvents() {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: events, error } = await supabase
    .from('events')
    .select(`
      *,
      event_participants (count),
      products (name)
    `)
    .order('date', { ascending: false })

  if (error) {
    console.error('Erro ao buscar eventos:', error)
    return []
  }

  return (events as unknown as EventDbResult[]).map((e) => ({
    id: e.id,
    name: e.name,
    tipo: e.type,
    date: new Date(e.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
    rawDate: e.date,
    local: e.location,
    capacidade: e.capacity,
    status: e.status,
    inscritos: e.event_participants?.[0]?.count || 0,
    produto: e.products?.name || 'Geral',
    organizer_name: e.organizer_name,
    organizer_contact: e.organizer_contact,
    participation_type: e.participation_type,
    investment: Number(e.investment) || 0,
    expected_leads: Number(e.expected_leads) || 0,
    objectives: e.objectives,
    notes_logistics: e.notes_logistics,
    ends_at: e.ends_at,
    description: e.description,
    current_stage: e.current_stage,
  }))
}

export async function getEvent(id: string) {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      products (name)
    `)
    .eq('id', id)
    .single()

  if (error) return null

  return data
}

export async function getEventParticipants(eventId: string) {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('event_participants')
    .select(`*, leads(stage)`)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  if (error) return []
  return data
}

export async function concludeEvent(eventId: string) {
  const { createClient } = await import('@/lib/supabase/server')
  const { revalidatePath } = await import('next/cache')
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('events')
      .update({ status: 'realizado', current_stage: 'Pós-Evento' })
      .eq('id', eventId)

    if (error) throw error
    revalidatePath('/dashboard/eventos')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erro ao concluir evento' }
  }
}

export async function updateEvent(eventId: string, updates: Record<string, unknown>) {
  const { createClient } = await import('@/lib/supabase/server')
  const { revalidatePath } = await import('next/cache')
  try {
    const supabase = await createClient()

    const payload: Record<string, unknown> = { ...updates }
    if (payload.date) payload.date = new Date(payload.date as string).toISOString()
    if (payload.ends_at) payload.ends_at = new Date(payload.ends_at as string).toISOString()

    const { error } = await supabase
      .from('events')
      .update(payload)
      .eq('id', eventId)

    if (error) throw error

    // Se as datas mudaram, deveriamos mover as reuniões também
    // Faremos isso de forma simples: qualquer reunião ligada ao evento recebe a mesma data base.
    if (payload.date) {
      await supabase
        .from('meetings')
        .update({
          scheduled_for: payload.date,
          ends_at: payload.ends_at || null
        })
        .eq('event_id', eventId)
    }

    revalidatePath('/dashboard/eventos')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erro na operacao' }
  }
}

export async function assignEventStaff(eventId: string, profileId: string, eventName: string, startDate: string, endDate?: string) {
  const { createClient } = await import('@/lib/supabase/server')
  const { revalidatePath } = await import('next/cache')
  try {
    const supabase = await createClient()
    
    // We get profile info to ensure we know who we assign
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', profileId).single()
    if (!profile) return { success: false, error: 'Usuario nao encontrado' }

    // Cria reunião com o tipo Feira Externa (ou Operacao de Evento)
    const { error } = await supabase.from('meetings').insert({
      title: `Operacao: ${eventName}`,
      scheduled_for: startDate,
      ends_at: endDate || null,
      meeting_type: 'Operacao Evento',
      status: 'agendada',
      owner_profile_id: profileId,
      owner_name: profile.full_name,
      event_id: eventId,
      notes: 'Alocado na operacao logistica deste evento.',
      requires_logistics: true
    })

    if (error) throw error
    revalidatePath('/dashboard/eventos')
    revalidatePath('/dashboard/agenda')
    
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erro na operacao' }
  }
}

export async function removeEventStaff(meetingId: string) {
  const { createClient } = await import('@/lib/supabase/server')
  const { revalidatePath } = await import('next/cache')
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('meetings').delete().eq('id', meetingId)

    if (error) throw error
    revalidatePath('/dashboard/eventos')
    revalidatePath('/dashboard/agenda')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erro na operacao' }
  }
}

export async function getEventStaff(eventId: string) {
  const { createClient } = await import('@/lib/supabase/server')
  try {
    const supabase = await createClient()
    // Buscar todas as reuniões atreladas ao eventId
    const { data, error } = await supabase
      .from('meetings')
      .select('id, owner_profile_id, owner_name, status')
      .eq('event_id', eventId)
      
    if (error) throw error
    return data || []
  } catch {
    return []
  }
}

// ═══════════════════════════════════════════════════════════════
// Checklist Actions
// ═══════════════════════════════════════════════════════════════

export async function getEventChecklist(eventId: string) {
  const { createClient } = await import('@/lib/supabase/server')
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('event_checklist')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
  } catch {
    return []
  }
}

export async function createChecklistItem(data: {
  event_id: string
  title: string
  due_at?: string | null
  assigned_to?: string | null
  assigned_name?: string | null
}) {
  const { createClient } = await import('@/lib/supabase/server')
  const { revalidatePath } = await import('next/cache')
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('event_checklist').insert({
      event_id: data.event_id,
      title: data.title.trim(),
      due_at: data.due_at || null,
      assigned_to: data.assigned_to || null,
      assigned_name: data.assigned_name || null,
    })

    if (error) throw error
    revalidatePath('/dashboard/eventos')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erro ao criar item' }
  }
}

export async function toggleChecklistItem(itemId: string, done: boolean) {
  const { createClient } = await import('@/lib/supabase/server')
  const { revalidatePath } = await import('next/cache')
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('event_checklist')
      .update({ done, updated_at: new Date().toISOString() })
      .eq('id', itemId)

    if (error) throw error
    revalidatePath('/dashboard/eventos')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erro ao atualizar item' }
  }
}

export async function deleteChecklistItem(itemId: string) {
  const { createClient } = await import('@/lib/supabase/server')
  const { revalidatePath } = await import('next/cache')
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('event_checklist')
      .delete()
      .eq('id', itemId)

    if (error) throw error
    revalidatePath('/dashboard/eventos')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erro ao deletar item' }
  }
}
