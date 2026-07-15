import { NextRequest, NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { recordCommercialActivity } from '@/app/actions/commercial-activities'

export const maxDuration = 60

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

function normalizedUploadFilename(file: File, fallback = 'meeting-audio.webm') {
  const currentName = file.name || fallback
  const currentExtension = currentName.includes('.') ? currentName.split('.').pop()?.toLowerCase() : null
  const mimeBase = (file.type || '').split(';')[0].toLowerCase()
  const inferredExtension = SUPPORTED_AUDIO_TYPES[mimeBase]

  if (currentExtension && Object.values(SUPPORTED_AUDIO_TYPES).includes(currentExtension)) {
    return currentName
  }

  return `meeting-audio.${inferredExtension || 'webm'}`
}

function normalizeActivityType(value: string | null) {
  if (value === 'call' || value === 'ligacao') return 'ligacao'
  if (value === 'note' || value === 'nota' || value === 'nota_audio') return 'nota_audio'
  return 'reuniao'
}

export async function POST(req: NextRequest) {
  try {
    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return NextResponse.json({ error: 'Envie o audio usando multipart/form-data.' }, { status: 400 })
    }
    const fileEntry = formData.get('audio') || formData.get('file') || formData.get('recording')
    const file = fileEntry instanceof File ? fileEntry : null
    const clientId = firstText(formData, ['client_id', 'clientId'])
    const leadId = firstText(formData, ['lead_id', 'leadId'])
    const dealId = firstText(formData, ['deal_id', 'dealId'])
    const meetingId = firstText(formData, ['meeting_id', 'meetingId'])
    const activityType = normalizeActivityType(firstText(formData, ['activity_type', 'activityType', 'type']))

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'Nenhum arquivo de audio enviado.' }, { status: 400 })
    }

    const openAiApiKey = process.env.OPENAI_API_KEY
    if (!openAiApiKey) {
      return NextResponse.json({ error: 'OpenAI API Key nao configurada.' }, { status: 500 })
    }

    const whisperFormData = new FormData()
    whisperFormData.append('file', file, normalizedUploadFilename(file))
    whisperFormData.append('model', 'whisper-1')
    whisperFormData.append('language', 'pt')
    whisperFormData.append('response_format', 'json')

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
      },
      body: whisperFormData,
    })

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text()
      console.error('[meetings/transcribe] Whisper API error:', errorText)
      return NextResponse.json({ error: 'Erro ao transcrever o audio.', details: errorText }, { status: 502 })
    }

    const whisperData = await whisperResponse.json() as { text?: string }
    const transcription = whisperData.text?.trim() || ''

    if (!transcription) {
      return NextResponse.json({ error: 'Transcricao vazia. Nenhuma fala detectada.' }, { status: 422 })
    }

    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      system: `Voce e um assistente especialista em analisar transcricoes comerciais em portugues.
Extraia campos claros para historico de CRM:
1. agenda: pauta da reuniao ou pauta da ligacao.
2. summary: resumo da conversa.
3. action_items: proximos passos e responsaveis quando houver.`,
      prompt: `Analise a seguinte transcricao comercial e extraia pauta, resumo e proximos passos:\n\n${transcription}`,
      schema: z.object({
        agenda: z.string().nullable().describe('Pauta da reuniao ou pauta da ligacao.'),
        summary: z.string().describe('Resumo objetivo da conversa.'),
        action_items: z.array(z.string()).describe('Lista de proximos passos.'),
      }),
    })

    const nextStepString = object.action_items.length > 0 ? object.action_items.join('\n') : null
    let saved = false
    let status: 'saved' | 'not_saved_missing_relation' | 'not_saved_error' = 'not_saved_missing_relation'
    let activity = null
    let activityId: string | null = null

    if (clientId || leadId || dealId || meetingId) {
      const subject = activityType === 'ligacao'
        ? 'Ligacao gravada transcrita pela IA'
        : activityType === 'nota_audio'
          ? 'Nota de audio transcrita pela IA'
          : 'Reuniao gravada transcrita pela IA'

      const activityResult = await recordCommercialActivity({
        clientId,
        leadId,
        dealId,
        meetingId,
        activityType,
        subject,
        agenda: object.agenda || null,
        summary: `${object.summary}\n\nTranscricao original:\n${transcription}`,
        nextStep: nextStepString,
        status: activityType === 'reuniao' ? 'realizada' : 'registrada',
      })

      if (!activityResult.success) {
        console.error('[meetings/transcribe] Database insertion error:', activityResult.error)
        status = 'not_saved_error'
      } else {
        saved = Boolean(activityResult.data?.id)
        activity = activityResult.data || null
        activityId = activityResult.data?.id || null
        status = saved ? 'saved' : 'not_saved_error'
      }
    }

    return NextResponse.json({
      success: true,
      transcription,
      text: transcription,
      pauta: object.agenda || null,
      agenda: object.agenda || null,
      summary: object.summary,
      nextSteps: object.action_items,
      action_items: object.action_items,
      suggestedActivityType: activityType,
      saved,
      status,
      activityId,
      activity,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido.'
    console.error('[meetings/transcribe] Error:', error)
    return NextResponse.json({ error: 'Erro interno no servidor.', details: message }, { status: 500 })
  }
}
