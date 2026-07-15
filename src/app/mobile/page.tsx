import { createClient } from '@/lib/supabase/server'
import { listClienteOptions } from '@/app/actions/clientes'
import MobileHubClient from './mobile-client'

export const dynamic = 'force-dynamic'

type MobileSearchParams = {
  tab?: string | string[]
  leadId?: string | string[]
}

type MobileLeadRow = {
  id: string
  name: string
  stage?: string | null
  whatsapp?: string | null
  email?: string | null
  expected_value?: number | string | null
  created_at?: string | null
  segmento_especifico?: string | null
  cnpj?: string | null
  company?: string | null
  client_id?: string | null
}

type MobileClientRow = {
  id: string
  origin_lead_id?: string | null
  documento?: string | null
  company_name?: string | null
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
}

function getParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] || '' : value || ''
}

function isUuid(value?: string | null) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
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
  const userId = isUuid(currentUser.id) ? currentUser.id : null
  let agendaQuery = supabase
    .from('meetings')
    .select('id, title, scheduled_for, client_name:lead_name, location')
    .gte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(8)

  if (userId) {
    agendaQuery = agendaQuery.eq('owner_profile_id', userId)
  }

  let meetingsTodayQuery = supabase
    .from('meetings')
    .select('id')
    .gte('scheduled_for', todayStart)
    .lte('scheduled_for', todayEnd)

  if (userId) {
    meetingsTodayQuery = meetingsTodayQuery.eq('owner_profile_id', userId)
  }

  const [leadsRes, clientLinksRes, agendaRes, meetingsTodayRes, overdueRes, profileRes] = await Promise.allSettled([
    supabase
      .from('leads')
      .select('id, name, stage, whatsapp, email, expected_value, created_at, segmento_especifico, cnpj:cnpj_cpf, company:company_name')
      .order('updated_at', { ascending: false })
      .limit(10000),

    supabase
      .from('clientes')
      .select('id, origin_lead_id, documento, company_name, email, phone, whatsapp')
      .not('origin_lead_id', 'is', null)
      .limit(10000),

    agendaQuery,

    meetingsTodayQuery,

    supabase
      .from('commercial_activities')
      .select('id')
      .eq('consultant_id', userId || '00000000-0000-0000-0000-000000000000')
      .lt('next_contact_at', now.toISOString())
      .neq('status', 'concluida'),

    supabase
      .from('app_users')
      .select('role, full_name')
      .eq('email', currentUser.email!.toLowerCase())
      .maybeSingle(),
  ])

  const rawLeads      = leadsRes.status === 'fulfilled' ? ((leadsRes.value.data ?? []) as MobileLeadRow[]) : []
  const clientLinks   = clientLinksRes.status === 'fulfilled' ? ((clientLinksRes.value.data ?? []) as MobileClientRow[]) : []
  const clientByLead  = new Map(clientLinks.filter(client => client.origin_lead_id).map(client => [client.origin_lead_id as string, client]))
  const leads         = rawLeads.map((lead) => {
    const client = clientByLead.get(lead.id)
    return {
      ...lead,
      client_id: client?.id ?? lead.client_id ?? null,
      cnpj: lead.cnpj ?? client?.documento ?? null,
      company: lead.company ?? client?.company_name ?? null,
      email: lead.email ?? client?.email ?? null,
      whatsapp: lead.whatsapp ?? client?.whatsapp ?? client?.phone ?? null,
    }
  })
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
