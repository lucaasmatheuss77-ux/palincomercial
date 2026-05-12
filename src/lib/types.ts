export type Profile = {
  id: string
  full_name: string
  email: string
  role: string
  avatar_url: string | null
  xp: number
  level: number
  class: string
}

export interface EventDbResult {
  id: string
  name: string
  type: string
  date: string
  location: string | null
  capacity: number | null
  status: string | null
  event_participants: { count: number }[]
  products: { name: string } | null
  ends_at: string | null
  description: string | null
  current_stage: string | null
  organizer_name: string | null
  organizer_contact: string | null
  participation_type: string | null
  investment: number
  expected_leads: number
  objectives: string | null
  notes_logistics: string | null
}

export interface ChecklistItem {
  id: string
  event_id: string
  title: string
  done: boolean
  due_at: string | null
  assigned_to: string | null
  assigned_name: string | null
  created_at: string
}
