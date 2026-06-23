import { NextResponse } from 'next/server'

export type TriggerType = 'followup' | 'reuniao' | 'proposta' | 'urgente' | 'fechamento' | 'nota'

export interface VoiceNoteResult {
  transcription: string
  trigger: TriggerType
  triggerLabel: string
  triggerEmoji: string
  clientMessage: string
  nextStep: string
  saved: boolean
  activityId: string | null
}

const TRIGGER_META: Record<TriggerType, { label: string; emoji: string; activityType: string }> = {
  followup:   { label: 'Follow-up',       emoji: '📞', activityType: 'ligacao'    },
  reuniao:    { label: 'Agendar Reunião', emoji: '📅', activityType: 'reuniao'    },
  proposta:   { label: 'Enviar Proposta', emoji: '📄', activityType: 'email'      },
  urgente:    { label: 'Urgente',         emoji: '🚨', activityType: 'nota'       },
  fechamento: { label: 'Fechamento',      emoji: '🤝', activityType: 'fechamento' },
  nota:       { label: 'Nota Interna',    emoji: '📝', activityType: 'nota'       },
}

export async function POST(req: Request) {
  try {
    const groqKey = process.env.GROQ_API_KEY
    if (!groqKey) {
      return NextResponse.json({ error: 'Chave Groq não configurada.' }, { status: 500 })
    }

    const formData = await req.formData()
    const audio    = formData.get('audio')    as File | null
    const leadId   = formData.get('leadId')   as string | null
    const leadName = formData.get('leadName') as string | null

    if (!audio || audio.size === 0) {
      return NextResponse.json({ error: 'Nenhum áudio recebido.' }, { status: 400 })
    }

    // ── 1. Transcrever com Groq Whisper ───────────────────────────────────
    const whisperForm = new FormData()
    whisperForm.append('file', audio, 'audio.webm')
    whisperForm.append('model', 'whisper-large-v3-turbo')
    whisperForm.append('language', 'pt')
    whisperForm.append('response_format', 'text')

    const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}` },
      body: whisperForm,
    })

    if (!whisperRes.ok) {
      const err = await whisperRes.text()
      console.error('[voice-note] Groq Whisper error:', err)
      return NextResponse.json({ error: 'Falha na transcrição de voz.' }, { status: 500 })
    }

    const transcription = (await whisperRes.text()).trim()
    if (!transcription) {
      return NextResponse.json({ error: 'Transcrição vazia — nenhuma fala detectada.' }, { status: 422 })
    }

    // ── 2. Análise com Groq Llama 3 (ultrarrápido) ────────────────────────
    const analysisPrompt = `Você é assistente comercial da Palin & Martins Assessoria Tributária.

O consultor gravou uma nota de voz sobre o cliente${leadName ? ` "${leadName}"` : ''}.
Transcrição: "${transcription}"

Responda EXCLUSIVAMENTE com um JSON válido (sem markdown, sem explicações):
{
  "trigger": "<um de: followup | reuniao | proposta | urgente | fechamento | nota>",
  "clientMessage": "<mensagem profissional e direta para enviar ao cliente via WhatsApp — máximo 3 linhas — em português — natural, sem juridiquês — termine com uma ação clara>",
  "nextStep": "<próximo passo concreto para o consultor — 1 linha — ex: Ligar amanhã às 9h para confirmar reunião>"
}

Regras:
- trigger "nota" apenas se não há nenhuma ação para o cliente
- clientMessage deve ser calorosa mas profissional — NÃO mencione que veio de uma nota de voz
- clientMessage deve referenciar o contexto da conversa de forma natural
- nextStep deve ser específico com prazo quando possível`

    const llmRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: analysisPrompt }],
        temperature: 0.4,
        max_tokens: 400,
        response_format: { type: 'json_object' },
      }),
    })

    let trigger: TriggerType = 'nota'
    let clientMessage = ''
    let nextStep = 'Registrar a atividade no CRM e definir próximo contato.'

    if (llmRes.ok) {
      try {
        const llmData = await llmRes.json() as { choices?: { message?: { content?: string } }[] }
        const raw = llmData.choices?.[0]?.message?.content?.trim() || '{}'
        const parsed = JSON.parse(raw) as { trigger?: string; clientMessage?: string; nextStep?: string }

        if (parsed.trigger && parsed.trigger in TRIGGER_META) trigger = parsed.trigger as TriggerType
        if (parsed.clientMessage) clientMessage = parsed.clientMessage
        if (parsed.nextStep)      nextStep      = parsed.nextStep
      } catch {
        console.warn('[voice-note] LLM parse error — usando defaults')
      }
    }

    const meta = TRIGGER_META[trigger]

    // ── 3. Tentar salvar no CRM (falha silenciosa se Supabase offline) ────
    let saved = false
    let activityId: string | null = null

    if (leadId) {
      try {
        const { createClient } = await import('@/lib/supabase/server')
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          const subject = `${meta.emoji} ${meta.label} — ${new Date().toLocaleDateString('pt-BR')}`
          const fullSummary = [
            `📝 Nota de voz: ${transcription}`,
            clientMessage ? `\n💬 Mensagem gerada: ${clientMessage}` : '',
            `\n➡️ Próximo passo: ${nextStep}`,
          ].filter(Boolean).join('')

          const { data: activity } = await supabase
            .from('commercial_activities')
            .insert({
              lead_id:       leadId,
              consultant_id: user.id,
              created_by:    user.id,
              activity_type: meta.activityType,
              subject,
              summary:       fullSummary,
              description:   transcription,
              next_step:     nextStep,
              status:        'registrada',
              created_at:    new Date().toISOString(),
            })
            .select('id')
            .single()

          if (activity?.id) { saved = true; activityId = activity.id }
        }
      } catch {
        // Supabase offline em modo demo — apenas transcreve sem salvar
        console.warn('[voice-note] Supabase offline — modo demo, não salvo no CRM')
      }
    }

    return NextResponse.json({
      transcription, trigger,
      triggerLabel: meta.label,
      triggerEmoji: meta.emoji,
      clientMessage, nextStep, saved, activityId,
    } satisfies VoiceNoteResult)

  } catch (error) {
    console.error('[voice-note] Erro crítico:', error)
    return NextResponse.json({ error: 'Erro interno ao processar o áudio.' }, { status: 500 })
  }
}
