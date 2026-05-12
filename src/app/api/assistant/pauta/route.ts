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
    const recordingLink: string = typeof body?.recordingLink === 'string' ? body.recordingLink.trim() : ''
    const additionalContext: string = typeof body?.additionalContext === 'string' ? body.additionalContext.trim() : ''

    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      return NextResponse.json({ error: 'Configuracao de IA pendente.' }, { status: 500 })
    }
    const openai = createOpenAI({ apiKey: openaiKey })

    const linkInfo = recordingLink
      ? `Link da gravação: ${recordingLink}`
      : 'Nenhum link de gravação fornecido.'

    const contextInfo = additionalContext
      ? `\nContexto adicional informado pelo usuário: ${additionalContext}`
      : ''

    const prompt = `Com base nas informações abaixo, gere uma pauta estruturada da reunião.

Cliente: ${clientName}
${linkInfo}${contextInfo}

IMPORTANTE: Como você não tem acesso direto ao conteúdo do vídeo, crie uma pauta profissional com base no contexto disponível. O usuário irá revisar e complementar com os pontos reais discutidos.

Estruture a pauta EXATAMENTE neste formato markdown:

## Pauta da Reunião — ${clientName}

### Tópicos Discutidos
- [Tópico 1 — a preencher]
- [Tópico 2 — a preencher]
- [Tópico 3 — a preencher]

### Decisões Tomadas
- [Decisão 1 — a preencher]

### Próximos Passos
| Ação | Responsável | Prazo |
|------|-------------|-------|
| [Ação 1] | [Nome] | [Data] |

### Observações
[Campo livre para notas adicionais]

Seja objetivo. Máximo 400 palavras.`

    const result = await generateText({
      model: openai('gpt-4o-mini'),
      system: 'Você é um assistente de gestão comercial. Gere pautas de reunião claras, objetivas e profissionais em português do Brasil.',
      prompt,
      maxOutputTokens: 800,
    })

    return NextResponse.json({ pauta: result.text })
  } catch (error) {
    console.error('Erro na rota /api/assistant/pauta:', error)
    return NextResponse.json({ error: 'Erro interno ao gerar pauta.' }, { status: 500 })
  }
}
