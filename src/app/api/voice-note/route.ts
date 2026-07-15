export const maxDuration = 60;
import { NextResponse } from 'next/server'
import { recordCommercialActivity } from '@/app/actions/commercial-activities'

export type TriggerType = 'followup' | 'reuniao' | 'proposta' | 'urgente' | 'fechamento' | 'nota'

export interface VoiceNoteResult {
  transcription: string
  text: string
  summary: string
  pauta: string | null
  agenda: string | null
  nextSteps: string[]
  action_items: string[]
  suggestedActivityType: string
  trigger: TriggerType
  triggerLabel: string
  triggerEmoji: string
  clientMessage: string
  nextStep: string
  saved: boolean
  status: 'saved' | 'not_saved_missing_relation' | 'not_saved_error' | 'not_saved_no_user'
  activityId: string | null
  activity: unknown | null
}

const TRIGGER_META: Record<TriggerType, { label: string; emoji: string; activityType: string }> = {
  followup:   { label: 'Follow-up',       emoji: '📞', activityType: 'ligacao'    },
  reuniao:    { label: 'Agendar Reunião', emoji: '📅', activityType: 'reuniao'    },
  proposta:   { label: 'Enviar Proposta', emoji: '📄', activityType: 'email'      },
  urgente:    { label: 'Urgente',         emoji: '🚨', activityType: 'nota_audio' },
  fechamento: { label: 'Fechamento',      emoji: '🤝', activityType: 'fechamento' },
  nota:       { label: 'Nota Interna',    emoji: '📝', activityType: 'nota_audio' },
}

const SUPPORTED_AUDIO_TYPES: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'mp4',
  'audio/x-m4a': 'm4a',
  'audio/m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
}

function firstText(formData: FormData, names: string[]) {
  for (const name of names) {
    const value = formData.get(name)
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function normalizedAudioFilename(file: File, fallback = 'audio.webm') {
  const currentName = file.name || fallback
  const currentExtension = currentName.includes('.') ? currentName.split('.').pop()?.toLowerCase() : null
  const mimeBase = (file.type || '').split(';')[0].toLowerCase()
  const inferredExtension = SUPPORTED_AUDIO_TYPES[mimeBase]

  if (currentExtension && Object.values(SUPPORTED_AUDIO_TYPES).includes(currentExtension)) {
    return currentName
  }

  return `audio.${inferredExtension || 'webm'}`
}

function parseJsonObject(raw: string) {
  try {
    return JSON.parse(raw)
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0])
    } catch {
      return null
    }
  }
}

function normalizeStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/\n|;|\.\s+/)
      .map((item) => item.replace(/^[-*\d.)\s]+/, '').trim())
      .filter(Boolean)
  }

  return []
}

export async function POST(req: Request) {
  try {
    const groqKey = process.env.GROQ_API_KEY
    if (!groqKey) {
      return NextResponse.json({ error: 'Chave Groq nao configurada.' }, { status: 500 })
    }

    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return NextResponse.json({ error: 'Envie o audio usando multipart/form-data.' }, { status: 400 })
    }
    const audioEntry = formData.get('audio') || formData.get('file') || formData.get('recording')
    const audio = audioEntry instanceof File ? audioEntry : null
    const leadId = firstText(formData, ['leadId', 'lead_id'])
    const clientId = firstText(formData, ['clientId', 'client_id'])
    const dealId = firstText(formData, ['dealId', 'deal_id'])
    const meetingId = firstText(formData, ['meetingId', 'meeting_id'])
    const leadName = firstText(formData, ['leadName', 'lead_name', 'clientName', 'client_name'])
    const requestedActivityType = firstText(formData, ['activityType', 'activity_type', 'type'])

    if (!audio || audio.size === 0) {
      return NextResponse.json({ error: 'Nenhum audio recebido.' }, { status: 400 })
    }

    const whisperForm = new FormData()
    whisperForm.append('file', audio, normalizedAudioFilename(audio))
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
      return NextResponse.json({ error: 'Falha na transcricao de voz.', details: err }, { status: 502 })
    }

    const transcription = (await whisperRes.text()).trim()
    if (!transcription) {
      return NextResponse.json({ error: 'Transcricao vazia. Nenhuma fala detectada.' }, { status: 422 })
    }

    const analysisPrompt = `Você é assistente comercial da Palin & Martins Assessoria Tributária.

O consultor gravou uma nota de voz sobre o cliente${leadName ? ` "${leadName}"` : ''}.
Transcrição: "${transcription}"

Responda EXCLUSIVAMENTE com um JSON válido (sem markdown, sem explicações):
{
  "trigger": "<um de: followup | reuniao | proposta | urgente | fechamento | nota>",
  "summary": "<resumo objetivo da conversa em ate 4 linhas>",
  "agenda": "<pauta da reuniao ou pauta da ligacao quando houver; null se nao houver>",
  "nextSteps": ["<proximo passo concreto>"],
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
    let summary = transcription
    let agenda: string | null = null
    let nextSteps: string[] = []
    let nextStep = 'Registrar a atividade no CRM e definir proximo contato.'

    if (llmRes.ok) {
      try {
        const llmData = await llmRes.json() as { choices?: { message?: { content?: string } }[] }
        const raw = llmData.choices?.[0]?.message?.content?.trim() || '{}'
        const parsed = parseJsonObject(raw) as {
          trigger?: string
          summary?: string
          agenda?: string | null
          pauta?: string | null
          nextSteps?: unknown
          action_items?: unknown
          clientMessage?: string
          nextStep?: string
        } | null

        if (parsed?.trigger && parsed.trigger in TRIGGER_META) trigger = parsed.trigger as TriggerType
        if (parsed?.summary) summary = parsed.summary
        if (parsed?.agenda || parsed?.pauta) agenda = parsed.agenda || parsed.pauta || null
        nextSteps = normalizeStringArray(parsed?.nextSteps ?? parsed?.action_items)
        if (parsed?.clientMessage) clientMessage = parsed.clientMessage
        if (parsed?.nextStep) nextStep = parsed.nextStep
      } catch {
        console.warn('[voice-note] LLM parse error - usando defaults')
      }
    }

    if (!nextSteps.length) nextSteps = [nextStep]
    const normalizedRequestedType = requestedActivityType === 'call' ? 'ligacao'
      : requestedActivityType === 'meeting' ? 'reuniao'
      : requestedActivityType === 'note' ? 'nota_audio'
      : requestedActivityType
    const inferredMeta = TRIGGER_META[trigger]
    const suggestedActivityType = normalizedRequestedType || inferredMeta.activityType
    const activityType = ['reuniao', 'ligacao', 'nota_audio', 'nota', 'email', 'fechamento'].includes(suggestedActivityType)
      ? suggestedActivityType
      : inferredMeta.activityType

    let saved = false
    let status: VoiceNoteResult['status'] = 'not_saved_missing_relation'
    let activityId: string | null = null
    let activity: unknown | null = null

    if (leadId || clientId || dealId || meetingId) {
      try {
        const subjectPrefix = activityType === 'reuniao' ? 'Reuniao por audio'
          : activityType === 'ligacao' ? 'Ligacao por audio'
          : 'Nota de voz'
        const result = await recordCommercialActivity({
          leadId,
          clientId,
          dealId,
          meetingId,
          activityType,
          subject: `${subjectPrefix} - ${new Date().toLocaleDateString('pt-BR')}`,
          agenda,
          summary: [
            summary,
            '',
            'Transcricao original:',
            transcription,
            clientMessage ? `\nMensagem sugerida:\n${clientMessage}` : '',
          ].filter(Boolean).join('\n'),
          nextStep: nextSteps.join('\n'),
          status: activityType === 'reuniao' ? 'realizada' : 'registrada',
        })

        saved = Boolean(result.success && result.data?.id)
        activityId = result.data?.id || null
        activity = result.data || null
        status = saved ? 'saved' : result.success ? 'not_saved_error' : 'not_saved_error'
      } catch (error) {
        console.warn('[voice-note] Falha ao salvar atividade comercial:', error)
        status = 'not_saved_error'
      }
    }

    return NextResponse.json({
      transcription,
      text: transcription,
      summary,
      pauta: agenda,
      agenda,
      nextSteps,
      action_items: nextSteps,
      suggestedActivityType: activityType,
      trigger,
      triggerLabel: inferredMeta.label,
      triggerEmoji: inferredMeta.emoji,
      clientMessage,
      nextStep,
      saved,
      status,
      activityId,
      activity,
    } satisfies VoiceNoteResult)

  } catch (error) {
    console.error('[voice-note] Erro critico:', error)
    return NextResponse.json({ error: 'Erro interno ao processar o audio.' }, { status: 500 })
  }
}
