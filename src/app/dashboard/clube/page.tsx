import { Suspense } from 'react'
import { getClubMembers, getClubDeliverables, getClubEvents } from '@/app/actions/clube'
import { getAllMembersOnboarding } from '@/app/actions/clube-onboarding'
import { createClient } from '@/lib/supabase/server'
import ClubeClient from './clube-client'

export const metadata = { title: 'Insider Club | Palin' }

export default async function ClubePage() {
  const supabase = await createClient()

  const [membersResult, deliverablesResult, eventsResult, profilesResult] = await Promise.all([
    getClubMembers(),
    getClubDeliverables(),
    getClubEvents(),
    supabase.from('profiles').select('id, full_name, avatar_url, role').eq('active', true).order('full_name'),
  ])

  const memberIds = membersResult.data.map(m => m.id)
  const onboardingMap = await getAllMembersOnboarding(memberIds)

  return (
    <Suspense fallback={<div style={{ padding: '40px', color: '#94a3b8' }}>Carregando Insider Club...</div>}>
      <ClubeClient
        initialMembers={membersResult.data}
        initialDeliverables={deliverablesResult.data}
        initialEvents={eventsResult.data}
        profiles={(profilesResult.data || []) as { id: string; full_name: string; avatar_url: string | null; role: string }[]}
        initialOnboardingMap={onboardingMap}
      />
    </Suspense>
  )
}
