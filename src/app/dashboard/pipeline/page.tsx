import { createClient } from '@/lib/supabase/server'
import PipelineBoard, { LeadType, Stage } from './pipeline-board'
export const dynamic = 'force-dynamic'


type LeadWithAiMeta = LeadType & {
  client_id: string | null
  ai_updated_at: string | null
  ai_freshness_minutes: number | null
  ai_freshness_label: string
  ai_is_fresh: boolean
  client_status_label: string
  contract_status_label: string | null
  contract_number: string | null
  contract_valid_until: string | null
  contract_pdf_name: string | null
}

type ClientRecord = {
  id: string
  origin_lead_id: string | null
  status_cliente: string | null
  active_contract_id: string | null
}

type LeadTimeline = {
  leadId: string
  meetings: Array<{
    id: string
    title: string
    scheduled_for: string
    ends_at: string | null
    location: string | null
    meeting_type: string | null
    status: string
    objective: string | null
    notes: string | null
    next_step: string | null
    next_contact_at: string | null
    owner_name: string
    created_at: string | null
  }>
  activities: Array<{
    id: string
    activity_type: string | null
    subject: string
    agenda: string | null
    summary: string | null
    next_step: string | null
    next_contact_at: string | null
    status: string | null
    created_at: string | null
  }>
}

function formatAiFreshness(minutes: number | null) {
  if (minutes === null || Number.isNaN(minutes)) return 'sem atualização'
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours}h`

  const days = Math.floor(hours / 24)
  if (days < 7) return `há ${days}d`

  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `há ${weeks} sem`

  const months = Math.floor(days / 30)
  return `há ${Math.max(1, months)} mes${months > 1 ? 'es' : ''}`
}

type PipelinePageSearchParams = {
  lead?: string | string[]
}

export default async function PipelinePage({
  searchParams,
}: {
  searchParams?: PipelinePageSearchParams | Promise<PipelinePageSearchParams>
} = {}) {
  const resolvedSearchParams = await searchParams
  const selectedLeadId = Array.isArray(resolvedSearchParams?.lead)
    ? resolvedSearchParams?.lead[0] || null
    : resolvedSearchParams?.lead || null

  const supabase = await createClient()

  const [{ data: leadsData }, { data: productsData }, { data: profilesData }, aiResult, contractsResult, clientsResult] = await Promise.all([
    supabase
      .from('leads')
      .select(`
        id, name, company, stage, estimated_value, created_at, notes,
        phone, whatsapp, email,
        client_id,
        product_id, consultant_id,
        product:products(id, name),
        consultant:profiles!consultant_id(id, full_name)
      `)
      .order('created_at', { ascending: false }),
    supabase.from('products').select('id, name').order('name'),
    supabase.from('profiles').select('id, full_name').order('full_name'),
    supabase.from('ai_qualifications').select('lead_id, status, score, source, summary, updated_at'),
    supabase.from('contracts').select('id, lead_id, client_id, contract_number, status, value, signed_at, notes, start_at, end_at, pdf_file_name, created_at, updated_at'),
    supabase.from('clientes').select('id, origin_lead_id, status_cliente, active_contract_id'),
  ])

  const aiRecords = ((aiResult.error ? [] : aiResult.data) || []) as Array<{
    lead_id: string
    status: string | null
    score: number | string | null
    source: string | null
    summary: string | null
    updated_at: string | null
  }>

  const { data: meetingRowsRaw } = await supabase
    .from('meetings')
    .select('id, title, scheduled_for, ends_at, location, meeting_type, status, lead_id, lead_name, company_name, objective, notes, next_step, next_contact_at, owner_name, created_at')
    .not('lead_id', 'is', null)
    .order('updated_at', { ascending: false })

  const meetingRows = (meetingRowsRaw || []) as Array<{
    id: string
    title: string
    scheduled_for: string
    ends_at: string | null
    location: string | null
    meeting_type: string | null
    status: string
    lead_id: string | null
    lead_name: string | null
    company_name: string | null
    objective: string | null
    notes: string | null
    next_step: string | null
    next_contact_at: string | null
    owner_name: string | null
    created_at: string | null
  }>

  const { data: activityRows = [] } = await supabase
    .from('commercial_activities')
    .select('id, lead_id, activity_type, subject, agenda, summary, next_step, next_contact_at, status, created_at')
    .not('lead_id', 'is', null)
    .order('created_at', { ascending: false })

  const activityRecords = (activityRows || []) as Array<{
    id: string
    lead_id: string | null
    activity_type: string | null
    subject: string
    agenda: string | null
    summary: string | null
    next_step: string | null
    next_contact_at: string | null
    status: string | null
    created_at: string | null
  }>

  const aiByLead = new Map(aiRecords.map((item) => [item.lead_id, item]))
  const contractRecords = ((contractsResult.error ? [] : contractsResult.data) || []) as Array<{
    id: string
    lead_id: string | null
    client_id: string | null
    contract_number: string | null
    status: string | null
    value: number | string | null
    signed_at: string | null
    notes: string | null
    start_at: string | null
    end_at: string | null
    pdf_file_name: string | null
    created_at: string | null
    updated_at: string | null
  }>
  const clientRecords = ((clientsResult.error ? [] : clientsResult.data) || []) as ClientRecord[]
  const clientById = new Map(clientRecords.map((client) => [client.id, client]))
  const clientByLead = clientRecords.reduce<Map<string, ClientRecord>>((acc, client) => {
    if (client.origin_lead_id) acc.set(client.origin_lead_id, client)
    return acc
  }, new Map())
  const contractByLead = contractRecords.reduce<Map<string, (typeof contractRecords)[number]>>((acc, contract) => {
    if (!contract.lead_id) return acc
    const current = acc.get(contract.lead_id)
    if (!current) {
      acc.set(contract.lead_id, contract)
      return acc
    }

    const currentTime = new Date(current.updated_at || current.created_at || 0).getTime()
    const candidateTime = new Date(contract.updated_at || contract.created_at || 0).getTime()
    if (candidateTime >= currentTime) acc.set(contract.lead_id, contract)
    return acc
  }, new Map())
  const contractByClient = contractRecords.reduce<Map<string, (typeof contractRecords)[number]>>((acc, contract) => {
    if (!contract.client_id) return acc
    const current = acc.get(contract.client_id)
    if (!current) {
      acc.set(contract.client_id, contract)
      return acc
    }

    const currentTime = new Date(current.updated_at || current.created_at || 0).getTime()
    const candidateTime = new Date(contract.updated_at || contract.created_at || 0).getTime()
    if (candidateTime >= currentTime) acc.set(contract.client_id, contract)
    return acc
  }, new Map())

  const meetingsByLead = meetingRows.reduce<Map<string, LeadTimeline['meetings']>>((acc, meeting) => {
    if (!meeting.lead_id) return acc
    const current = acc.get(meeting.lead_id) || []
    current.push({
      id: meeting.id,
      title: meeting.title,
      scheduled_for: meeting.scheduled_for,
      ends_at: meeting.ends_at,
      location: meeting.location,
      meeting_type: meeting.meeting_type,
      status: meeting.status,
      objective: meeting.objective,
      notes: meeting.notes,
      next_step: meeting.next_step,
      next_contact_at: meeting.next_contact_at,
      owner_name: meeting.owner_name || 'Sem responsavel',
      created_at: meeting.created_at,
    })
    acc.set(meeting.lead_id, current)
    return acc
  }, new Map())

  const activitiesByLead = activityRecords.reduce<Map<string, LeadTimeline['activities']>>((acc, activity) => {
    if (!activity.lead_id) return acc
    const current = acc.get(activity.lead_id) || []
    current.push({
      id: activity.id,
      activity_type: activity.activity_type,
      subject: activity.subject,
      agenda: activity.agenda,
      summary: activity.summary,
      next_step: activity.next_step,
      next_contact_at: activity.next_contact_at,
      status: activity.status,
      created_at: activity.created_at,
    })
    acc.set(activity.lead_id, current)
    return acc
  }, new Map())

  function addMonths(value: string | null, months: number) {
    if (!value) return null
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return null
    parsed.setMonth(parsed.getMonth() + months)
    return parsed.toISOString()
  }

  function readNoteTag(notes: string | null, tag: string) {
    if (!notes) return null
    const match = notes.match(new RegExp(`\\[\\[${tag}:(.*?)\\]\\]`))
    return match?.[1]?.trim() || null
  }

  function classifyClientStatus(contract?: (typeof contractRecords)[number], clientStatus?: string | null) {
    if (!contract) {
      return {
        client_status_label: clientStatus === 'aguardando_contrato' ? 'Contrato pendente' : 'Cliente criado',
        contract_status_label: null,
        contract_number: null,
        contract_valid_until: null,
        contract_pdf_name: null,
      }
    }

    const baseDate = contract.start_at || readNoteTag(contract.notes, 'CONTRACT_START') || contract.signed_at || contract.created_at || null
    const contractValidUntil = contract.end_at || readNoteTag(contract.notes, 'VALID_UNTIL') || addMonths(baseDate, 12)
    const daysToExpire = contractValidUntil
      ? Math.floor((new Date(contractValidUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null

    if (contract.status === 'cancelado') {
      return {
        client_status_label: 'Contrato cancelado',
        contract_status_label: 'Cancelado',
        contract_number: contract.contract_number || null,
        contract_valid_until: contractValidUntil,
        contract_pdf_name: contract.pdf_file_name || readNoteTag(contract.notes, 'PDF_NAME'),
      }
    }

    if (contract.status === 'vencido' || (daysToExpire !== null && daysToExpire < 0)) {
      return {
        client_status_label: 'Vencido',
        contract_status_label: 'Vencido',
        contract_number: contract.contract_number || null,
        contract_valid_until: contractValidUntil,
        contract_pdf_name: contract.pdf_file_name || readNoteTag(contract.notes, 'PDF_NAME'),
      }
    }

    if (contract.status === 'ativo' || contract.signed_at) {
      return {
        client_status_label: daysToExpire !== null && daysToExpire <= 30 ? 'A vencer' : 'Contrato ativo',
        contract_status_label: daysToExpire !== null && daysToExpire <= 30 ? 'A vencer' : 'Ativo',
        contract_number: contract.contract_number || null,
        contract_valid_until: contractValidUntil,
        contract_pdf_name: contract.pdf_file_name || readNoteTag(contract.notes, 'PDF_NAME'),
      }
    }

    return {
      client_status_label: 'Contrato pendente',
      contract_status_label: 'Pendente',
      contract_number: contract.contract_number || null,
      contract_valid_until: contractValidUntil,
      contract_pdf_name: contract.pdf_file_name || readNoteTag(contract.notes, 'PDF_NAME'),
    }
  }

  const stageMap: Record<string, Stage> = {
    'Contato Inicial': 'Contato Inicial',
    Lead: 'Contato Inicial',
    Qualificacao: 'Qualificacao',
    Qualificado: 'Qualificacao',
    Apresentacao: 'Apresentacao',
    Diagnostico: 'Apresentacao',
    Proposta: 'Proposta',
    Negociacao: 'Negociacao',
    Fechado: 'Fechado',
    Perdido: 'Perdido',
  }

  type SupabaseLeadRow = {
    id: string
    name: string
    company: string | null
    estimated_value: number | string | null
    created_at: string
    phone: string | null
    whatsapp: string | null
    email: string | null
    notes: string | null
    product_id: string | null
    consultant_id: string | null
    stage: string
    product?: Array<{ name: string | null }>
    consultant?: Array<{ full_name: string | null }>
    client_id: string | null
  }

  type AiQualificationRow = {
    lead_id: string
    status: string | null
    score: number | string | null
    source: string | null
    summary: string | null
    updated_at: string | null
  }

  type ProductRow = {
    id: string
    name: string
  }

  type ProfileRow = {
    id: string
    full_name: string
  }

  const mappedLeads: LeadWithAiMeta[] = (leadsData || []).map((lead: SupabaseLeadRow) => {
    const ai = aiByLead.get(lead.id) as AiQualificationRow | undefined
    const aiUpdatedAt = ai?.updated_at || null
    const aiFreshnessMinutes = aiUpdatedAt ? Math.max(0, Math.floor((Date.now() - new Date(aiUpdatedAt).getTime()) / (1000 * 60))) : null
    const client = (lead.client_id ? clientById.get(lead.client_id) : null) || clientByLead.get(lead.id) || null
    const clientId = lead.client_id || client?.id || null
    const contract = contractByLead.get(lead.id) || (clientId ? contractByClient.get(clientId) : undefined)
    const contractInfo = classifyClientStatus(contract, client?.status_cliente)

    return {
      id: lead.id,
      name: lead.name,
      company: lead.company || '',
      product: Array.isArray(lead.product) ? lead.product[0]?.name || 'Geral' : 'Geral',
      product_id: lead.product_id || '',
      consultant: Array.isArray(lead.consultant) ? lead.consultant[0]?.full_name?.split(' ')[0] || 'Time Palin' : 'Time Palin',
      consultant_id: lead.consultant_id || '',
      value: Number(lead.estimated_value) || 0,
      days: Math.max(0, Math.floor((Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24))),
      stage: stageMap[lead.stage] || 'Contato Inicial',
      phone: lead.phone || '',
      whatsapp: lead.whatsapp || '',
      email: lead.email || '',
      notes: lead.notes || null,
      ai_status: ai?.status || '',
      ai_score: Number(ai?.score || 0),
      ai_source: ai?.source || '',
      ai_summary: ai?.summary || '',
      client_id: clientId,
      ai_updated_at: aiUpdatedAt,
      ai_freshness_minutes: aiFreshnessMinutes,
      ai_freshness_label: formatAiFreshness(aiFreshnessMinutes),
      ai_is_fresh: aiFreshnessMinutes !== null && aiFreshnessMinutes <= 60 * 24 * 7,
      client_status_label: contractInfo.client_status_label,
      contract_status_label: contractInfo.contract_status_label,
      contract_number: contractInfo.contract_number,
      contract_valid_until: contractInfo.contract_valid_until,
      contract_pdf_name: contractInfo.contract_pdf_name,
    }
  })

  // Calculate latest AI freshness and lead timelines
  const timelinesMapped = mappedLeads.map((lead) => ({
    leadId: lead.id,
    meetings: meetingsByLead.get(lead.id) || [],
    activities: activitiesByLead.get(lead.id) || [],
  }))

  const allAiTimestamps = mappedLeads
    .map((l) => l.ai_updated_at ? new Date(l.ai_updated_at).getTime() : null)
    .filter((t): t is number => t !== null)

  const latestAiTimestamp = allAiTimestamps.length > 0 ? Math.max(...allAiTimestamps) : null
  const latestAiFreshnessMinutes = latestAiTimestamp
    ? Math.floor((Date.now() - latestAiTimestamp) / (1000 * 60))
    : null

  const products = (productsData || []).map((p: ProductRow) => ({ id: p.id, name: p.name }))
  const consultants = (profilesData || []).map((p: ProfileRow) => ({ id: p.id, name: p.full_name }))

  return (
    <PipelineBoard
      initialLeads={mappedLeads}
      products={products}
      consultants={consultants}
      leadTimelines={timelinesMapped}
      initialSelectedLeadId={selectedLeadId}
      latestAiFreshnessMinutes={latestAiFreshnessMinutes}
    />
  )
}


