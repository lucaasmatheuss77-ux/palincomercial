import { createClient } from '@/lib/supabase/server'
import { listClienteOptions } from '@/app/actions/clientes'
import MobileHubClient from './mobile-client'

export const dynamic = 'force-dynamic'

type MobileSearchParams = {
  tab?: string | string[]
  leadId?: string | string[]
}

function getParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] || '' : value || ''
}

export default async function PocketCRMPage({ searchParams }: { searchParams?: MobileSearchParams | Promise<MobileSearchParams> } = {}) {
  const params = await searchParams
  const initialTab = getParam(params?.tab)
  const initialLeadId = getParam(params?.leadId)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const currentUser = user || { id: '', email: 'mobile@palin.local', user_metadata: { full_name: 'Mobile' } }

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()

  const [leadsRes, agendaRes, meetingsTodayRes, overdueRes, profileRes] = await Promise.allSettled([
    supabase
      .from('leads')
      .select('id, name, stage, whatsapp, expected_value, created_at, segmento_especifico, client_id, company:company_name')
      .order('updated_at', { ascending: false })
      .limit(10000),

    supabase
      .from('meetings')
      .select('id, title, scheduled_for, client_name:lead_name, location')
      .eq('owner_profile_id', currentUser.id)
      .gte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(5),

    supabase
      .from('meetings')
      .select('id')
      .eq('owner_profile_id', currentUser.id)
      .gte('scheduled_for', todayStart)
      .lte('scheduled_for', todayEnd),

    supabase
      .from('commercial_activities')
      .select('id')
      .eq('consultant_id', currentUser.id)
      .lt('next_contact_at', now.toISOString())
      .neq('status', 'concluida'),

    supabase
      .from('app_users')
      .select('role, full_name')
      .eq('email', currentUser.email!.toLowerCase())
      .maybeSingle(),
  ])

  const leads         = leadsRes.status === 'fulfilled' ? (leadsRes.value.data ?? []) : []
  const agenda        = agendaRes.status === 'fulfilled' ? (agendaRes.value.data ?? []) : []
  const meetingsToday = meetingsTodayRes.status === 'fulfilled' ? (meetingsTodayRes.value.data ?? []) : []
  const overdue       = overdueRes.status === 'fulfilled' ? (overdueRes.value.data ?? []) : []
  const profileData   = profileRes.status === 'fulfilled' ? profileRes.value.data : null

  const closedLeads  = leads.filter(l => l.stage === 'Fechado')
  const activeLeads  = leads.filter(l => l.stage !== 'Fechado' && l.stage !== 'Perdido')
  const lostLeads    = leads.filter(l => l.stage === 'Perdido')
  const resolved     = closedLeads.length + lostLeads.length
  const convRate     = resolved > 0 ? Math.round((closedLeads.length / resolved) * 100) : 0

  // Leads quentes: Proposta + Negociação
  const hotLeads = activeLeads.filter(l =>
    ['Proposta', 'Proposta Enviada', 'Negociação', 'Negociacao'].includes(l.stage ?? '')
  ).length

  const stats = {
    closedLeads:          closedLeads.length,
    activeLeads:          activeLeads.length,
    conversionRate:       convRate,
    hotLeads,
    reunioesHoje:         meetingsToday.length,
    atividadesAtrasadas:  overdue.length,
  }

  const consultantName = profileData?.full_name || currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Consultor'
  const consultantRole = profileData?.role || 'Consultor'
  const clientes = await listClienteOptions()

  return (
    <main style={{ minHeight: '100dvh', background: '#010409' }}>
      <MobileHubClient
        user={{ ...currentUser, user_metadata: { full_name: consultantName }, role: consultantRole }}
        leads={leads}
        clientes={clientes}
        agenda={agenda}
        initialTab={initialTab}
        initialLeadId={initialLeadId}
        stats={stats}
      />
    </main>
  )
}
