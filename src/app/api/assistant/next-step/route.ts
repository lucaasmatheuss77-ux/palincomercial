import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado.' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const clientName: string = typeof body?.clientName === 'string' ? body.clientName.trim() : 'Cliente'
    const objective: string = typeof body?.objective === 'string' ? body.objective.trim() : ''
    const notes: string = typeof body?.notes === 'string' ? body.notes.trim() : ''

    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      return NextResponse.json({ error: 'Configuracao de IA pendente.' }, { status: 500 })
    }
    const openai = createOpenAI({ apiKey: openaiKey })

    const prompt = `Cliente: ${clientName}
Pauta da reunião: ${objective || 'Não informada'}
O que foi falado / notas da reunião: ${notes || 'Não informado'}

Com base nisso, sugira em UMA frase objetiva qual deve ser o próximo passo comercial com este cliente. Seja direto e acionável, sem introdução, sem markdown, sem aspas. Máximo 200 caracteres.`

    const result = await generateText({
      model: openai('gpt-4o-mini'),
      system: 'Você é um assistente de gestão comercial de uma consultoria tributária. Sugira próximos passos curtos, objetivos e acionáveis em português do Brasil.',
      prompt,
    })

    return NextResponse.json({ next_step: result.text.trim() })
  } catch (error) {
    console.error('Erro na rota /api/assistant/next-step:', error)
    return NextResponse.json({ error: 'Erro interno ao gerar sugestão.' }, { status: 500 })
  }
}
