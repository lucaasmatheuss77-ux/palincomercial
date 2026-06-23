import { createClient } from '@/lib/supabase/server'
import MobileHubClient from './mobile-client'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function MobileHubPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const currentUser = user || { id: 'demo-123', email: 'demo@palin.com', user_metadata: { full_name: 'Gestor' } }

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()

  const [leadsRes, agendaRes, meetingsTodayRes, overdueRes, profileRes] = await Promise.allSettled([
    supabase
      .from('leads')
      .select('id, name, stage, whatsapp, estimated_value, created_at, ai_score, cnpj, segmento_especifico, company')
      .order('updated_at', { ascending: false }),

    supabase
      .from('meetings')
      .select('id, title, scheduled_for')
      .eq('consultant_id', currentUser.id)
      .gte('scheduled_for', now.toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(5),

    supabase
      .from('meetings')
      .select('id')
      .eq('consultant_id', currentUser.id)
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
      .select('role, full_name, avatar_skin')
      .eq('email', currentUser.email!.toLowerCase())
      .maybeSingle(),
  ])

  const leads         = leadsRes.status === 'fulfilled' ? (leadsRes.value.data ?? []) : []
  const agenda        = agendaRes.status === 'fulfilled' ? (agendaRes.value.data ?? []) : []
  const meetingsToday = meetingsTodayRes.status === 'fulfilled' ? (meetingsTodayRes.value.data ?? []) : []
  const overdue       = overdueRes.status === 'fulfilled' ? (overdueRes.value.data ?? []) : []
  const profileData   = profileRes.status === 'fulfilled' ? profileRes.value.data : null

  const closedLeads = leads.filter(l => l.stage === 'Fechado')
  const activeLeads = leads.filter(l => l.stage !== 'Fechado' && l.stage !== 'Perdido')
  const lostLeads   = leads.filter(l => l.stage === 'Perdido')
  const resolved    = closedLeads.length + lostLeads.length
  const convRate    = resolved > 0 ? Math.round((closedLeads.length / resolved) * 100) : 0
  const hotLeads    = activeLeads.filter(l => ['Proposta', 'Proposta Enviada', 'Negociação', 'Negociacao'].includes(l.stage ?? '')).length

  const consultantName = profileData?.full_name || currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Consultor'
  const consultantRole = profileData?.role || 'Consultor'

  return (
    <MobileHubClient
      user={{ ...currentUser, user_metadata: { full_name: consultantName }, role: consultantRole, avatar_skin: profileData?.avatar_skin }}
      leads={leads}
      agenda={agenda}
      stats={{
        closedLeads:          closedLeads.length,
        activeLeads:          activeLeads.length,
        conversionRate:       convRate,
        hotLeads,
        reunioesHoje:         meetingsToday.length,
        atividadesAtrasadas:  overdue.length,
      }}
    />
  )
}
