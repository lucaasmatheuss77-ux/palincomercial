import 'server-only'
import { createClient } from '@/lib/supabase/server'

export type OverdueWorkItem = {
  subject?: string | null
  next_contact_at?: string | null
  lead?: { name?: string | null; stage?: string | null } | null
}

export type ScheduleItem = {
  type: string
  subject?: string | null
  lead?: string | null
  time: string
}

export interface AuraSystemContext {
  summary: {
    totalLeads: number
    hotLeads: number
    newLeads: number
    totalRevenue: number
    closedDeals: number
    contractsMeta: number
    revenueMeta: number
  }
  funnelStatus: Record<string, number>
  overdueWork: OverdueWorkItem[]
  upcomingSchedule: ScheduleItem[]
  topLeads: { name?: string; company?: string; estimated_value?: number; stage?: string; cnpj?: string }[]
  recentActivities: { id?: string; created_at?: string; description?: string; lead?: { name?: string } | null }[]
  products: { name: string; description?: string | null; matching_rules?: Record<string, unknown> | null }[]
  recentIntelligence: { lead_name: string; summary: string; created_at: string }[]
}

export class AuraAnalyzer {
  static async getSystemContext(): Promise<AuraSystemContext> {
    const supabase = await createClient()
    const now = new Date().toISOString()
    const today = now.split('T')[0]

    // Parallel fetch for deep context
    const [
      leadsRes,
      dealsRes,
      activitiesRes,
      eventsRes,
      settingsRes,
      productsRes,
      recentLogsRes,
      intelligenceLogsRes
    ] = await Promise.all([
      supabase.from('leads').select('*').order('updated_at', { ascending: false }).limit(200),
      supabase.from('deals').select('*, lead:leads(name)').order('closed_at', { ascending: false }).limit(20),
      supabase.from('commercial_activities').select('*, lead:leads(name, stage)').order('next_contact_at', { ascending: true }),
      supabase.from('events').select('*').gte('date', today).order('date', { ascending: true }).limit(10),
      supabase.from('settings').select('*'),
      supabase.from('products').select('name, description, matching_rules'),
      supabase.from('commercial_activities').select('*, lead:leads(name)').order('created_at', { ascending: false }).limit(15),
      supabase.from('lead_intelligence_history').select('*, lead:leads(name)').order('created_at', { ascending: false }).limit(5)
    ])

    const leads = leadsRes.data || []
    const deals = dealsRes.data || []
    const activities = activitiesRes.data || []
    const events = eventsRes.data || []
    const settings = settingsRes.data || []
    const products = productsRes.data || []
    const recentLogs = recentLogsRes.data || []
    const intelligenceLogs = (intelligenceLogsRes.data ?? []) as { lead?: { name?: string }; report_json?: { dor_principal?: string }; created_at: string }[]

    // ── Metrics Aggregation ───────────────────────────────────────
    
    // Funnel
    const funnelStatus: Record<string, number> = {}
    leads.forEach(l => {
      const stage = l.stage || 'Sem Etapa'
      funnelStatus[stage] = (funnelStatus[stage] || 0) + 1
    })

    // Leads logic
    const hotLeadsCount = leads.filter(l => ['Proposta Enviada', 'Negociação'].includes(l.stage)).length
    const newLeadsCount = leads.filter(l => ['Contato Inicial', 'Qualificação'].includes(l.stage)).length
    
    // Revenue logic
    const totalRevenue = deals.reduce((acc, d) => acc + (Number(d.value) || 0), 0)
    const closedCount = deals.length

    // Schedule logic
    const upcomingSchedule = [
      ...activities
        .filter(a => a.next_contact_at && a.next_contact_at >= now)
        .slice(0, 10)
        .map(a => ({
          type: 'Atividade',
          subject: a.subject || a.agenda || a.description,
          lead: a.lead?.name,
          time: a.next_contact_at
        })),
      ...events.map(e => ({
        type: 'Evento',
        subject: e.name,
        time: e.date
      }))
    ].sort((a, b) => (a.time! > b.time! ? 1 : -1))

    // Overdue Work
    const overdueWork = activities
      .filter(a => a.next_contact_at && a.next_contact_at < now && a.status !== 'concluida')
      .slice(0, 5)

    // Goals (from settings)
    const revenueMeta = Number(settings.find(s => s.key === 'revenue_meta')?.value) || 0
    const contractsMeta = Number(settings.find(s => s.key === 'contracts_meta')?.value) || 0

    // Top Leads (by estimated value or ICP match if available)
    const topLeads = leads
      .filter(l => l.estimated_value > 0 || l.cnpj)
      .sort((a, b) => (Number(b.estimated_value) || 0) - (Number(a.estimated_value) || 0))
      .slice(0, 10)

    return {
      summary: {
        totalLeads: leads.length,
        hotLeads: hotLeadsCount,
        newLeads: newLeadsCount,
        totalRevenue,
        closedDeals: closedCount,
        contractsMeta,
        revenueMeta
      },
      funnelStatus,
      overdueWork,
      upcomingSchedule,
      topLeads,
      recentActivities: recentLogs,
      products,
      recentIntelligence: intelligenceLogs.map((i) => ({
        lead_name: i.lead?.name || 'Lead',
        summary: i.report_json?.dor_principal || 'Análise técnica',
        created_at: i.created_at
      }))
    }
  }

  static formatContextForAI(context: AuraSystemContext): string {
    return `
=== CONTEXTO ESTRATÉGICO PALIN & MARTINS ===

RESUMO DE PERFORMANCE:
- Leads no Funil: ${context.summary.totalLeads}
- Metas de Contratos: ${context.summary.closedDeals} / ${context.summary.contractsMeta}
- Metas Financeiras: R$ ${context.summary.totalRevenue.toLocaleString('pt-BR')} / R$ ${context.summary.revenueMeta.toLocaleString('pt-BR')}

ETAPAS DO PIPELINE:
${Object.entries(context.funnelStatus).map(([stage, count]) => `- ${stage}: ${count}`).join('\n')}

LEADS DE ALTO POTENCIAL / RECENTES:
${context.topLeads.map(l => `- ${l.name} (${l.company || 'PJ'}): R$ ${Number(l.estimated_value || 0).toLocaleString('pt-BR')} - Etapa: ${l.stage}`).join('\n')}

ATIVIDADES RECENTES NO CRM:
${context.recentActivities.slice(0, 5).map(a => `- [${a.created_at ? new Date(a.created_at).toLocaleDateString() : '?'}] ${a.lead?.name}: ${a.description}`).join('\n')}

PORTFÓLIO DE PRODUTOS DISPONÍVEIS:
${context.products.map(p => `- ${p.name}: ${p.description || 'Consultoria tributária'}`).join('\n')}

PENDÊNCIAS CRÍTICAS:
${context.overdueWork.length > 0 
  ? context.overdueWork.map(o => `- ATRASADA: ${o.subject || 'Contato'} com ${o.lead?.name} (Vencida em ${o.next_contact_at ? new Date(o.next_contact_at).toLocaleDateString('pt-BR') : '?'})`).join('\n')
  : '- Nenhuma atividade em atraso aparente.'}

PRÓXIMOS COMPROMISSOS:
${context.upcomingSchedule.length > 0
  ? context.upcomingSchedule.slice(0, 3).map(s => `- ${new Date(s.time).toLocaleString('pt-BR')}: ${s.subject} (${s.type})`).join('\n')
  : '- Sem compromissos imediatos agendados.'}
${context.recentIntelligence.length > 0 ? `
ÚLTIMAS ANÁLISES DE INTELIGÊNCIA (4 AGENTES):
${context.recentIntelligence.map(i => `- ${i.lead_name}: ${i.summary} (${new Date(i.created_at).toLocaleDateString('pt-BR')})`).join('\n')}
` : ''}
===========================================
`
  }
}
