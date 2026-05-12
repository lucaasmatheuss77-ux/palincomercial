import { createClient } from '@/lib/supabase/server'
import { getEvents } from '@/app/actions/eventos'
import EventosClient, { EventItem, ProfileItem } from './eventos-client'

export const dynamic = 'force-dynamic'

export default async function EventosPage() {
  const supabase = await createClient()
  const [data, { data: profilesData }] = await Promise.all([
    getEvents(),
    supabase.from('profiles').select('id, full_name, role').order('full_name'),
  ])

  const profiles: ProfileItem[] = (profilesData || []).map(p => ({
    id: p.id,
    full_name: p.full_name ?? null,
    role: p.role ?? null,
  }))

  return <EventosClient initialEvents={data as unknown as EventItem[]} profiles={profiles} />
}
