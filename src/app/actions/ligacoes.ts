'use server'

import { revalidatePath } from 'next/cache'
import { recordCommercialActivity } from './commercial-activities'

export type CallOutcome = 'atendeu' | 'nao_atendeu' | 'recado' | 'reagendado'

export type CallLogInput = {
  leadId?: string | null
  clientId?: string | null
  dealId?: string | null
  phone?: string | null
  callType: 'goto_connect' | 'ligacao' | 'manual'
  outcome: CallOutcome
  durationMin?: number | null
  notes?: string | null
  recordingUrl?: string | null
}

export async function createCallLog(data: CallLogInput) {
  const summary = [
    data.durationMin ? `Duração: ${data.durationMin} min` : null,
    data.outcome ? `Resultado: ${data.outcome}` : null,
    data.notes ? `Notas: ${data.notes}` : null,
    data.recordingUrl ? `Gravação: ${data.recordingUrl}` : null,
    data.phone ? `Telefone: ${data.phone}` : null
  ].filter(Boolean).join(' | ')

  const activityType = data.callType === 'goto_connect' ? 'ligacao_goto' as const : 'ligacao' as const

  const response = await recordCommercialActivity({
    leadId: data.leadId ?? undefined,
    clientId: data.clientId ?? undefined,
    dealId: data.dealId ?? undefined,
    activityType: activityType,
    subject: `Chamada ${data.callType === 'goto_connect' ? 'GoTo' : 'Manual'}: ${data.outcome}`,
    summary: summary || 'Ligação registrada',
    outcome: data.outcome,
    status: 'registrada'
  })

  revalidatePath('/dashboard/pipeline')
  revalidatePath('/dashboard/clientes')
  
  return response
}

// Alias para compatibilidade ou novos usos
export async function recordCallLog(data: CallLogInput) {
  return createCallLog(data)
}
