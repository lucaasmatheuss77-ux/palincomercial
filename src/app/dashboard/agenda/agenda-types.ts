export type AgendaProfile = {
  id: string
  full_name: string
}

export type AgendaLeadOption = {
  id: string
  label: string
}

export type AgendaMeeting = {
  id: string
  title: string
  scheduled_for: string
  ends_at: string | null
  location: string | null
  meeting_type: string | null
  status: string
  objective: string | null
  notes: string | null
  lead_id: string | null
  lead_name: string | null
  company_name: string | null
  client_id: string | null
  client_name: string | null
  next_step: string | null
  next_contact_at: string | null
  owner_profile_id: string | null
  owner_name: string
  requires_logistics: boolean
}

export type AgendaTask = {
  id: string
  meeting_id: string | null
  title: string
  due_at: string | null
  priority: string
  status: string
  owner_profile_id: string | null
  owner_name: string
}

export type AgendaLogisticsItem = {
  id: string
  meeting_id: string | null
  title: string
  detail: string | null
  status: string
}
