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

    const now = new Date();
    let diasSemContato = 0;
    if (activities && activities.length > 0) {
      const lastActivityDate = new Date(activities[0].created_at);
      diasSemContato = Math.floor((now.getTime() - lastActivityDate.getTime()) / (1000 * 3600 * 24));
    } else {
      const leadCreationDate = new Date(lead.created_at || now);
      diasSemContato = Math.floor((now.getTime() - leadCreationDate.getTime()) / (1000 * 3600 * 24));
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('Chave de API da OpenAI não configurada')

    // 3. Montar Prompt Específico e Orientado a Ação
    const prompt = `
    Você é o Sistema de Inteligência Comercial da Palin & Martins Organização Tributária.
    Analise o seguinte LEAD e gere um relatório ESTRATÉGICO focado em AÇÕES CLARAS. O objetivo principal é dizer ao consultor O QUE FAZER, especialmente se o lead estiver esfriando.

    DADOS DO LEAD:
    - Nome: ${lead.name}
    - Empresa: ${lead.company}
    - CNPJ: ${lead.cnpj || 'Não informado'}
    - Regime Tributário: ${lead.regime_tributario || 'Não informado'}
    - Faturamento Estimado: R$ ${lead.faturamento_estimado || 0}
    - Segmento: ${lead.segmento_especifico || 'Não informado'}
    - Produto de Interesse: ${lead.products?.name || 'Geral'}
    - Etapa do Funil: ${lead.stage || 'Não informada'}
    - Dias sem contato: ${diasSemContato} dias
    - Notas Atuais: ${lead.notes || 'Nenhuma'}

    HISTÓRICO DE ATIVIDADES:
    ${activities?.map(a => `- ${new Date(a.created_at).toLocaleDateString('pt-BR')}: ${a.activity_type} - ${a.description}`).join('\n') || 'Sem interações registradas.'}

    MANDATÓRIO: O cliente está a ${diasSemContato} dias sem contato. 
    Se "Dias sem contato" for maior que 5 (para leads em funil) ou se não houver histórico, ATIVE LUZ VERMELHA DE ATENÇÃO. Seja prescritivo e direto.

    ESTRUTURA DO RELATÓRIO (MANDATÓRIO, USE EXATAMENTE ESTES CABEÇALHOS):

    ### 🚨 STATUS E URGÊNCIA
    Destaque se o lead está quente, morno ou esquecido. Se o alerta vermelho estiver ativo, escreva "[ALERTA VERMELHO] Lead sem contato há ${diasSemContato} dias!" e explique o risco de perda.

    ### 🎯 PLANO DE AÇÃO IMEDIATO (PRIORIDADES)
    Liste exatamente o que o consultor precisa fazer AGORA para avançar o negócio. Seja acionável. Exemplo:
    1º Ligar para X e perguntar sobre Y.
    2º Enviar e-mail de follow-up com o material Z.
    3º Preparar simulação de crédito.

    ### 💰 FIT E POTENCIAL FINANCEIRO
    Score de ICP (0 a 100), resumo rápido do porquê esse lead tem valor e expectativa de ROI.

    ### 🔄 OPORTUNIDADES DE CROSS-SELL
    Baseado no segmento e regime, quais outros serviços da Palin podem ser encaixados na mesma abordagem?

    RESPONDA EM PORTUGUÊS DO BRASIL com Markdown rico.
    No final, RETORNE UM OBJETO JSON PURO para o sistema renderizar no Frontend. 
    Estrutura JSON esperada:
    {
      "score": number,
      "match_icp": number,
      "prioridade": "baixa"|"media"|"alta",
      "dor_principal": string,
      "potencial_financeiro": string,
      "dias_sem_contato": number,
      "alerta_vermelho": boolean,
      "acoes_recomendadas": ["Ação acionável 1", "Ação acionável 2"],
      "cor_indicativa": "verde"|"amarelo"|"vermelho"
    }
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
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6
      })
    })

    const aiResult = await response.json()
    if (!response.ok) {
      throw new Error(`OpenAI error: ${aiResult.error?.message || response.statusText}`);
    }
    const fullMarkdown = aiResult.choices?.[0]?.message?.content || '{}'

    // 5. Extrair JSON do final da resposta (melhorado)
    let extractedData = { 
      score: 50, match_icp: 50, prioridade: 'media', 
      dor_principal: 'Não identificada', potencial_financeiro: 'A avaliar',
      dias_sem_contato: diasSemContato, alerta_vermelho: diasSemContato > 5,
      acoes_recomendadas: ['Retomar contato e entender momento'],
      cor_indicativa: 'amarelo'
    }
    try {
      const jsonMatch = fullMarkdown.match(/\{[\s\S]*?\}/g)
      if (jsonMatch) {
         const lastJson = jsonMatch[jsonMatch.length - 1]
         const parsed = JSON.parse(lastJson)
         extractedData = { ...extractedData, ...parsed }
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
        status: extractedData.cor_indicativa || (extractedData.alerta_vermelho ? 'vermelho' : 'verde'),
        source: 'Aura Pro',
        summary: `Prioridade: ${extractedData.prioridade}. Dor: ${extractedData.dor_principal}.`,
        reviewed_at: new Date().toISOString()
      }, { onConflict: 'lead_id' })
    ])

    revalidatePath('/dashboard/pipeline')
    return { success: true, report: fullMarkdown, data: extractedData }
  } catch (error) {
    console.error('Erro ao gerar inteligência:', error)
    const message = error instanceof Error ? error.message : 'Falha na análise da IA'
    const friendly = /quota|billing/i.test(message)
      ? 'Cota da OpenAI excedida. Verifique o plano e o faturamento em platform.openai.com.'
      : message
    return { success: false, error: friendly }
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

/**
 * Busca os planos de ação e relatórios da IA para uma lista de leads.
 * Útil para popular alertas no painel "Atenção Requerida".
 */
export async function getUrgentLeadsActionPlans(leadIds: string[]) {
  if (!leadIds || leadIds.length === 0) return {}
  
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('lead_intelligence_history')
    .select('lead_id, report_json, created_at')
    .in('lead_id', leadIds)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Erro ao buscar action plans de urgência:', error)
    return {}
  }

  // Pegar apenas o mais recente de cada lead
  const map: Record<string, any> = {}
  data.forEach(record => {
    if (!map[record.lead_id]) {
      map[record.lead_id] = record.report_json
    }
  })

  return map
}
