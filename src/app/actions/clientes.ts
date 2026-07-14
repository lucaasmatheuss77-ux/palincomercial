'use server'

import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { recordCommercialActivity } from './commercial-activities'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export type LeadSnapshot = {
  id: string
  name: string
  company?: string | null
  product_id?: string | null
  consultant_id?: string | null
  estimated_value?: number | string | null
  stage?: string | null
  phone?: string | null
  whatsapp?: string | null
  email?: string | null
  cnpj?: string | null
  client_id?: string | null
}

export type ClientRecord = {
  id: string
  origin_lead_id?: string | null
  name: string
  company_name?: string | null
  documento?: string | null
  segmento?: string | null
  cidade?: string | null
  estado?: string | null
  notas?: string | null
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
  status_cliente?: string | null
  consultant_id?: string | null
  product_id?: string | null
  active_contract_id?: string | null
  created_at?: string
  updated_at?: string
  contracts?: ContractRecord[]
  documents?: ContractDocumentRecord[]
  active_contract?: ContractRecord | null
}

export type ContractRecord = {
  id: string
  deal_id?: string | null
  lead_id?: string | null
  client_id?: string | null
  product_id?: string | null
  consultant_id?: string | null
  contract_number?: string | null
  status?: string | null
  value?: number | string | null
  signed_at?: string | null
  notes?: string | null
  start_date?: string | null
  end_date?: string | null
  pdf_bucket?: string | null
  pdf_path?: string | null
  pdf_file_name?: string | null
  pdf_mime_type?: string | null
  pdf_uploaded_at?: string | null
  cancellation_reason?: string | null
  signing_url?: string | null
  created_at?: string
  updated_at?: string
  documents?: ContractDocumentRecord[]
}

export type ContractDocumentRecord = {
  id: string
  contract_id: string
  client_id?: string | null
  kind?: string | null
  bucket?: string | null
  path?: string | null
  file_name?: string | null
  mime_type?: string | null
  file_size?: number | string | null
  version?: number | string | null
  uploaded_by?: string | null
  uploaded_at?: string | null
  updated_at?: string | null
}

type ClientInput = {
  name?: string
  company_name?: string | null
  documento?: string | null
  segmento?: string | null
  cidade?: string | null
  estado?: string | null
  notas?: string | null
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
  status_cliente?: string | null
  consultor_responsavel_id?: string | null
  produto_foco_id?: string | null
}

type ClientCreateInput = ClientInput & {
  crm_stage?: string | null
}

type ContractInput = {
  deal_id?: string | null
  lead_id?: string | null
  client_id?: string | null
  product_id?: string | null
  consultant_id?: string | null
  contract_number?: string | null
  status?: string | null
  value?: number | string | null
  signed_at?: string | null
  notes?: string | null
  start_date?: string | null
  end_date?: string | null
  pdf_bucket?: string | null
  pdf_path?: string | null
  pdf_file_name?: string | null
  pdf_mime_type?: string | null
  pdf_uploaded_at?: string | null
  cancellation_reason?: string | null
  signing_url?: string | null
}

type ContractNotesMetadata = {
  start_date?: string | null
  end_date?: string | null
  pdf_path?: string | null
  pdf_file_name?: string | null
}

const CLIENT_STATUS_RANK: Record<string, number> = {
  lead: 1,
  aguardando_contrato: 2,
  ativo: 3,
  vencido: 4,
  cancelado: 5,
}

const CRM_STAGES = ['Contato Inicial', 'Qualificacao', 'Apresentacao', 'Proposta', 'Negociacao', 'Fechado', 'Perdido'] as const

const CONTRACT_PDF_BUCKET = 'contract-pdfs'

function nowIso() {
  return new Date().toISOString()
}

function textOrNull(value?: string | null) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function normalizeDocument(value?: string | null) {
  const digits = value?.replace(/\D/g, '') || ''
  return digits || null
}

function formatDocument(value: string) {
  if (value.length === 14) {
    return value
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
  }
  if (value.length === 11) {
    return value
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2')
  }
  return value
}

async function insertLeadWithSchemaFallback(
  supabase: SupabaseServerClient,
  payload: Record<string, unknown>
) {
  const currentPayload = { ...payload }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const result = await supabase
      .from('leads')
      .insert(currentPayload)
      .select('*')
      .maybeSingle()

    if (!result.error) return result

    const missingColumn = result.error.message.match(/'([^']+)' column/)?.[1]
    if (!missingColumn || !(missingColumn in currentPayload)) return result

    delete currentPayload[missingColumn]
  }

  return supabase
    .from('leads')
    .insert(currentPayload)
    .select('*')
    .maybeSingle()
}

function sanitizeFileName(fileName?: string | null) {
  const baseName = textOrNull(fileName) || 'contrato.pdf'
  return (
    baseName
      .normalize('NFKD')
      .replace(/[^\w.\-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'contrato.pdf'
  )
}

function resolveContractPdfBucket(bucket?: string | null) {
  return textOrNull(bucket) || CONTRACT_PDF_BUCKET
}

function buildContractPdfPath(
  contract: Pick<ContractRecord, 'id' | 'client_id' | 'deal_id' | 'lead_id'>,
  fileName?: string | null
) {
  const ownerSegment = contract.client_id || contract.lead_id || contract.deal_id || 'sem-vinculo'
  const safeName = sanitizeFileName(fileName)
  return `contracts/${ownerSegment}/${contract.id}/${Date.now()}-${randomUUID()}-${safeName}`
}

function isMissingSchemaError(error: unknown) {
  if (!error || typeof error !== 'object') return false

  const maybeError = error as { code?: string; message?: string }
  const message = (maybeError.message || '').toLowerCase()

  return (
    maybeError.code === '42P01' ||
    maybeError.code === '42703' ||
    message.includes('does not exist') ||
    message.includes('could not find the') ||
    message.includes('column') && message.includes('does not exist')
  )
}

function pickClientStatus(currentStatus?: string | null, desiredStatus?: string | null) {
  const current = currentStatus || 'lead'
  const desired = desiredStatus || current
  return (CLIENT_STATUS_RANK[desired] || 0) >= (CLIENT_STATUS_RANK[current] || 0) ? desired : current
}

function normalizeCrmStage(stage?: string | null) {
  const text = textOrNull(stage)
  if (!text) return null
  if (text === 'Lead') return 'Contato Inicial'
  if (text === 'Qualificado') return 'Qualificacao'
  if (text === 'Diagnostico' || text === 'Diagnóstico') return 'Apresentacao'
  if (text === 'Negociação') return 'Negociacao'
  return CRM_STAGES.includes(text as (typeof CRM_STAGES)[number]) ? text : null
}

function buildClientPayload(lead: LeadSnapshot, currentClient?: Partial<ClientRecord> | null, desiredStatus?: string | null) {
  return {
    origin_lead_id: currentClient?.origin_lead_id ?? lead.id,
    name: textOrNull(lead.name) || currentClient?.name || 'Sem nome',
    company_name: textOrNull(lead.company) ?? currentClient?.company_name ?? null,
    documento: normalizeDocument(lead.cnpj) ?? currentClient?.documento ?? null,
    email: textOrNull(lead.email) ?? currentClient?.email ?? null,
    phone: textOrNull(lead.phone) ?? currentClient?.phone ?? null,
    whatsapp: textOrNull(lead.whatsapp) ?? currentClient?.whatsapp ?? null,
    status_cliente: pickClientStatus(currentClient?.status_cliente, desiredStatus || (lead.stage === 'Fechado' ? 'aguardando_contrato' : 'lead')),
    consultant_id: lead.consultant_id ?? currentClient?.consultant_id ?? null,
    product_id: lead.product_id ?? currentClient?.product_id ?? null,
  }
}

function replaceNoteTag(notes: string, tag: string, value?: string | null) {
  const withoutTag = notes
    .split('\n')
    .filter((line) => !line.startsWith(`[[${tag}:`))
    .join('\n')
    .trim()

  if (!value) return withoutTag

  return [withoutTag, `[[${tag}:${value}]]`].filter(Boolean).join('\n').trim()
}

function buildContractNotes(notes?: string | null, metadata?: ContractNotesMetadata) {
  let nextNotes = notes?.trim() || ''

  if (!metadata) return nextNotes || null

  nextNotes = replaceNoteTag(nextNotes, 'CONTRACT_START', metadata.start_date)
  nextNotes = replaceNoteTag(nextNotes, 'VALID_UNTIL', metadata.end_date)
  nextNotes = replaceNoteTag(nextNotes, 'PDF_PATH', metadata.pdf_path)
  nextNotes = replaceNoteTag(nextNotes, 'PDF_NAME', metadata.pdf_file_name)

  return nextNotes || null
}

function buildLegacyContractPayload(contract: ContractInput & { status: string }) {
  return {
    deal_id: contract.deal_id ?? null,
    lead_id: contract.lead_id ?? null,
    product_id: contract.product_id ?? null,
    consultant_id: contract.consultant_id ?? null,
    contract_number: contract.contract_number ?? null,
    status: contract.status,
    value: Number(contract.value || 0),
    signed_at: contract.signed_at ?? null,
    notes: buildContractNotes(contract.notes, {
      start_date: contract.start_date,
      end_date: contract.end_date,
      pdf_path: contract.pdf_path,
      pdf_file_name: contract.pdf_file_name,
    }),
    signing_url: contract.signing_url ?? null,
  }
}

async function syncLeadClientLink(supabase: SupabaseServerClient, leadId: string, clientId: string | null | undefined) {
  if (!clientId) return

  const { error } = await supabase
    .from('leads')
    .update({ client_id: clientId, updated_at: nowIso() })
    .eq('id', leadId)

  if (error) {
    console.warn('Vinculo lead -> cliente indisponivel:', error.message)
  }
}

async function getClientByOriginLeadId(supabase: SupabaseServerClient, leadId: string) {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('origin_lead_id', leadId)
    .maybeSingle()

  if (error) {
    if (isMissingSchemaError(error)) return null
    throw error
  }

  return data as ClientRecord | null
}

async function getClientForLead(supabase: SupabaseServerClient, lead: LeadSnapshot) {
  if (lead.client_id) {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', lead.client_id)
      .maybeSingle()

    if (error) {
      if (isMissingSchemaError(error)) return null
      throw error
    }

    if (data) return data as ClientRecord
  }

  const byOrigin = await getClientByOriginLeadId(supabase, lead.id)
  if (byOrigin) return byOrigin

  const document = normalizeDocument(lead.cnpj)
  if (document) {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .in('documento', [document, formatDocument(document)])
      .limit(1)
      .maybeSingle()

    if (error) {
      if (isMissingSchemaError(error)) return null
      throw error
    }

    if (data) return data as ClientRecord
  }

  const email = textOrNull(lead.email)
  if (email) {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .ilike('email', email)
      .limit(1)
      .maybeSingle()

    if (error) {
      if (isMissingSchemaError(error)) return null
      throw error
    }

    if (data) return data as ClientRecord
  }

  return null
}

async function createLeadStageEvent(supabase: SupabaseServerClient, leadId: string, toStage: string) {
  const { error } = await supabase.from('lead_stage_events').insert({
    lead_id: leadId,
    from_stage: null,
    to_stage: toStage,
  })

  if (error) {
    console.warn('Historico de etapa indisponivel:', error.message)
  }
}

async function saveClientFromLead(
  supabase: SupabaseServerClient,
  lead: LeadSnapshot,
  desiredStatus?: string | null
) {
  try {
    const currentClient = await getClientForLead(supabase, lead)
    const payload = buildClientPayload(lead, currentClient, desiredStatus)

    if (currentClient?.id) {
      const { data, error } = await supabase
        .from('clientes')
        .update(payload)
        .eq('id', currentClient.id)
        .select('*')
        .maybeSingle()

      if (error) {
        if (isMissingSchemaError(error)) return null
        throw error
      }

      const savedClient = (data as ClientRecord | null) || currentClient
      await syncLeadClientLink(supabase, lead.id, savedClient?.id)
      return savedClient
    }

    const { data, error } = await supabase
      .from('clientes')
      .insert(payload)
      .select('*')
      .maybeSingle()

    if (error) {
      if (isMissingSchemaError(error)) return null
      throw error
    }

    const savedClient = data as ClientRecord | null
    await syncLeadClientLink(supabase, lead.id, savedClient?.id)
    return savedClient
  } catch (error) {
    console.warn('Sincronizacao de cliente indisponivel:', error instanceof Error ? error.message : error)
    return null
  }
}

async function saveContractRecord(
  supabase: SupabaseServerClient,
  payload: ContractInput,
  options?: { contractId?: string | null; desiredStatus?: string | null }
) {
  const status = options?.desiredStatus || payload.status || 'pendente_assinatura'
  const enhancedPayload = {
    deal_id: payload.deal_id ?? null,
    lead_id: payload.lead_id ?? null,
    client_id: payload.client_id ?? null,
    product_id: payload.product_id ?? null,
    consultant_id: payload.consultant_id ?? null,
    contract_number: payload.contract_number ?? null,
    status,
    value: Number(payload.value || 0),
    signed_at: payload.signed_at ?? null,
    notes: payload.notes ?? null,
    start_date: payload.start_date ?? null,
    end_date: payload.end_date ?? null,
    pdf_bucket: payload.pdf_bucket ?? null,
    pdf_path: payload.pdf_path ?? null,
    pdf_file_name: payload.pdf_file_name ?? null,
    pdf_mime_type: payload.pdf_mime_type ?? null,
    pdf_uploaded_at: payload.pdf_uploaded_at ?? null,
    cancellation_reason: payload.cancellation_reason ?? null,
    signing_url: payload.signing_url ?? null,
  }

  const legacyPayload = buildLegacyContractPayload({
    ...payload,
    status,
  })

  const useUpdate = Boolean(options?.contractId)
  const contractId = options?.contractId ?? null

  const tryWrite = async (useLegacy: boolean) => {
    if (useUpdate && contractId) {
      const query = supabase.from('contracts').update(useLegacy ? legacyPayload : enhancedPayload).eq('id', contractId)
      return query.select('*').maybeSingle()
    }

    const query = supabase.from('contracts').insert(useLegacy ? legacyPayload : enhancedPayload)
    return query.select('*').maybeSingle()
  }

  let result = await tryWrite(false)

  if (result.error && isMissingSchemaError(result.error)) {
    result = await tryWrite(true)
  }

  if (result.error) {
    if (!isMissingSchemaError(result.error)) {
      console.warn('Persistencia de contrato indisponivel:', result.error.message)
    }
    return null
  }

  return (result.data as ContractRecord | null) || null
}

async function fetchContractDocumentsByClient(supabase: SupabaseServerClient, clientId: string) {
  const { data, error } = await supabase
    .from('contract_documents')
    .select('*')
    .eq('client_id', clientId)
    .order('uploaded_at', { ascending: false })

  if (error) {
    if (isMissingSchemaError(error)) {
      return [] as ContractDocumentRecord[]
    }

    console.warn('Historico de documentos indisponivel:', error.message)
    return [] as ContractDocumentRecord[]
  }

  return (data || []) as ContractDocumentRecord[]
}

async function fetchContractDocumentsByContracts(supabase: SupabaseServerClient, contractIds: string[]) {
  if (!contractIds.length) return new Map<string, ContractDocumentRecord[]>()

  const { data, error } = await supabase
    .from('contract_documents')
    .select('*')
    .in('contract_id', contractIds)
    .order('uploaded_at', { ascending: false })

  if (error) {
    if (!isMissingSchemaError(error)) {
      console.warn('Historico de documentos indisponivel:', error.message)
    }
    return new Map<string, ContractDocumentRecord[]>()
  }

  const grouped = new Map<string, ContractDocumentRecord[]>()
  for (const document of (data || []) as ContractDocumentRecord[]) {
    const list = grouped.get(document.contract_id) || []
    list.push(document)
    grouped.set(document.contract_id, list)
  }

  return grouped
}

async function getContractByDealId(supabase: SupabaseServerClient, dealId: string) {
  const { data, error } = await supabase
    .from('contracts')
    .select('id, status, client_id')
    .eq('deal_id', dealId)
    .maybeSingle()

  if (error) {
    if (!isMissingSchemaError(error)) {
      console.warn('Consulta de contrato indisponivel:', error.message)
    }
    return null
  }

  return data as { id: string; status?: string | null; client_id?: string | null } | null
}

async function resolveClientIdForContract(
  supabase: SupabaseServerClient,
  contract: ContractRecord,
  desiredStatus?: string | null
) {
  if (contract.client_id) return contract.client_id

  if (!contract.lead_id) return null

  const { data: lead, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', contract.lead_id)
    .maybeSingle()

  if (error || !lead) {
    return null
  }

  const client = await ensureClientForLead(supabase, lead as LeadSnapshot, desiredStatus)
  return client?.id ?? null
}

export async function ensureClientForLead(
  supabase: SupabaseServerClient,
  lead: LeadSnapshot,
  desiredStatus?: string | null
) {
  return saveClientFromLead(supabase, lead, desiredStatus)
}

export async function createClientRecord(
  data: ClientCreateInput
): Promise<{ success: boolean; error?: string; data?: ClientRecord | null; leadId?: string | null }> {
  const supabase = await createClient()
  const name = textOrNull(data.name)

  if (!name) {
    return { success: false, error: 'Informe o nome do cliente.' }
  }

  // Sempre envia ao CRM — default é Contato Inicial se não especificado
  const crmStage = normalizeCrmStage(data.crm_stage) ?? 'Contato Inicial'
  const initialStatus = data.status_cliente ?? (crmStage === 'Fechado' ? 'aguardando_contrato' : 'lead')
  const document = normalizeDocument(data.documento) ?? textOrNull(data.documento)
  const email = textOrNull(data.email)

  let existingClient: ClientRecord | null = null
  let clientsTableAvailable = true
  if (document) {
    const { data: byDocument, error: documentError } = await supabase
      .from('clientes')
      .select('*')
      .eq('documento', document)
      .limit(1)
      .maybeSingle()

    if (documentError) {
      if (isMissingSchemaError(documentError)) {
        clientsTableAvailable = false
      } else {
        return { success: false, error: documentError.message }
      }
    }

    existingClient = (byDocument as ClientRecord | null) || null
    if (existingClient?.id) {
      return { success: false, error: 'Documento já cadastrado. Não é permitido duplicar CNPJ/CPF.', data: existingClient }
    }
  }

  if (clientsTableAvailable && !existingClient && email) {
    const { data: byEmail, error: emailError } = await supabase
      .from('clientes')
      .select('*')
      .ilike('email', email)
      .limit(1)
      .maybeSingle()

    if (emailError) {
      if (isMissingSchemaError(emailError)) {
        clientsTableAvailable = false
      } else {
        return { success: false, error: emailError.message }
      }
    }

    existingClient = (byEmail as ClientRecord | null) || null
  }

  const clientPayload = {
      name,
      company_name: textOrNull(data.company_name),
      documento: document,
      segmento: textOrNull(data.segmento),
      cidade: textOrNull(data.cidade),
      estado: textOrNull(data.estado),
      notas: textOrNull(data.notas),
      email,
      phone: textOrNull(data.phone),
      whatsapp: textOrNull(data.whatsapp),
      status_cliente: pickClientStatus(existingClient?.status_cliente, initialStatus),
      consultant_id: data.consultor_responsavel_id ?? null,
      product_id: data.produto_foco_id ?? null,
    }

  let client: ClientRecord | null = existingClient

  if (clientsTableAvailable) {
    const clientWrite = existingClient?.id
      ? supabase
        .from('clientes')
        .update(clientPayload)
        .eq('id', existingClient.id)
      : supabase
        .from('clientes')
        .insert(clientPayload)

    const { data: createdClient, error: clientError } = await clientWrite
      .select('*')
      .maybeSingle()

    if (clientError) {
      if (isMissingSchemaError(clientError)) {
        clientsTableAvailable = false
      } else {
        return { success: false, error: clientError.message }
      }
    }

    client = (createdClient as ClientRecord | null) || existingClient || null
  }

  let leadId: string | null = null

  const leadPayload = {
    name,
    company_name: textOrNull(data.company_name),
    stage: crmStage,
    expected_value: 0,
    product_id: data.produto_foco_id ?? null,
    consultant_id: data.consultor_responsavel_id ?? null,
    phone: textOrNull(data.phone),
    whatsapp: textOrNull(data.whatsapp),
    email,
    created_at: nowIso(),
  }

  // Sempre cria lead no CRM. Se a tabela clientes existir, vincula tambem.
  let leadResult = await insertLeadWithSchemaFallback(supabase, leadPayload)

  if (leadResult.error && isMissingSchemaError(leadResult.error) && 'client_id' in leadPayload) {
    const leadPayloadWithoutClient = { ...leadPayload }
    delete (leadPayloadWithoutClient as { client_id?: string }).client_id
    leadResult = await insertLeadWithSchemaFallback(supabase, leadPayloadWithoutClient)
  }

  const { data: createdLead, error: leadError } = leadResult

  if (leadError) {
    return { success: false, error: leadError.message }
  } else if (createdLead?.id) {
    const newLeadId = createdLead.id
    leadId = newLeadId

    if (clientsTableAvailable && client?.id) {
      await supabase
        .from('clientes')
        .update({
          origin_lead_id: client.origin_lead_id ?? newLeadId,
          status_cliente: pickClientStatus(client.status_cliente, crmStage === 'Fechado' ? 'aguardando_contrato' : 'lead'),
          updated_at: nowIso(),
        })
        .eq('id', client.id)

      await syncLeadClientLink(supabase, newLeadId, client.id)
    }

    await createLeadStageEvent(supabase, newLeadId, crmStage)
    await recordCommercialActivity({
      leadId: newLeadId,
      clientId: client?.id ?? null,
      activityType: 'client_created',
      subject: `Cliente ${name} enviado ao CRM`,
      summary: [`Etapa inicial: ${crmStage}`, clientPayload.company_name ? `Empresa: ${clientPayload.company_name}` : null].filter(Boolean).join(' | '),
      nextStep: crmStage === 'Fechado' ? 'Gerar contrato e anexar documentos.' : 'Entrar em contato e agendar primeira reunião.',
      status: 'registrada',
    })
  }

  let refreshedClient: ClientRecord | null = null
  if (clientsTableAvailable && client?.id) {
    const { data } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', client.id)
      .maybeSingle()
    refreshedClient = (data as ClientRecord | null) || null
  }

  
  // Auto-create Insider Club member if product matches
  if (client?.id) {
    try {
      const { maybeCreateClubMemberFromClient } = await import('./clube')
      await maybeCreateClubMemberFromClient(client.id, data.produto_foco_id)
    } catch (clubErr) {
      console.warn('Club auto-create skipped:', clubErr instanceof Error ? clubErr.message : clubErr)
    }
  }
  revalidatePath('/dashboard/clientes')
  revalidatePath('/dashboard/pipeline')
  revalidatePath('/dashboard/clube')
  revalidatePath('/dashboard')

  return { success: true, data: refreshedClient || client, leadId }
}

export async function upsertPendingContractFromDeal(
  supabase: SupabaseServerClient,
  deal: {
    id: string
    lead_id?: string | null
    product_id?: string | null
    consultant_id?: string | null
    value?: number | string | null
    client_id?: string | null
  },
  options?: {
    lead?: LeadSnapshot | null
    clientId?: string | null
    contractFields?: Partial<ContractInput>
  }
) {
  try {
    const existingContract = await getContractByDealId(supabase, deal.id)
    const desiredStatus =
      options?.contractFields?.status ||
      (existingContract?.status === 'ativo' ? 'ativo' : 'pendente_assinatura')
    const clientId = options?.clientId ?? deal.client_id ?? existingContract?.client_id ?? null

    return await saveContractRecord(
      supabase,
      {
        deal_id: deal.id,
        lead_id: deal.lead_id ?? options?.lead?.id ?? null,
        client_id: clientId,
        product_id: deal.product_id ?? options?.lead?.product_id ?? null,
        consultant_id: deal.consultant_id ?? options?.lead?.consultant_id ?? null,
        value: deal.value ?? options?.lead?.estimated_value ?? 0,
        status: desiredStatus,
        contract_number: options?.contractFields?.contract_number ?? null,
        signed_at: options?.contractFields?.signed_at ?? null,
        notes: options?.contractFields?.notes ?? null,
        start_date: options?.contractFields?.start_date ?? null,
        end_date: options?.contractFields?.end_date ?? null,
        cancellation_reason: options?.contractFields?.cancellation_reason ?? null,
        signing_url: options?.contractFields?.signing_url ?? null,
      },
      {
        contractId: existingContract?.id || null,
        desiredStatus,
      }
    )
  } catch (error) {
    console.warn('Contrato automatico indisponivel:', error instanceof Error ? error.message : error)
    return null
  }
}

export type ClienteOption = {
  id: string
  nome: string
  company_name: string | null
  documento: string | null
  email: string | null
  phone: string | null
}

export async function listClienteOptions(): Promise<ClienteOption[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('clientes')
    .select('id, name, company_name, documento, email, phone, whatsapp')
    .order('name', { ascending: true })
    .limit(2000)

  if (error) {
    if (!isMissingSchemaError(error)) {
      console.error('Erro ao listar clientes para busca:', error.message)
    }
    return []
  }

  return (data || []).map((client) => ({
    id: client.id as string,
    nome: (client.name as string) || 'Sem nome',
    company_name: (client.company_name as string) || null,
    documento: (client.documento as string) || null,
    email: (client.email as string) || null,
    phone: (client.phone as string) || (client.whatsapp as string) || null,
  }))
}

export async function listClientes(limit = 200): Promise<{ success: boolean; data: ClientRecord[]; error?: string }> {
  const supabase = await createClient()

  const { data: clients, error } = await supabase
    .from('clientes')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingSchemaError(error)) {
      return { success: true, data: [] }
    }

    return { success: false, error: error.message, data: [] }
  }

  const baseClients = (clients || []) as ClientRecord[]
  const clientIds = baseClients.map((client) => client.id)

  const { data: contracts } = clientIds.length
    ? await supabase
        .from('contracts')
        .select('*')
        .in('client_id', clientIds)
        .order('updated_at', { ascending: false })
    : { data: [] }
  const contractIds = ((contracts || []) as ContractRecord[]).map((contract) => contract.id)

  const documentsByContract = await fetchContractDocumentsByContracts(supabase, contractIds)

  const documentsByClient = new Map<string, ContractDocumentRecord[]>()
  if (clientIds.length) {
    const { data: documents, error: documentsError } = await supabase
      .from('contract_documents')
      .select('*')
      .in('client_id', clientIds)
      .order('uploaded_at', { ascending: false })

    if (documentsError) {
      if (!isMissingSchemaError(documentsError)) {
        console.warn('Historico de documentos indisponivel:', documentsError.message)
      }
    } else {
      for (const document of (documents || []) as ContractDocumentRecord[]) {
        if (!document.client_id) continue
        const list = documentsByClient.get(document.client_id) || []
        list.push(document)
        documentsByClient.set(document.client_id, list)
      }
    }
  }

  if (!contracts) {
    return {
      success: true,
      data: baseClients.map((client) => ({
        ...client,
        documents: documentsByClient.get(client.id) || [],
      })),
    }
  }

  const contractsByClient = new Map<string, ContractRecord[]>()
  for (const contract of (contracts || []) as ContractRecord[]) {
    if (!contract.client_id) continue
    const list = contractsByClient.get(contract.client_id) || []
    list.push({
      ...contract,
      documents: documentsByContract.get(contract.id) || [],
    })
    contractsByClient.set(contract.client_id, list)
  }

  const data = baseClients.map((client) => {
    const clientContracts = contractsByClient.get(client.id) || []
    return {
      ...client,
      documents: documentsByClient.get(client.id) || [],
      contracts: clientContracts,
      active_contract:
        clientContracts.find((contract) => contract.id === client.active_contract_id) ||
        clientContracts.find((contract) => contract.status === 'ativo') ||
        null,
    }
  })

  return { success: true, data }
}

export async function getCliente(clienteId: string): Promise<{ success: boolean; data: ClientRecord | null; error?: string }> {
  const supabase = await createClient()

  const { data: client, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', clienteId)
    .maybeSingle()

  if (error) {
    if (isMissingSchemaError(error)) {
      return { success: true, data: null }
    }

    return { success: false, error: error.message, data: null }
  }

  if (!client) {
    return { success: true, data: null }
  }

  const { data: contracts } = await supabase
    .from('contracts')
    .select('*')
    .eq('client_id', clienteId)
    .order('updated_at', { ascending: false })
  const contractIds = ((contracts || []) as ContractRecord[]).map((contract) => contract.id)
  const documentsByContract = await fetchContractDocumentsByContracts(supabase, contractIds)

  const documents = await fetchContractDocumentsByClient(supabase, clienteId)

  if (!contracts) {
    return {
      success: true,
      data: {
        ...(client as ClientRecord),
        contracts: [],
        documents,
        active_contract: null,
      },
    }
  }

  return {
    success: true,
    data: {
      ...(client as ClientRecord),
      contracts: ((contracts || []) as ContractRecord[]).map((contract) => ({
        ...contract,
        documents: documentsByContract.get(contract.id) || [],
      })),
      documents,
      active_contract:
        ((contracts || []) as ContractRecord[]).find((contract) => contract.id === (client as ClientRecord).active_contract_id) ||
        ((contracts || []) as ContractRecord[]).find((contract) => contract.status === 'ativo') ||
        null,
    },
  }
}

export async function listContractsByClient(clienteId: string): Promise<{ success: boolean; data: ContractRecord[]; error?: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('client_id', clienteId)
    .order('updated_at', { ascending: false })

  if (error) {
    if (isMissingSchemaError(error)) {
      return { success: true, data: [] }
    }

    return { success: false, error: error.message, data: [] }
  }

  return { success: true, data: (data || []) as ContractRecord[] }
}

export async function listContractDocumentsByClient(clienteId: string): Promise<{ success: boolean; data: ContractDocumentRecord[]; error?: string }> {
  const supabase = await createClient()
  const data = await fetchContractDocumentsByClient(supabase, clienteId)
  return { success: true, data }
}

export async function listContractDocumentsByContract(contractId: string): Promise<{ success: boolean; data: ContractDocumentRecord[]; error?: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('contract_documents')
    .select('*')
    .eq('contract_id', contractId)
    .order('uploaded_at', { ascending: false })

  if (error) {
    if (isMissingSchemaError(error)) {
      return { success: true, data: [] }
    }

    return { success: false, error: error.message, data: [] }
  }

  return { success: true, data: (data || []) as ContractDocumentRecord[] }
}

export async function updateClient(
  clienteId: string,
  data: ClientInput
): Promise<{ success: boolean; error?: string; data?: ClientRecord | null }> {
  const supabase = await createClient()

  const { data: currentClient, error: currentError } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', clienteId)
    .maybeSingle()

  if (currentError) {
    if (isMissingSchemaError(currentError)) {
      return { success: false, error: 'Tabela de clientes indisponivel.' }
    }

    return { success: false, error: currentError.message }
  }

  if (!currentClient) {
    return { success: false, error: 'Cliente nao encontrado.' }
  }

  const payload = {
    name: textOrNull(data.name) || (currentClient as ClientRecord).name,
    company_name: data.company_name === undefined ? (currentClient as ClientRecord).company_name ?? null : textOrNull(data.company_name),
    documento: data.documento === undefined ? (currentClient as ClientRecord).documento ?? null : normalizeDocument(data.documento) ?? textOrNull(data.documento),
    segmento: data.segmento === undefined ? (currentClient as ClientRecord).segmento ?? null : textOrNull(data.segmento),
    cidade: data.cidade === undefined ? (currentClient as ClientRecord).cidade ?? null : textOrNull(data.cidade),
    estado: data.estado === undefined ? (currentClient as ClientRecord).estado ?? null : textOrNull(data.estado),
    notas: data.notas === undefined ? (currentClient as ClientRecord).notas ?? null : textOrNull(data.notas),
    email: data.email === undefined ? (currentClient as ClientRecord).email ?? null : textOrNull(data.email),
    phone: data.phone === undefined ? (currentClient as ClientRecord).phone ?? null : textOrNull(data.phone),
    whatsapp: data.whatsapp === undefined ? (currentClient as ClientRecord).whatsapp ?? null : textOrNull(data.whatsapp),
    status_cliente: data.status_cliente === undefined ? (currentClient as ClientRecord).status_cliente ?? 'lead' : data.status_cliente,
    consultant_id:
      data.consultor_responsavel_id === undefined
        ? (currentClient as ClientRecord).consultant_id ?? null
        : data.consultor_responsavel_id,
    product_id:
      data.produto_foco_id === undefined
        ? (currentClient as ClientRecord).product_id ?? null
        : data.produto_foco_id,
  }

  const nextDocument = payload.documento
  if (nextDocument && nextDocument !== ((currentClient as ClientRecord).documento ?? null)) {
    const { data: duplicate, error: duplicateError } = await supabase
      .from('clientes')
      .select('id, name, company_name')
      .in('documento', [nextDocument, formatDocument(nextDocument)])
      .neq('id', clienteId)
      .limit(1)
      .maybeSingle()

    if (duplicateError && !isMissingSchemaError(duplicateError)) {
      return { success: false, error: duplicateError.message }
    }

    if (duplicate) {
      const owner = (duplicate as { company_name?: string | null; name?: string | null }).company_name || (duplicate as { name?: string | null }).name || 'cliente cadastrado'
      return { success: false, error: `Documento já cadastrado para ${owner}. Não é permitido duplicar CNPJ/CPF.` }
    }
  }

  const { data: updatedClient, error } = await supabase
    .from('clientes')
    .update(payload)
    .eq('id', clienteId)
    .select('*')
    .maybeSingle()

  if (error) {
    if (isMissingSchemaError(error)) {
      return { success: false, error: 'Tabela de clientes indisponivel.' }
    }

    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/clientes')
  revalidatePath('/dashboard/pipeline')
  revalidatePath('/dashboard')
  return { success: true, data: (updatedClient as ClientRecord | null) || null }
}

export async function saveClientContract(
  payload: ContractInput
): Promise<{ success: boolean; error?: string; data?: ContractRecord | null }> {
  const supabase = await createClient()

  if (!payload.deal_id) {
    return { success: false, error: 'Informe um deal para salvar o contrato.' }
  }

  const contract = await upsertPendingContractFromDeal(
    supabase,
    {
      id: payload.deal_id,
      lead_id: payload.lead_id ?? null,
      client_id: payload.client_id ?? null,
      product_id: payload.product_id ?? null,
      consultant_id: payload.consultant_id ?? null,
      value: payload.value ?? 0,
    },
    {
      clientId: payload.client_id ?? null,
      contractFields: payload,
    }
  )

  if (!contract) {
    return { success: false, error: 'Não foi possível salvar o contrato.' }
  }

  const clientId = payload.client_id ?? contract.client_id ?? null
  if (clientId) {
    const clientStatus =
      payload.status === 'ativo'
        ? 'ativo'
        : payload.status === 'cancelado'
          ? 'cancelado'
          : 'aguardando_contrato'
    await supabase
      .from('clientes')
      .update({
        status_cliente: clientStatus,
        active_contract_id: payload.status === 'ativo' ? contract.id : null,
      })
      .eq('id', clientId)
  }

  revalidatePath('/dashboard/clientes')
  revalidatePath('/dashboard/pipeline')
  revalidatePath('/dashboard')
  return { success: true, data: contract }
}

export async function uploadContractPdf(
  contractId: string,
  payload: {
    file?: File | null
    bucket?: string | null
    path?: string | null
    file_name?: string | null
    mime_type?: string | null
    file_size?: number | null
  }
): Promise<{ success: boolean; error?: string; data?: ContractRecord | null }> {
  const supabase = await createClient()
  const { data: contract, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .maybeSingle()

  if (error) {
    if (isMissingSchemaError(error)) {
      return { success: false, error: 'Tabela de contratos indisponivel.' }
    }

    return { success: false, error: error.message }
  }

  if (!contract) {
    return { success: false, error: 'Contrato nao encontrado.' }
  }

  const bucket = resolveContractPdfBucket(payload.bucket)
  const file = payload.file || null
  const fileName = payload.file_name || file?.name || 'contrato.pdf'
  const mimeType = payload.mime_type || file?.type || 'application/pdf'
  const fileSize = payload.file_size ?? file?.size ?? null
  const uploadPath = payload.path || (file ? buildContractPdfPath(contract as ContractRecord, fileName) : null)

  if (file && mimeType !== 'application/pdf' && !mimeType.includes('pdf') && !fileName.toLowerCase().endsWith('.pdf')) {
    return { success: false, error: 'Envie um arquivo PDF valido.' }
  }

  let storedPath = payload.path ?? null
  let uploadedToStorage = false

  if (file) {
    if (!uploadPath) {
      return { success: false, error: 'Não foi possível definir o caminho do arquivo.' }
    }

    const { error: uploadError } = await supabase.storage.from(bucket).upload(uploadPath, file, {
      contentType: mimeType || 'application/pdf',
      upsert: false,
    })

    if (uploadError) {
      return { success: false, error: uploadError.message }
    }

    storedPath = uploadPath
    uploadedToStorage = true
  }

  const updatedContract = await saveContractRecord(
    supabase,
    {
      deal_id: (contract as ContractRecord).deal_id ?? null,
      lead_id: (contract as ContractRecord).lead_id ?? null,
      client_id: (contract as ContractRecord).client_id ?? null,
      product_id: (contract as ContractRecord).product_id ?? null,
      consultant_id: (contract as ContractRecord).consultant_id ?? null,
      contract_number: (contract as ContractRecord).contract_number ?? null,
      status: (contract as ContractRecord).status ?? 'pendente_assinatura',
      value: (contract as ContractRecord).value ?? 0,
      signed_at: (contract as ContractRecord).signed_at ?? null,
      notes: (contract as ContractRecord).notes ?? null,
      start_date: (contract as ContractRecord).start_date ?? null,
      end_date: (contract as ContractRecord).end_date ?? null,
      pdf_bucket: bucket,
      pdf_path: storedPath,
      pdf_file_name: fileName,
      pdf_mime_type: mimeType,
      pdf_uploaded_at: nowIso(),
    },
    {
      contractId,
      desiredStatus: (contract as ContractRecord).status ?? 'pendente_assinatura',
    }
  )

  if (!updatedContract) {
    if (uploadedToStorage && storedPath) {
      await supabase.storage.from(bucket).remove([storedPath]).catch(() => {})
    }

    return { success: false, error: 'Não foi possível registrar o PDF do contrato.' }
  }

  const { data: authData } = await supabase.auth.getUser()
  const uploadedBy = authData.user?.id || null
  let version = 1

  const { count } = await supabase
    .from('contract_documents')
    .select('id', { count: 'exact', head: true })
    .eq('contract_id', contractId)
    .eq('kind', 'contract_pdf')

  if (typeof count === 'number' && count >= 0) {
    version = count + 1
  }

  const { error: documentError } = await supabase.from('contract_documents').insert({
    contract_id: contractId,
    client_id: updatedContract.client_id ?? (contract as ContractRecord).client_id ?? null,
    kind: 'contract_pdf',
    bucket,
    path: storedPath,
    file_name: fileName,
    mime_type: mimeType,
    file_size: fileSize,
    version,
    uploaded_by: uploadedBy,
    uploaded_at: nowIso(),
  })

  if (documentError && !isMissingSchemaError(documentError)) {
    console.warn('Documento do contrato indisponivel:', documentError.message)
  }

  revalidatePath('/dashboard/clientes')
  revalidatePath('/dashboard/pipeline')
  return { success: true, data: updatedContract }
}

export async function uploadContractPdfFromForm(formData: FormData): Promise<{ success: boolean; error?: string; data?: ContractRecord | null }> {
  const contractId = String(formData.get('contract_id') || '').trim()
  const bucket = String(formData.get('bucket') || '').trim() || CONTRACT_PDF_BUCKET
  const fileEntry = formData.get('file')

  if (!contractId) {
    return { success: false, error: 'Informe o contrato para enviar o PDF.' }
  }

  if (!(fileEntry instanceof File)) {
    return { success: false, error: 'Selecione um arquivo PDF valido.' }
  }

  if (fileEntry.size <= 0) {
    return { success: false, error: 'O arquivo selecionado esta vazio.' }
  }

  return uploadContractPdf(contractId, {
    file: fileEntry,
    bucket,
  })
}

export async function activateContract(
  contractId: string,
  payload: {
    start_date?: string | null
    end_date?: string | null
    signed_at?: string | null
    notes?: string | null
  } = {}
): Promise<{ success: boolean; error?: string; data?: ContractRecord | null }> {
  const supabase = await createClient()

  const { data: contract, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .maybeSingle()

  if (error) {
    if (isMissingSchemaError(error)) {
      return { success: false, error: 'Tabela de contratos indisponivel.' }
    }

    return { success: false, error: error.message }
  }

  if (!contract) {
    return { success: false, error: 'Contrato nao encontrado.' }
  }

  const updatedContract = await saveContractRecord(
    supabase,
    {
      deal_id: (contract as ContractRecord).deal_id ?? null,
      lead_id: (contract as ContractRecord).lead_id ?? null,
      client_id: (contract as ContractRecord).client_id ?? null,
      product_id: (contract as ContractRecord).product_id ?? null,
      consultant_id: (contract as ContractRecord).consultant_id ?? null,
      contract_number: (contract as ContractRecord).contract_number ?? null,
      status: 'ativo',
      value: (contract as ContractRecord).value ?? 0,
      signed_at: payload.signed_at ?? nowIso(),
      notes: payload.notes ?? (contract as ContractRecord).notes ?? null,
      start_date: payload.start_date ?? (contract as ContractRecord).start_date ?? null,
      end_date: payload.end_date ?? (contract as ContractRecord).end_date ?? null,
      pdf_bucket: (contract as ContractRecord).pdf_bucket ?? null,
      pdf_path: (contract as ContractRecord).pdf_path ?? null,
      pdf_file_name: (contract as ContractRecord).pdf_file_name ?? null,
      pdf_mime_type: (contract as ContractRecord).pdf_mime_type ?? null,
      pdf_uploaded_at: (contract as ContractRecord).pdf_uploaded_at ?? null,
      cancellation_reason: null,
    },
    {
      contractId,
      desiredStatus: 'ativo',
    }
  )

  if (!updatedContract) {
    return { success: false, error: 'Não foi possível ativar o contrato.' }
  }

  const clientId =
    updatedContract.client_id ??
    (contract as ContractRecord).client_id ??
    (await resolveClientIdForContract(supabase, contract as ContractRecord, 'ativo'))
  if (clientId) {
    await supabase
      .from('clientes')
      .update({
        status_cliente: 'ativo',
        active_contract_id: contractId,
      })
      .eq('id', clientId)
  }

  revalidatePath('/dashboard/clientes')
  revalidatePath('/dashboard/pipeline')
  revalidatePath('/dashboard')

  // Log activity for realtime notifications
  await recordCommercialActivity({
    activityType: 'contrato_ativado',
    subject: 'Contrato Ativado',
    summary: `Contrato ${updatedContract.contract_number || contractId} foi ativado com sucesso.`,
    leadId: updatedContract.lead_id,
    clientId: clientId,
    contractId: contractId,
  })

  return { success: true, data: updatedContract }
}

export async function cancelContract(
  contractId: string,
  reason?: string | null
): Promise<{ success: boolean; error?: string; data?: ContractRecord | null }> {
  const supabase = await createClient()

  const { data: contract, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .maybeSingle()

  if (error) {
    if (isMissingSchemaError(error)) {
      return { success: false, error: 'Tabela de contratos indisponivel.' }
    }

    return { success: false, error: error.message }
  }

  if (!contract) {
    return { success: false, error: 'Contrato nao encontrado.' }
  }

  const updatedContract = await saveContractRecord(
    supabase,
    {
      deal_id: (contract as ContractRecord).deal_id ?? null,
      lead_id: (contract as ContractRecord).lead_id ?? null,
      client_id: (contract as ContractRecord).client_id ?? null,
      product_id: (contract as ContractRecord).product_id ?? null,
      consultant_id: (contract as ContractRecord).consultant_id ?? null,
      contract_number: (contract as ContractRecord).contract_number ?? null,
      status: 'cancelado',
      value: (contract as ContractRecord).value ?? 0,
      signed_at: (contract as ContractRecord).signed_at ?? null,
      notes: (contract as ContractRecord).notes ?? null,
      start_date: (contract as ContractRecord).start_date ?? null,
      end_date: (contract as ContractRecord).end_date ?? null,
      pdf_bucket: (contract as ContractRecord).pdf_bucket ?? null,
      pdf_path: (contract as ContractRecord).pdf_path ?? null,
      pdf_file_name: (contract as ContractRecord).pdf_file_name ?? null,
      pdf_mime_type: (contract as ContractRecord).pdf_mime_type ?? null,
      pdf_uploaded_at: (contract as ContractRecord).pdf_uploaded_at ?? null,
      cancellation_reason: textOrNull(reason),
    },
    {
      contractId,
      desiredStatus: 'cancelado',
    }
  )

  if (!updatedContract) {
    return { success: false, error: 'Não foi possível cancelar o contrato.' }
  }

  const clientId =
    updatedContract.client_id ??
    (contract as ContractRecord).client_id ??
    (await resolveClientIdForContract(supabase, contract as ContractRecord, 'cancelado'))
  if (clientId) {
    await supabase
      .from('clientes')
      .update({
        status_cliente: 'cancelado',
        active_contract_id: null,
      })
      .eq('id', clientId)
  }

  revalidatePath('/dashboard/clientes')
  revalidatePath('/dashboard/pipeline')
  revalidatePath('/dashboard')
  return { success: true, data: updatedContract }
}

export async function renewContract(
  contractId: string,
  payload: {
    new_deal_id?: string | null
    start_date?: string | null
    end_date?: string | null
  } = {}
): Promise<{ success: boolean; error?: string; data?: ContractRecord | null }> {
  const supabase = await createClient()

  const { data: contract, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .maybeSingle()

  if (error) {
    if (isMissingSchemaError(error)) {
      return { success: false, error: 'Tabela de contratos indisponivel.' }
    }

    return { success: false, error: error.message }
  }

  if (!contract) {
    return { success: false, error: 'Contrato nao encontrado.' }
  }

  const archivedContract = await saveContractRecord(
    supabase,
    {
      deal_id: (contract as ContractRecord).deal_id ?? null,
      lead_id: (contract as ContractRecord).lead_id ?? null,
      client_id: (contract as ContractRecord).client_id ?? null,
      product_id: (contract as ContractRecord).product_id ?? null,
      consultant_id: (contract as ContractRecord).consultant_id ?? null,
      contract_number: (contract as ContractRecord).contract_number ?? null,
      status: 'renovado',
      value: (contract as ContractRecord).value ?? 0,
      signed_at: (contract as ContractRecord).signed_at ?? null,
      notes: (contract as ContractRecord).notes ?? null,
      start_date: (contract as ContractRecord).start_date ?? null,
      end_date: (contract as ContractRecord).end_date ?? null,
    },
    {
      contractId,
      desiredStatus: 'renovado',
    }
  )

  if (!archivedContract) {
    return { success: false, error: 'Não foi possível arquivar o contrato atual para renovação.' }
  }

  let nextDealId = payload.new_deal_id ?? null

  if (!nextDealId) {
    const { data: createdDeal, error: dealError } = await supabase
      .from('deals')
      .insert({
        lead_id: (contract as ContractRecord).lead_id ?? null,
        product_id: (contract as ContractRecord).product_id ?? null,
        consultant_id: (contract as ContractRecord).consultant_id ?? null,
        value: Number((contract as ContractRecord).value ?? 0),
        closed_at: nowIso(),
      })
      .select('id')
      .maybeSingle()

    if (dealError || !createdDeal?.id) {
      return { success: false, error: dealError?.message || 'Não foi possível gerar o novo deal da renovação.' }
    }

    nextDealId = createdDeal.id
  }

  const renewedContract = await saveContractRecord(
    supabase,
    {
      deal_id: nextDealId,
      lead_id: (contract as ContractRecord).lead_id ?? null,
      client_id: (contract as ContractRecord).client_id ?? null,
      product_id: (contract as ContractRecord).product_id ?? null,
      consultant_id: (contract as ContractRecord).consultant_id ?? null,
      contract_number: null,
      status: 'pendente_assinatura',
      value: (contract as ContractRecord).value ?? 0,
      signed_at: null,
      notes: `Renovacao do contrato ${contractId}`,
      start_date: payload.start_date ?? null,
      end_date: payload.end_date ?? null,
    }
  )

  if (!renewedContract) {
    return { success: false, error: 'Não foi possível gerar a renovação.' }
  }

  const clientId =
    renewedContract.client_id ??
    (contract as ContractRecord).client_id ??
    (await resolveClientIdForContract(supabase, contract as ContractRecord, 'aguardando_contrato'))
  if (clientId) {
    await supabase
      .from('clientes')
      .update({
        status_cliente: 'aguardando_contrato',
        active_contract_id: null,
      })
      .eq('id', clientId)
  }

  revalidatePath('/dashboard/clientes')
  revalidatePath('/dashboard/pipeline')
  revalidatePath('/dashboard')
  return { success: true, data: renewedContract }
}
