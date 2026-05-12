'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Gera a análise de inteligência comercial para um lead específico, 
 * utilizando o framework de 4 agentes solicitado.
 */
export async function generateLeadIntelligence(leadId: string) {
  try {
    const supabase = await createClient()

    // 1. Coletar dados do lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*, products(name, description)')
      .eq('id', leadId)
      .single()

    if (leadError || !lead) throw new Error('Lead não encontrado')

    // 2. Coletar atividades recentes para contexto
    const { data: activities } = await supabase
      .from('commercial_activities')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(10)

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('Chave de API da OpenAI não configurada')

    // 3. Montar Prompt dos 4 Agentes
    const prompt = `
    Você é o Sistema de Inteligência Comercial da Palin & Martins Organização Tributária.
    Analise o seguinte LEAD e gere um relatório coordenado entre seus 4 agentes especialistas.

    DADOS DO LEAD:
    - Nome: ${lead.name}
    - Empresa: ${lead.company}
    - CNPJ: ${lead.cnpj || 'Não informado'}
    - Regime Tributário: ${lead.regime_tributario || 'Não informado'}
    - Faturamento Estimado: R$ ${lead.faturamento_estimado || 0}
    - Segmento: ${lead.segmento_especifico || 'Não informado'}
    - Produto de Interesse: ${lead.products?.name || 'Geral'}
    - Notas Atuais: ${lead.notes || 'Nenhuma'}

    HISTÓRICO DE ATIVIDADES:
    ${activities?.map(a => `- ${a.activity_type}: ${a.description}`).join('\n') || 'Sem interações registradas.'}

    ESTRUTURA DO RELATÓRIO (MANDATÓRIO):

    ### 1. AGENTE 1 — PROSPECÇÃO & QUALIFICAÇÃO
    Avalie o Fit de ICP (Ideal Customer Profile). Identifique se o regime tributário e faturamento condizem com nossas especialidades.
    Dê um SCORE de 0 a 100 para o lead.

    ### 2. AGENTE 2 — ESTRATÉGIA DE PIPELINE & CRM
    Defina a melhor próxima abordagem. Crie um gancho mental para a próxima reunião/ligação. Sugira a urgência no funil.

    ### 3. AGENTE 3 — KPIs, METAS & VALOR FINANCEIRO
    Estime o potencial de recuperação tributária ou valor de contrato recorrente baseado no faturamento e segmento. Projete o ROI para o cliente.

    ### 4. AGENTE 4 — PÓS-VENDA, RETENÇÃO & UPSELL
    Quais outros produtos da Palin podemos oferecer no futuro (Cross-sell)? Como garantir que este cliente fique conosco por 22+ anos?

    RESPONDA EM PORTUGUÊS DO BRASIL. Formate com Markdown rico. No final, retorne um objeto JSON puro para extração de dados com os campos: 
    { "score": number, "match_icp": number, "prioridade": "baixa"|"media"|"alta", "dor_principal": string, "potencial_financeiro": string }
    `

    // 4. Chamada a OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.7
      })
    })

    const aiResult = await response.json()
    const fullMarkdown = aiResult.choices[0].message.content

    // 5. Extrair JSON do final da resposta (melhorado)
    let extractedData = { score: 50, match_icp: 50, prioridade: 'media', dor_principal: 'Não identificada', potencial_financeiro: 'A avaliar' }
    try {
      const jsonMatch = fullMarkdown.match(/\{[\s\S]*?\}/g)
      if (jsonMatch) {
         const lastJson = jsonMatch[jsonMatch.length - 1]
         extractedData = JSON.parse(lastJson)
      }
    } catch (e) {
      console.warn('Falha ao extrair JSON da IA:', e)
    }

    // 6. Persistir no histórico e atualizar qualificações
    const { data: { user } } = await supabase.auth.getUser()

    await Promise.all([
      // Salvar no histórico de logs
      supabase.from('lead_intelligence_history').insert({
        lead_id: leadId,
        full_markdown: fullMarkdown,
        report_json: extractedData,
        created_by: user?.id
      }),
      // Atualizar/Inserir na tabela de qualificações rápida
      supabase.from('ai_qualifications').upsert({
        lead_id: leadId,
        score: extractedData.score,
        match_icp: extractedData.match_icp,
        prioridade_comercial: extractedData.prioridade,
        dor_principal: extractedData.dor_principal,
        potencial_financeiro_detalhado: extractedData.potencial_financeiro,
        summary: fullMarkdown.split('###')[1]?.trim().slice(0, 500) || 'Análise gerada',
        status: 'avaliado',
        updated_at: new Date().toISOString()
      }, { onConflict: 'lead_id' })
    ])

    revalidatePath('/dashboard/pipeline')
    return { success: true, report: fullMarkdown }
  } catch (error) {
    console.error('Erro ao gerar inteligência:', error)
    return { success: false, error: 'Falha na análise da IA' }
  }
}

/**
 * Recupera o último relatório de inteligência de um lead ou cliente.
 */
export async function getLatestIntelligence(leadId: string) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('lead_intelligence_history')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (error) return null
    return data
}

/**
 * Recupera todo o histórico de inteligência de um lead.
 */
export async function getIntelligenceHistory(leadId: string) {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('lead_intelligence_history')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Erro ao buscar histórico:', error)
    return []
  }
  return data
}
