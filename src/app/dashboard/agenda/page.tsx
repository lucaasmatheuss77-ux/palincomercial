import { createClient } from '@/lib/supabase/server'
import AgendaManager from './agenda-manager'
import type { AgendaLeadOption, AgendaLogisticsItem, AgendaMeeting, AgendaProfile, AgendaTask } from './agenda-types'

export const dynamic = 'force-dynamic'

type ProfileRecord = {
  id: string
  full_name: string | null
}

type LeadRecord = {
  id: string
  name: string | null
  company: string | null
  client_id: string | null
}

type ClientRecord = {
  id: string
  name: string | null
  company_name: string | null
}

type MeetingRecord = {
  id: string
  title: string
  scheduled_for: string
  ends_at: string | null
  location: string | null
  meeting_type: string | null
  status: string | null
  objective: string | null
  notes: string | null
  lead_id: string | null
  client_id: string | null
  lead_name: string | null
  company_name: string | null
  next_step: string | null
  next_contact_at: string | null
  owner_profile_id: string | null
  owner_name: string | null
  requires_logistics: boolean | null
}

type TaskRecord = {
  id: string
  meeting_id: string | null
  title: string
  due_at: string | null
  priority: string | null
  status: string | null
  owner_profile_id: string | null
  owner_name: string | null
}

type LogisticsRecord = {
  id: string
  meeting_id: string | null
  title: string
  detail: string | null
  status: string | null
}

export default async function AgendaPage() {
  const supabase = await createClient()

  const [
    { data: profilesData },
    { data: leadsData },
    { data: clientsData },
    { data: meetingsData },
    { data: tasksData },
    { data: logisticsData },
  ] = await Promise.all([
    supabase.from('profiles').select('id, full_name').order('full_name'),
    supabase.from('leads').select('id, name, company, client_id').order('created_at', { ascending: false }),
    supabase.from('clientes').select('id, name, company_name').order('updated_at', { ascending: false }),
    supabase.from('meetings').select('id, title, scheduled_for, ends_at, location, meeting_type, status, objective, notes, lead_id, client_id, lead_name, company_name, next_step, next_contact_at, owner_profile_id, owner_name, requires_logistics').order('scheduled_for', { ascending: true }),
    supabase.from('meeting_tasks').select('id, meeting_id, title, due_at, priority, status, owner_profile_id, owner_name').order('due_at', { ascending: true }),
    supabase.from('meeting_logistics').select('id, meeting_id, title, detail, status').order('created_at', { ascending: true }),
  ])

  const profiles: AgendaProfile[] = (profilesData || []).map((p: ProfileRecord) => ({
    id: p.id,
    full_name: p.full_name || 'Usuario',
  }))

  const leads: AgendaLeadOption[] = (leadsData || []).map((lead: LeadRecord) => ({
    id: lead.id,
    label: lead.company ? `${lead.name} - ${lead.company}` : lead.name || 'Lead sem nome',
  }))

  const clientsById = new Map((clientsData || []).map((client: ClientRecord) => [
    client.id,
    client.company_name ? `${client.name} - ${client.company_name}` : client.name || 'Cliente sem nome',
  ]))

  const meetings: AgendaMeeting[] = (meetingsData || []).map((row: MeetingRecord) => ({
    id: row.id,
    title: row.title,
    scheduled_for: row.scheduled_for,
    ends_at: row.ends_at,
    location: row.location,
    meeting_type: row.meeting_type || 'Presencial',
    status: row.status || 'agendada',
    objective: row.objective,
    notes: row.notes,
    lead_id: row.lead_id,
    client_id: row.client_id || (row.lead_id ? (leadsData as LeadRecord[] || []).find((lead) => lead.id === row.lead_id)?.client_id || null : null),
    lead_name: row.lead_name,
    company_name: row.company_name,
    client_name: row.client_id ? clientsById.get(row.client_id) || null : null,
    next_step: row.next_step,
    next_contact_at: row.next_contact_at,
    owner_profile_id: row.owner_profile_id,
    owner_name: row.owner_name || 'Sem responsavel',
    requires_logistics: Boolean(row.requires_logistics),
  }))

  const tasks: AgendaTask[] = (tasksData || []).map((row: TaskRecord) => ({
    id: row.id,
    meeting_id: row.meeting_id,
    title: row.title,
    due_at: row.due_at,
    priority: row.priority || 'Media',
    status: row.status || 'aberta',
    owner_profile_id: row.owner_profile_id,
    owner_name: row.owner_name || 'Sem responsavel',
  }))

  const logisticsItems: AgendaLogisticsItem[] = (logisticsData || []).map((row: LogisticsRecord) => ({
    id: row.id,
    meeting_id: row.meeting_id,
    title: row.title,
    detail: row.detail,
    status: row.status || 'pendente',
  }))

  const fallbackProfiles: AgendaProfile[] = [{ id: 'fallback-1', full_name: 'Gestor' }]

  return (
    <AgendaManager
      leads={leads}
      logisticsItems={logisticsItems}
      meetings={meetings}
      profiles={profiles.length > 0 ? profiles : fallbackProfiles}
      setupMissing={false}
      tasks={tasks}
    />
  )
}
