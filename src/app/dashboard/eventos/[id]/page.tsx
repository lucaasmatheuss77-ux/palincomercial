import { notFound } from 'next/navigation'
import { getEvent, getEventParticipants, getEventStaff, getEventChecklist } from '@/app/actions/eventos'
import EventDashboardClient from './event-dashboard-client'

import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function EventManagementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const event = await getEvent(id)
  if (!event) return notFound()

  const participants = await getEventParticipants(id)
  const staff = await getEventStaff(id)
  const checklist = await getEventChecklist(id)

  const supabase = await createClient()
  const { data: profiles } = await supabase.from('profiles').select('id, full_name, role')

  return (
    <EventDashboardClient
      event={event}
      initialParticipants={participants}
      initialStaff={staff}
      initialChecklist={checklist}
      profiles={profiles || []}
    />
  )
}
