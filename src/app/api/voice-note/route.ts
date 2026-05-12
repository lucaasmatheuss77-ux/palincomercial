import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export type TriggerType = 'followup' | 'reuniao' | 'proposta' | 'urgente' | 'fechamento' | 'nota'

export interface VoiceNoteResult {
  transcription: string
  trigger: TriggerType
  triggerLabel: string
  triggerEmoji: string
  clientMessage: string      // mensagem redigida para enviar ao cliente
  nextStep: string           // próximo passo sugerido para o consultor
  saved: boolean
  activityId: string | null
}

const TRIGGER_META: Record<TriggerType, { label: string; emoji: string; activityType: string }> = {
  followup:   { label: 'Follow-up',       emoji: '📞', activityType: 'ligacao' },
  reuniao:    { label: 'Agendar Reunião', emoji: '📅', activityType: 'reuniao' },
  proposta:   { label: 'Enviar Proposta', emoji: '📄', activityType: 'email' },
  urgente:    { label: 'Urgente',         emoji: '🚨', activityType: 'nota' },
  fechamento: { label: 'Fechamento',      emoji: '🤝', activityType: 'fechamento' },
  nota:       { label: 'Nota Interna',    emoji: '📝', activityType: 'nota' },
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      return NextResponse.json({ error: 'Chave de API não configurada.' }, { status: 500 })
    }

    const formData   = await req.formData()
    const audio      = formData.get('audio')    as File | null
    const leadId     = formData.get('leadId')   as string | null
    const leadName   = formData.get('leadName') as string | null

    if (!audio || audio.size === 0) {
      return NextResponse.json({ error: 'Nenhum áudio recebido.' }, { status: 400 })
    }

    // ── 1. Transcrever com Whisper ────────────────────────────────────────
    const whisperForm = new FormData()
    whisperForm.append('file', audio, 'audio.webm')
    whisperForm.append('model', 'whisper-1')
    whisperForm.append('language', 'pt')
    whisperForm.append('response_format', 'text')

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: whisperForm,
    })

    if (!whisperRes.ok) {
      console.error('[voice-note] Whisper error:', await whisperRes.text())
      return NextResponse.json({ error: 'Falha na transcrição de voz.' }, { status: 500 })
    }

    const transcription = (await whisperRes.text()).trim()
    if (!transcription) {
      return NextResponse.json({ error: 'Transcrição vazia — nenhuma fala detectada.' }, { status: 422 })
    }

    // ── 2. Análise de gatilho + mensagem para o cliente (GPT-4o-mini) ─────
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

    const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: analysisPrompt }],
        temperature: 0.4,
        max_tokens: 400,
      }),
    })

    let trigger: TriggerType = 'nota'
    let clientMessage = ''
    let nextStep = 'Registrar a atividade no CRM e definir próximo contato.'

    if (gptRes.ok) {
      try {
        const gptData = await gptRes.json() as { choices?: { message?: { content?: string } }[] }
        const raw = gptData.choices?.[0]?.message?.content?.trim() || '{}'
        const parsed = JSON.parse(raw) as { trigger?: string; clientMessage?: string; nextStep?: string }

        if (parsed.trigger && parsed.trigger in TRIGGER_META) trigger = parsed.trigger as TriggerType
        if (parsed.clientMessage) clientMessage = parsed.clientMessage
        if (parsed.nextStep)      nextStep      = parsed.nextStep
      } catch {
        console.warn('[voice-note] GPT parse error — usando defaults')
      }
    }

    const meta = TRIGGER_META[trigger]

    // ── 3. Salvar no CRM ──────────────────────────────────────────────────
    let saved = false
    let activityId: string | null = null

    if (leadId) {
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

      if (activity?.id) {
        saved = true
        activityId = activity.id
      }
    }

    const result: VoiceNoteResult = {
      transcription,
      trigger,
      triggerLabel: meta.label,
      triggerEmoji: meta.emoji,
      clientMessage,
      nextStep,
      saved,
      activityId,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[voice-note] Erro crítico:', error)
    return NextResponse.json({ error: 'Erro interno ao processar o áudio.' }, { status: 500 })
  }
}
