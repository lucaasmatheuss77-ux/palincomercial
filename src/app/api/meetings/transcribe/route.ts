import { NextRequest, NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('audio') as File | null
    const clientId = formData.get('client_id') as string | null
    const leadId = formData.get('lead_id') as string | null
    const dealId = formData.get('deal_id') as string | null
    const meetingId = formData.get('meeting_id') as string | null

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo de áudio enviado.' }, { status: 400 })
    }

    const openAiApiKey = process.env.OPENAI_API_KEY
    if (!openAiApiKey) {
      return NextResponse.json({ error: 'OpenAI API Key não configurada.' }, { status: 500 })
    }

    // 1. Transcribe audio using Whisper
    const whisperFormData = new FormData()
    whisperFormData.append('file', file)
    whisperFormData.append('model', 'whisper-1')
    whisperFormData.append('language', 'pt') // assuming Portuguese

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
      },
      body: whisperFormData,
    })

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text()
      console.error('Whisper API error:', errorText)
      return NextResponse.json({ error: 'Erro ao transcrever o áudio.' }, { status: 500 })
    }

    const whisperData = await whisperResponse.json()
    const transcription = whisperData.text

    if (!transcription) {
      return NextResponse.json({ error: 'Transcrição vazia.' }, { status: 500 })
    }

    // 2. Extract summary and action items using LLM
    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      system: `Você é um assistente especialista em analisar transcrições de reuniões comerciais. 
Sua tarefa é extrair duas informações principais:
1. Um resumo (Ata da reunião) contendo os pontos principais discutidos.
2. Pautas importantes (Action items), ou seja, os próximos passos ou compromissos firmados.`,
      prompt: `Analise a seguinte transcrição de reunião e extraia o resumo e as pautas importantes:\n\n${transcription}`,
      schema: z.object({
        summary: z.string().describe('O resumo completo da reunião (Ata).'),
        action_items: z.array(z.string()).describe('Lista de pautas importantes ou próximos passos.'),
      }),
    })

    // 3. Save to database
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    const createdBy = userData?.user?.id

    const nextStepString = object.action_items.length > 0 ? object.action_items.join('\n') : null

    const { data: activityData, error: dbError } = await supabase
      .from('commercial_activities')
      .insert({
        client_id: clientId || null,
        lead_id: leadId || null,
        deal_id: dealId || null,
        meeting_id: meetingId || null,
        activity_type: 'reuniao', // Assumed type
        subject: 'Reunião Gravada (Transcrita pela IA)',
        summary: `${object.summary}\n\nTranscrição Original:\n${transcription}`,
        next_step: nextStepString,
        status: 'realizada',
        created_by: createdBy || null,
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database insertion error:', dbError)
      return NextResponse.json({ error: 'Erro ao salvar no banco de dados.', details: dbError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      transcription,
      summary: object.summary,
      action_items: object.action_items,
      activity: activityData,
    })

  } catch (error: any) {
    console.error('Error in /api/meetings/transcribe:', error)
    return NextResponse.json({ error: 'Erro interno no servidor.', details: error.message }, { status: 500 })
  }
}
