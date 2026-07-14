import { createClient } from '@/lib/supabase/server'
import { listClientServicesByClients } from '@/app/actions/client-services'
import ClientesClient, { type ClientRow } from './clientes-client'

export const dynamic = 'force-dynamic'

type ClientRecord = {
  id: string
  origin_lead_id: string | null
  name: string
  company_name: string | null
  documento: string | null
  segmento: string | null
  cidade: string | null
  estado: string | null
  notas: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  status_cliente: string | null
  consultant_id: string | null
  product_id: string | null
  active_contract_id: string | null
  created_at: string | null
  updated_at: string | null
}

type LeadRecord = {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  created_at: string | null
}

type ContractRecord = {
  id: string
  deal_id: string | null
  lead_id: string | null
  client_id: string | null
  product_id: string | null
  consultant_id: string | null
  contract_number: string | null
  status: string | null
  value: number | string | null
  start_date: string | null
  end_date: string | null
  signed_at: string | null
  notes: string | null
  pdf_bucket: string | null
  pdf_path: string | null
  pdf_file_name: string | null
  pdf_mime_type: string | null
  pdf_uploaded_at: string | null
  cancellation_reason: string | null
  signing_url: string | null
  created_at: string | null
  updated_at: string | null
}

type ContractDocumentRecord = {
  id: string
  contract_id: string | null
  client_id: string | null
  kind: string | null
  bucket: string | null
  path: string | null
  file_name: string | null
  mime_type: string | null
  file_size: number | string | null
  version: number | null
  uploaded_at: string | null
}

type CommercialActivityRecord = {
  id: string
  lead_id: string | null
  deal_id: string | null
  client_id: string | null
  contract_id: string | null
  meeting_id: string | null
  activity_type: string | null
  subject: string
  agenda: string | null
  summary: string | null
  next_step: string | null
  next_contact_at: string | null
  status: string | null
  created_at: string | null
}

type MeetingRecord = {
  id: string
  lead_id: string | null
  client_id: string | null
  title: string
  scheduled_for: string
  ends_at: string | null
  meeting_type: string | null
  status: string
  objective: string | null
  notes: string | null
  next_step: string | null
  next_contact_at: string | null
  owner_name: string | null
  created_at: string | null
  updated_at: string | null
}

type DealRecord = {
  id: string
  lead_id: string | null
}

type ProductRecord = {
  id: string
  name: string | null
}

type ProfileRecord = {
  id: string
  full_name: string | null
}

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

function buildHistoryEntries(contract: ContractRecord | null | undefined, documents: ContractDocumentRecord[]) {
  const history: Array<{
    title: string
    detail: string
    date: string | null
    tone: 'info' | 'success' | 'warning' | 'muted'
  }> = []

  if (!contract) return history

  history.push({
    title: 'Contrato registrado',
    detail: contract.contract_number ? `Contrato ${contract.contract_number}` : 'Registro inicial do contrato',
    date: contract.created_at,
    tone: 'info',
  })

  if (contract.signed_at) {
    history.push({
      title: 'Assinatura concluida',
      detail: 'Contrato sinalizado como assinado',
      date: contract.signed_at,
      tone: contract.status === 'ativo' ? 'success' : 'info',
    })
  }

  if (contract.status === 'renovado') {
    history.push({
      title: 'Contrato renovado',
      detail: 'Contrato anterior arquivado para iniciar um novo ciclo',
      date: contract.updated_at || contract.created_at,
      tone: 'success',
    })
  }

  const pdfDocuments = documents
    .filter((document) => document.kind === 'contract_pdf')
    .sort((left, right) => new Date(right.uploaded_at || 0).getTime() - new Date(left.uploaded_at || 0).getTime())

  pdfDocuments.slice(0, 5).forEach((document) => {
    history.push({
      title: document.version ? `PDF enviado v${document.version}` : 'PDF enviado',
      detail: document.file_name || document.path || 'Arquivo do contrato',
      date: document.uploaded_at,
      tone: 'warning',
    })
  })

  if (contract.updated_at && contract.updated_at !== contract.created_at) {
    history.push({
      title: 'Contrato atualizado',
      detail: contract.status || 'Atualizacao recente',
      date: contract.updated_at,
      tone: 'muted',
    })
  }

  if (contract.status === 'cancelado') {
    history.push({
      title: 'Contrato cancelado',
      detail: contract.cancellation_reason || 'Cancelamento registrado',
      date: contract.updated_at || contract.signed_at || contract.created_at,
      tone: 'warning',
    })
  }

  return history
}

function buildCommercialHistoryEntry(
  kind: 'meeting' | 'activity',
  item: MeetingRecord | CommercialActivityRecord
) {
  if (kind === 'meeting') {
    const meeting = item as MeetingRecord
    return {
      title: `Reunião - ${meeting.title}`,
      detail: [
        meeting.objective ? `Pauta: ${meeting.objective}` : null,
        meeting.notes ? `Falado: ${meeting.notes}` : null,
        meeting.next_step ? `Próximo passo: ${meeting.next_step}` : null,
      ].filter(Boolean).join(' • ') || 'Reunião vinculada ao cliente.',
      date: meeting.scheduled_for || meeting.created_at,
      tone: meeting.status === 'concluida' ? 'success' : meeting.status === 'confirmada' ? 'info' : 'warning',
    } as const
  }

  const activity = item as CommercialActivityRecord
  return {
    title: activity.subject || 'Atividade comercial',
    detail: [
      activity.agenda ? `Pauta: ${activity.agenda}` : null,
      activity.summary ? `Resumo: ${activity.summary}` : null,
      activity.next_step ? `Próximo passo: ${activity.next_step}` : null,
    ].filter(Boolean).join(' • ') || 'Atividade registrada no processo.',
    date: activity.created_at,
    tone: activity.activity_type === 'fechamento' ? 'success' : activity.activity_type === 'reuniao' ? 'info' : 'muted',
  } as const
}

async function createSignedUrlMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  targets: Array<{ bucket: string; path: string }>
) {
  const uniqueTargets = Array.from(new Map(targets.map((target) => [`${target.bucket}:${target.path}`, target])).values())
  const signedEntries = await Promise.all(
    uniqueTargets.map(async (target) => {
      try {
        const { data } = await supabase.storage.from(target.bucket).createSignedUrl(target.path, 60 * 60)
        return [`${target.bucket}:${target.path}`, data?.signedUrl || null] as const
      } catch (error) {
        console.warn('Não foi possível gerar URL assinada do contrato:', target.bucket, target.path, error)
        return [`${target.bucket}:${target.path}`, null] as const
      }
    })
  )

  return new Map<string, string | null>(signedEntries)
}

function getClientStatus(contract?: ContractRecord | null, clientStatus?: string | null) {
  if (!contract) {
    return {
      client_status_label: clientStatus === 'aguardando_contrato' ? 'Contrato pendente' : 'Cliente criado',
      contract_status_label: 'Sem contrato',
      contract_valid_until: null as string | null,
      days_to_expire: null as number | null,
    }
  }

  const baseDate = contract.start_date || readNoteTag(contract.notes, 'CONTRACT_START') || contract.signed_at || contract.created_at || null
  const contractValidUntil = contract.end_date || readNoteTag(contract.notes, 'VALID_UNTIL') || addMonths(baseDate, 12)
  const daysToExpire = contractValidUntil
    ? Math.floor((new Date(contractValidUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  if (contract.status === 'cancelado') {
    return {
      client_status_label: 'Contrato cancelado',
      contract_status_label: 'Cancelado',
      contract_valid_until: contractValidUntil,
      days_to_expire: daysToExpire,
    }
  }

  if (contract.status === 'vencido' || (daysToExpire !== null && daysToExpire < 0)) {
    return {
      client_status_label: 'Vencido',
      contract_status_label: 'Vencido',
      contract_valid_until: contractValidUntil,
      days_to_expire: daysToExpire,
    }
  }

  if (contract.status === 'ativo' || contract.signed_at) {
    return {
      client_status_label: daysToExpire !== null && daysToExpire <= 365 ? 'A vencer' : 'Contrato ativo',
      contract_status_label: daysToExpire !== null && daysToExpire <= 365 ? 'A vencer' : 'Ativo',
      contract_valid_until: contractValidUntil,
      days_to_expire: daysToExpire,
    }
  }

  return {
    client_status_label: 'Contrato pendente',
    contract_status_label: 'Pendente',
    contract_valid_until: contractValidUntil,
    days_to_expire: daysToExpire,
  }
}

type ClientesPageSearchParams = {
  cliente?: string | string[]
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams?: ClientesPageSearchParams | Promise<ClientesPageSearchParams>
} = {}) {
  const resolvedSearchParams = await searchParams
  const selectedClientId = Array.isArray(resolvedSearchParams?.cliente)
    ? resolvedSearchParams?.cliente[0] || null
    : resolvedSearchParams?.cliente || null

  const supabase = await createClient()

  try {
    const queryResults = await Promise.allSettled([
      supabase.from('clientes').select('*').order('updated_at', { ascending: false }),
      supabase.from('leads').select('id, name, company, email, phone, whatsapp, created_at').limit(10000),
      supabase.from('contracts').select(
        'id, deal_id, lead_id, client_id, product_id, consultant_id, contract_number, status, value, start_date, end_date, signed_at, notes, pdf_bucket, pdf_path, pdf_file_name, pdf_mime_type, pdf_uploaded_at, cancellation_reason, created_at, updated_at'
      ),
      supabase.from('deals').select('id, lead_id'),
      supabase.from('contract_documents').select('id, contract_id, client_id, kind, bucket, path, file_name, mime_type, file_size, version, uploaded_at'),
      supabase.from('commercial_activities').select('id, lead_id, deal_id, client_id, contract_id, meeting_id, activity_type, subject, agenda, summary, next_step, next_contact_at, status, created_at'),
      supabase.from('client_meetings').select('*'),
      supabase.from('products').select('id, name'),
      supabase.from('profiles').select('id, full_name'),
    ])

    const [
      clientsResult,
      leadsResult,
      contractsResult,
      dealsResult,
      documentsResult,
      activitiesResult,
      clientMeetingsResult,
      productsResult,
      profilesResult,
    ] = queryResults

    const clients = (clientsResult.status === 'fulfilled' ? (clientsResult.value.data ?? []) : []) as ClientRecord[]
    const clientServices = await listClientServicesByClients(clients.map((client) => client.id))
    const servicesByClient = new Map<string, typeof clientServices>()
    for (const service of clientServices) {
      const list = servicesByClient.get(service.client_id) || []
      list.push(service)
      servicesByClient.set(service.client_id, list)
    }
    const leads = (leadsResult.status === 'fulfilled' ? (leadsResult.value.data ?? []) : []) as LeadRecord[]
    const contracts = (contractsResult.status === 'fulfilled' ? (contractsResult.value.data ?? []) : []) as ContractRecord[]
    const deals = (dealsResult.status === 'fulfilled' ? (dealsResult.value.data ?? []) : []) as DealRecord[]
    const documents = (documentsResult.status === 'fulfilled' ? (documentsResult.value.data ?? []) : []) as ContractDocumentRecord[]
    const activities = (activitiesResult.status === 'fulfilled' ? (activitiesResult.value.data ?? []) : []) as CommercialActivityRecord[]
    const clientMeetings = (clientMeetingsResult.status === 'fulfilled' ? (clientMeetingsResult.value.data ?? []) : []) as import('@/app/actions/reunioes').ClientMeeting[]
    const products = (productsResult.status === 'fulfilled' ? (productsResult.value.data ?? []) : []) as ProductRecord[]
    const profiles = (profilesResult.status === 'fulfilled' ? (profilesResult.value.data ?? []) : []) as ProfileRecord[]
  let meetingRows: MeetingRecord[] = []
  try {
    const { data: meetingData } = await supabase
      .from('meetings')
      .select('id, lead_id, client_id, title, scheduled_for, ends_at, meeting_type, status, objective, notes, next_step, next_contact_at, owner_name, created_at, updated_at')
      .or('lead_id.not.is.null,client_id.not.is.null')
      .order('updated_at', { ascending: false })
    meetingRows = (meetingData || []) as MeetingRecord[]
  } catch (error) {
    console.warn('Historico de reunioes indisponivel em Clientes:', error instanceof Error ? error.message : error)
  }

  const leadById = new Map(leads.map((lead) => [lead.id, lead]))
  const productById = new Map(products.map((product) => [product.id, product.name || 'Geral']))
  const profileById = new Map(profiles.map((profile) => [profile.id, profile.full_name || 'Sem consultor']))
  const dealByLead = deals.reduce<Map<string, string>>((acc, deal) => {
    if (deal.lead_id) acc.set(deal.lead_id, deal.id)
    return acc
  }, new Map())

  const contractByClient = contracts.reduce<Map<string, ContractRecord[]>>((acc, contract) => {
    if (!contract.client_id) return acc
    const current = acc.get(contract.client_id) || []
    current.push(contract)
    acc.set(contract.client_id, current)
    return acc
  }, new Map())

  const documentsByContract = documents.reduce<Map<string, ContractDocumentRecord[]>>((acc, document) => {
    if (!document.contract_id) return acc
    const current = acc.get(document.contract_id) || []
    current.push(document)
    acc.set(document.contract_id, current)
    return acc
  }, new Map())

  const activitiesByClient = activities.reduce<Map<string, CommercialActivityRecord[]>>((acc, activity) => {
    if (!activity.client_id) return acc
    const current = acc.get(activity.client_id) || []
    current.push(activity)
    acc.set(activity.client_id, current)
    return acc
  }, new Map())

  const activitiesByLead = activities.reduce<Map<string, CommercialActivityRecord[]>>((acc, activity) => {
    if (!activity.lead_id) return acc
    const current = acc.get(activity.lead_id) || []
    current.push(activity)
    acc.set(activity.lead_id, current)
    return acc
  }, new Map())

  const meetingsByClient = meetingRows.reduce<Map<string, MeetingRecord[]>>((acc, meeting) => {
    if (!meeting.client_id) return acc
    const current = acc.get(meeting.client_id) || []
    current.push(meeting)
    acc.set(meeting.client_id, current)
    return acc
  }, new Map())

  const meetingsByLead = meetingRows.reduce<Map<string, MeetingRecord[]>>((acc, meeting) => {
    if (!meeting.lead_id) return acc
    const current = acc.get(meeting.lead_id) || []
    current.push(meeting)
    acc.set(meeting.lead_id, current)
    return acc
  }, new Map())

  const clientMeetingsByClient = clientMeetings.reduce<Map<string, import('@/app/actions/reunioes').ClientMeeting[]>>((acc, meeting) => {
    if (!meeting.client_id) return acc
    const current = acc.get(meeting.client_id) || []
    current.push(meeting)
    acc.set(meeting.client_id, current)
    return acc
  }, new Map())

  const signedUrlMap = await createSignedUrlMap(
    supabase,
    contracts.flatMap((contract) => {
      const latestDocument = (documentsByContract.get(contract.id) || [])[0]
      const bucket = contract.pdf_bucket || latestDocument?.bucket || null
      const path = contract.pdf_path || latestDocument?.path || null
      return bucket && path ? [{ bucket, path }] : []
    })
  )

  const rows: ClientRow[] = clients.map((client) => {
    const lead = client.origin_lead_id ? leadById.get(client.origin_lead_id) || null : null
    const clientContracts = (contractByClient.get(client.id) || []).slice().sort((left, right) => {
      const leftTime = new Date(left.updated_at || left.created_at || 0).getTime()
      const rightTime = new Date(right.updated_at || right.created_at || 0).getTime()
      return rightTime - leftTime
    })
    const contract =
      clientContracts.find((item) => item.id === client.active_contract_id) ||
      clientContracts.find((item) => item.status === 'ativo') ||
      clientContracts[0] ||
      null
    const contractDocuments = contract
      ? (documentsByContract.get(contract.id) || []).slice().sort((left, right) => {
          const leftTime = new Date(left.uploaded_at || 0).getTime()
          const rightTime = new Date(right.uploaded_at || 0).getTime()
          return rightTime - leftTime
        })
      : []
    const latestDocument = contractDocuments[0]
    const status = getClientStatus(contract, client.status_cliente)
    const product = contract?.product_id ? productById.get(contract.product_id) || 'Geral' : client.product_id ? productById.get(client.product_id) || 'Geral' : 'Geral'
    const consultant =
      contract?.consultant_id
        ? profileById.get(contract.consultant_id) || 'Sem consultor'
        : client.consultant_id
          ? profileById.get(client.consultant_id) || 'Sem consultor'
          : 'Sem consultor'
    const pdfBucket = contract?.pdf_bucket || latestDocument?.bucket || null
    const pdfPath = contract?.pdf_path || latestDocument?.path || readNoteTag(contract?.notes || null, 'PDF_PATH') || null
    const pdfName = contract?.pdf_file_name || latestDocument?.file_name || readNoteTag(contract?.notes || null, 'PDF_NAME') || null
    const pdfUrl =
      pdfBucket && pdfPath
        ? signedUrlMap.get(`${pdfBucket}:${pdfPath}`) || null
        : pdfPath?.startsWith('http')
          ? pdfPath
          : null

    const leadHistory = [
      ...(lead ? (meetingsByLead.get(lead.id) || []).map((meeting) => buildCommercialHistoryEntry('meeting', meeting)) : []),
      ...(lead ? (activitiesByLead.get(lead.id) || []).map((activity) => buildCommercialHistoryEntry('activity', activity)) : []),
      ...(activitiesByClient.get(client.id) || []).map((activity) => buildCommercialHistoryEntry('activity', activity)),
      ...(meetingsByClient.get(client.id) || []).map((meeting) => buildCommercialHistoryEntry('meeting', meeting)),
      ...(clientMeetingsByClient.get(client.id) || []).map((meeting) => ({
        title: `Reunião Gravada - ${meeting.title as string}`,
        detail: (meeting.pauta || meeting.notes || 'Reunião registrada com sucesso.') as string,
        date: (meeting.meeting_date || meeting.created_at) as string | null,
        tone: 'info' as const,
      })),
    ]
      .filter((entry, index, array) => array.findIndex((item) => item.title === entry.title && item.date === entry.date) === index)
      .sort((left, right) => new Date(right.date || 0).getTime() - new Date(left.date || 0).getTime())

    return {
      id: client.id,
      clientRecordId: client.id,
      leadId: client.origin_lead_id,
      dealId: contract?.deal_id || (client.origin_lead_id ? dealByLead.get(client.origin_lead_id) || null : null),
      contractId: contract?.id || null,
      name: client.company_name || lead?.company || client.name || lead?.name || 'Sem nome',
      company: client.company_name || lead?.company || '',
      contactName: client.name || lead?.name || '',
      razaoSocial: client.company_name || lead?.company || '',
      email: client.email || lead?.email || '',
      phone: client.phone || lead?.phone || '',
      whatsapp: client.whatsapp || lead?.whatsapp || '',
      document: client.documento || '',
      segmento: client.segmento || '',
      cidade: client.cidade || '',
      estado: client.estado || '',
      notas: client.notas || '',
      product,
      consultant,
      sourceLabel: contract ? 'Contrato vinculado' : 'Cliente criado no lead',
      clientStatusLabel: status.client_status_label,
      contractStatusLabel: status.contract_status_label,
      contractNumber: contract?.contract_number || null,
      contractValue: Number(contract?.value ?? 0) || 0,
      contractSignedAt: contract?.signed_at || null,
      contractValidUntil: status.contract_valid_until,
      contractStartAt: contract?.start_date || readNoteTag(contract?.notes || null, 'CONTRACT_START') || contract?.created_at || null,
      contractUpdatedAt: contract?.updated_at || null,
      contractNotes: contract?.notes || null,
      pdfName,
      pdfPath,
      pdfUrl,
      pdfBucket,
      pdfMimeType: contract?.pdf_mime_type || latestDocument?.mime_type || null,
      pdfUploadedAt: contract?.pdf_uploaded_at || latestDocument?.uploaded_at || null,
      pdfVersion: latestDocument?.version || null,
      signingUrl: contract?.signing_url || null,
      contractHistory: buildHistoryEntries(contract, contractDocuments),
      commercialHistory: leadHistory,
      createdAt: client.created_at || lead?.created_at || null,
      updatedAt: client.updated_at || contract?.updated_at || null,
      services: (servicesByClient.get(client.id) || []).map((service) => ({
        id: service.id,
        nome: service.nome,
        status: service.status,
        tipo_honorario: service.tipo_honorario,
        honorario_valor: service.honorario_valor,
        honorario_percentual: service.honorario_percentual,
        base_calculo: service.base_calculo,
      })),
      daysToExpire: status.days_to_expire,
    }
  })

  const allRows = rows

  return (
    <ClientesClient
      rows={allRows}
      products={products}
      profiles={profiles}
      initialSelectedClientId={selectedClientId}
    />
  )
  } catch (error) {
    console.error('Falha ao montar a tela de Clientes:', error)
    return (
      <ClientesClient
        rows={[]}
        products={[]}
        profiles={[]}
        initialSelectedClientId={selectedClientId}
      />
    )
  }
}
