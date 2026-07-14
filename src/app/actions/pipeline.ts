'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { ensureClientForLead, upsertPendingContractFromDeal } from './clientes'
import { recordCommercialActivity } from './commercial-activities'
import { generateLeadIntelligence } from './intelligence'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

type AiQualificationPayload = {
  leadId: string
  status?: string
  score?: number
  source?: string
  summary?: string
}

type PipelineLeadRecord = {
  id: string
  name: string
  company_name?: string | null
  company?: string | null
  client_id?: string | null
  cnpj?: string | null
  consultant_id?: string | null
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
  product_id?: string | null
  expected_value?: number | string | null
  stage?: string | null
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

async function findExistingDocumentOwner(supabase: SupabaseServerClient, document: string, ignoreLeadId?: string, ignoreClientId?: string | null) {
  const { data: clients, error: clientsError } = await supabase
    .from('clientes')
    .select('id, origin_lead_id, name, company_name, documento')
    .in('documento', [document, formatDocument(document)])
    .limit(5)

  if (clientsError && !/does not exist|column|schema cache/i.test(clientsError.message)) {
    return { error: clientsError.message }
  }

  const client = (clients || []).find((item) => item.id !== ignoreClientId && item.origin_lead_id !== ignoreLeadId)
  if (client) {
    return { owner: client.company_name || client.name || 'cliente cadastrado' }
  }

  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('id, name, company_name, cnpj, client_id')
    .in('cnpj', [document, formatDocument(document)])
    .limit(2)

  if (leadsError && !/does not exist|column|schema cache/i.test(leadsError.message)) {
    return { error: leadsError.message }
  }

  const lead = (leads || []).find((item) => item.id !== ignoreLeadId && item.client_id !== ignoreClientId)
  if (lead) {
    return { owner: lead.company_name || lead.name || 'lead cadastrado' }
  }

  return {}
}

async function createStageEvent(supabase: SupabaseServerClient, data: {
  leadId: string
  fromStage?: string | null
  toStage: string
}) {
  const { error } = await supabase.from('lead_stage_events').insert({
    lead_id: data.leadId,
    from_stage: data.fromStage || null,
    to_stage: data.toStage,
  })

  if (error) {
    console.warn('Historico de etapa indisponivel:', error.message)
  }
}

async function upsertAiQualification(supabase: SupabaseServerClient, data: AiQualificationPayload) {
  const hasAiData = Boolean(
    data.status ||
    data.source ||
    data.summary ||
    (typeof data.score === 'number' && data.score > 0)
  )

  if (!hasAiData) return

  const { error } = await supabase.from('ai_qualifications').upsert({
    lead_id: data.leadId,
    status: data.status || 'nao_avaliado',
    score: data.score || 0,
    source: data.source || 'manual',
    summary: data.summary || null,
    reviewed_at: new Date().toISOString(),
  }, { onConflict: 'lead_id' })

  if (error) {
    console.warn('Pre-qualificacao IA indisponivel:', error.message)
  }
}

export async function updateLeadStage(leadId: string, newStage: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  // if (!user) return { success: false, error: 'Nao autorizado.' }

  const { data: currentLead } = await supabase
    .from('leads')
    .select('stage')
    .eq('id', leadId)
    .maybeSingle()

  const { error } = await supabase
    .from('leads')
    .update({ stage: newStage, updated_at: new Date().toISOString() })
    .eq('id', leadId)

  if (error) {
    console.error('Erro ao atualizar estagio do lead:', error)
    return { success: false, error: error.message }
  }

  await createStageEvent(supabase, {
    leadId,
    fromStage: currentLead?.stage,
    toStage: newStage,
  })

  const { data: leadSnapshot } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .maybeSingle()

  if (leadSnapshot) {
    await recordCommercialActivity({
      leadId,
      consultantId: leadSnapshot.consultant_id ?? null,
      activityType: 'stage_change',
      subject: `Lead movido para ${newStage}`,
      summary: currentLead?.stage
        ? `Etapa alterada de ${currentLead.stage} para ${newStage}.`
        : `Etapa inicial definida como ${newStage}.`,
      nextStep: newStage === 'Fechado'
        ? 'Gerar e validar contrato.'
        : 'Manter o contato comercial e preparar a próxima interação baseada na etapa.',
      status: 'registrada',
    })
  }

  const clientSnapshot = leadSnapshot
    ? await ensureClientForLead(
        supabase,
        leadSnapshot,
        newStage === 'Fechado' ? 'aguardando_contrato' : 'lead'
      )
    : null

  if (newStage === 'Fechado') {
    const { data: existingDeal } = await supabase
      .from('deals')
      .select('id, lead_id, product_id, consultant_id, value')
      .eq('lead_id', leadId)
      .maybeSingle()

    if (existingDeal) {
      const contract = await upsertPendingContractFromDeal(
        supabase,
        existingDeal,
        {
          lead: leadSnapshot,
          clientId: clientSnapshot?.id || (leadSnapshot as { client_id?: string | null } | null)?.client_id || null,
          contractFields: { status: 'ativo', signed_at: new Date().toISOString() },
        }
      )

      if (contract) {
        await recordCommercialActivity({
          leadId,
          dealId: existingDeal.id,
          clientId: clientSnapshot?.id || (leadSnapshot as { client_id?: string | null } | null)?.client_id || null,
          contractId: contract.id,
          consultantId: existingDeal.consultant_id ?? null,
          activityType: 'fechamento',
          subject: `Fechamento registrado para ${leadSnapshot?.name || 'lead'}`,
          summary: 'Contrato gerado automaticamente a partir do fechamento do lead.',
          nextStep: 'Preencher dados do contrato, anexar PDF e ativar.',
          status: contract.status ?? 'pendente_assinatura',
        })
      }
    } else {
      const lead = leadSnapshot

      if (lead) {
        const { data: deal } = await supabase.from('deals').insert({
          lead_id: lead.id,
          product_id: lead.product_id,
          consultant_id: lead.consultant_id,
          value: lead.expected_value,
          closed_at: new Date().toISOString()
        }).select().single()

        if (deal) {
          const contract = await upsertPendingContractFromDeal(supabase, deal, {
            lead,
            clientId: clientSnapshot?.id || (lead as { client_id?: string | null } | null)?.client_id || null,
            contractFields: { status: 'ativo', signed_at: new Date().toISOString() },
          })

          if (contract) {
            await recordCommercialActivity({
              leadId: lead.id,
              dealId: deal.id,
              clientId: clientSnapshot?.id || (lead as { client_id?: string | null } | null)?.client_id || null,
              contractId: contract.id,
              consultantId: deal.consultant_id ?? null,
              activityType: 'fechamento',
              subject: `Fechamento registrado para ${lead.name}`,
              summary: 'Contrato gerado automaticamente a partir do fechamento do lead.',
              nextStep: 'Preencher dados do contrato, anexar PDF e ativar.',
              status: contract.status ?? 'pendente_assinatura',
            })
          }

          const dealValueNum = Number(deal.value || 0)

          // Busca produto para obter tipo_comissao e comissao_fixa_valor
          const { data: product } = await supabase
            .from('products')
            .select('tipo_comissao, comissao_fixa_valor')
            .eq('id', deal.product_id)
            .maybeSingle()

          // Calcula comissão fixa baseada no tipo do produto
          const { calcularComissaoFixa } = await import('@/app/actions/commissions')
          const amount = await calcularComissaoFixa(
            product?.tipo_comissao ?? null,
            Number(product?.comissao_fixa_valor ?? 0)
          )

          if (amount > 0) {
            await supabase.from('commissions').insert({
              deal_id: deal.id,
              profile_id: deal.consultant_id,
              amount,
              type: 'FIXA',
              commission_type: 'FIXA',
              status: 'pendente'
            })

            const xpBonus = dealValueNum >= 10000 ? 500 : 0
            const calculatedXP = Math.floor(dealValueNum * 0.01) + 100 + xpBonus

            await supabase.from('xp_logs').insert({
              profile_id: deal.consultant_id,
              action: deal.value >= 10000 ? 'Boss Defeated (Grande Negocio)' : 'Contrato fechado',
              xp_amount: calculatedXP,
              reference_id: deal.id
            })
          }
        }
      }
    }
  }

  revalidatePath('/dashboard/pipeline')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/comissoes')
  revalidatePath('/dashboard/ranking')
  return { success: true }
}

export async function createLead(data: {
  name: string
  company: string
  product_id: string
  consultant_id: string
  expected_value: number
  stage: string
  phone?: string
  whatsapp?: string
  email?: string
  ai_status?: string
  ai_score?: number
  ai_source?: string
  ai_summary?: string
  cnpj?: string
  regime_tributario?: string
  faturamento_estimado?: number
  segmento_especifico?: string
  client_id?: string | null
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  // if (!user) return { success: false, error: 'Nao autorizado.', lead: null }

  const document = normalizeDocument(data.cnpj)
  if (document) {
    const duplicate = await findExistingDocumentOwner(supabase, document, undefined, data.client_id ?? null)
    if (duplicate.error) return { success: false, error: duplicate.error, lead: null }
    if (duplicate.owner) {
      return { success: false, error: `Documento já cadastrado para ${duplicate.owner}. Não é permitido duplicar CNPJ/CPF.`, lead: null }
    }
  }

  let leadPayload: Record<string, unknown> = {
    name: data.name,
    company_name: data.company || null,
    stage: data.stage,
    expected_value: data.expected_value || 0,
    product_id: data.product_id || null,
    consultant_id: data.consultant_id || null,
    phone: data.phone || null,
    whatsapp: data.whatsapp || null,
    email: data.email || null,
    client_id: data.client_id || null,
    cnpj: document,
    regime_tributario: data.regime_tributario || null,
    faturamento_estimado: data.faturamento_estimado || null,
    segmento_especifico: data.segmento_especifico || null,
    created_at: new Date().toISOString(),
  }

  let lead: PipelineLeadRecord | null = null
  let error: { message: string } | null = null

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const result = await supabase
      .from('leads')
      .insert(leadPayload)
      .select()
      .single()

    lead = result.data as PipelineLeadRecord | null
    error = result.error

    if (!error) break

    const missingColumn = error.message.match(/'([^']+)' column/)?.[1]
    if (!missingColumn || !(missingColumn in leadPayload)) break

    const nextPayload = { ...leadPayload }
    delete nextPayload[missingColumn]
    leadPayload = nextPayload
  }

  if (error) {
    console.error('Erro ao criar lead:', error)
    return { success: false, error: error.message, lead: null }
  }

  if (lead?.id) {
    await createStageEvent(supabase, { leadId: lead.id, toStage: data.stage })
    await upsertAiQualification(supabase, {
      leadId: lead.id,
      status: data.ai_status,
      score: data.ai_score,
      source: data.ai_source,
      summary: data.ai_summary,
    })

    await ensureClientForLead(
      supabase,
      lead,
      data.stage === 'Fechado' ? 'aguardando_contrato' : 'lead'
    )

    await recordCommercialActivity({
      leadId: lead.id,
      consultantId: lead.consultant_id ?? null,
      activityType: 'lead_entry',
      subject: `Entrada do lead ${lead.name}`,
      summary: [lead.company_name || lead.company ? `Empresa: ${lead.company_name || lead.company}` : null, lead.email ? `Email: ${lead.email}` : null, lead.phone ? `Telefone: ${lead.phone}` : null]
        .filter(Boolean)
        .join(' | ') || 'Lead criado no sistema.',
      nextStep: data.stage === 'Fechado'
        ? 'Gerar contrato automaticamente.'
        : 'Agendar primeira reunião e estruturar pauta.',
      status: 'registrada',
    })

    // Disparar análise Aura Pro assincronamente
    void generateLeadIntelligence(lead.id)
  }

  revalidatePath('/dashboard/pipeline')
  revalidatePath('/dashboard/clientes')
  revalidatePath('/dashboard')
  return { success: true, lead }
}

export async function updateLead(leadId: string, data: {
  name?: string
  company?: string
  product_id?: string
  consultant_id?: string
  expected_value?: number
  phone?: string
  whatsapp?: string
  email?: string
  ai_status?: string
  ai_score?: number
  ai_source?: string
  ai_summary?: string
  cnpj?: string
  regime_tributario?: string
  faturamento_estimado?: number
  segmento_especifico?: string
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  // if (!user) return { success: false, error: 'Nao autorizado.' }

  const { ai_status, ai_score, ai_source, ai_summary, cnpj, regime_tributario, faturamento_estimado, segmento_especifico, ...leadData } = data
  const { data: currentLeadForDocument } = await supabase
    .from('leads')
    .select('client_id')
    .eq('id', leadId)
    .maybeSingle()

  const document = normalizeDocument(cnpj)
  if (document) {
    const duplicate = await findExistingDocumentOwner(supabase, document, leadId, currentLeadForDocument?.client_id ?? null)
    if (duplicate.error) return { success: false, error: duplicate.error }
    if (duplicate.owner) {
      return { success: false, error: `Documento já cadastrado para ${duplicate.owner}. Não é permitido duplicar CNPJ/CPF.` }
    }
  }

  let updatePayload: Record<string, unknown> = {
    ...leadData,
    cnpj: document,
    regime_tributario: regime_tributario || null,
    faturamento_estimado: faturamento_estimado || null,
    segmento_especifico: segmento_especifico || null,
    updated_at: new Date().toISOString(),
  }

  let error: { message: string } | null = null
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const result = await supabase
      .from('leads')
      .update(updatePayload)
      .eq('id', leadId)

    error = result.error
    if (!error) break

    const missingColumn = error.message.match(/'([^']+)' column/)?.[1]
    if (!missingColumn || !(missingColumn in updatePayload)) break

    const nextPayload = { ...updatePayload }
    delete nextPayload[missingColumn]
    updatePayload = nextPayload
  }

  if (error) {
    console.error('Erro ao atualizar lead:', error)
    return { success: false, error: error.message }
  }

  await upsertAiQualification(supabase, {
    leadId,
    status: ai_status,
    score: ai_score,
    source: ai_source,
    summary: ai_summary,
  })

  const { data: updatedLead } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .maybeSingle()

  if (updatedLead) {
    await ensureClientForLead(
      supabase,
      updatedLead,
      updatedLead.stage === 'Fechado' ? 'aguardando_contrato' : 'lead'
    )
    // Disparar análise Aura Pro assincronamente ao atualizar
    void generateLeadIntelligence(leadId)
  }

  revalidatePath('/dashboard/pipeline')
  revalidatePath('/dashboard/clientes')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteLead(leadId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  // if (!user) return { success: false, error: 'Nao autorizado.' }

  const { error } = await supabase.from('leads').delete().eq('id', leadId)

  if (error) {
    console.error('Erro ao remover lead:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/pipeline')
  revalidatePath('/dashboard/clientes')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function saveLeadDocument(data: {
  leadId: string
  clientId?: string | null
  fileName: string
  filePath: string
  fileType?: string
  fileSize?: number
  category?: string
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  // if (!user) return { success: false, error: 'Nao autorizado.' }

  const { error } = await supabase.from('lead_documents').insert({
    lead_id: data.leadId,
    client_id: data.clientId || null,
    file_name: data.fileName,
    file_path: data.filePath,
    file_type: data.fileType || null,
    file_size: data.fileSize || 0,
    category: data.category || 'contract',
    uploaded_by: user?.id
  })

  if (error) {
    console.error('Erro ao salvar documento do lead:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/pipeline')
  return { success: true }
}

export async function getLeadDocuments(leadId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('lead_documents')
    .select('*')
    .eq('lead_id', leadId)
    .order('uploaded_at', { ascending: false })

  if (error) {
    console.error('Erro ao buscar documentos do lead:', error)
    return []
  }

  return data
}
