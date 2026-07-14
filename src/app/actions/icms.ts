'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function closeIcmsMonthAndSendEmail(data: {
  monthYear: string
  emailTo: string
  pdfBase64?: string
}) {
  const supabase = await createClient()

  // 1. Compile the month's data
  const { data: operations, error: fetchError } = await supabase
    .from('icms_operations')
    .select('*')
    .eq('month_year', data.monthYear)

  if (fetchError) {
    return { success: false, error: fetchError.message }
  }

  // 2. Mark operations as Closed
  const { error: updateError } = await supabase
    .from('icms_operations')
    .update({ status_fechamento: 'Closed', updated_at: new Date().toISOString() })
    .eq('month_year', data.monthYear)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // 3. Dispatch Email (Simulated or via Resend if configured)
  console.log(`[SIMULATED EMAIL] Sending ICMS Report for ${data.monthYear} to ${data.emailTo}`)
  console.log(`[SIMULATED EMAIL] Operations count: ${operations?.length || 0}`)
  if (data.pdfBase64) {
    console.log(`[SIMULATED EMAIL] PDF attachment included.`)
  }

  revalidatePath('/dashboard/analise-credito')
  
  return { success: true, count: operations?.length || 0 }
}

export async function getIcmsOperations(monthYear?: string) {
  const supabase = await createClient()
  let query = supabase.from('icms_operations').select('*').order('created_at', { ascending: false })
  
  if (monthYear) {
    query = query.eq('month_year', monthYear)
  }
  
  const { data, error } = await query
  if (error) {
    console.error('Error fetching ICMS ops:', error)
    return []
  }
  
  return data
}

export type CreateIcmsOperationInput = {
  data_venda: string
  empresa: string
  propriedade: string
  cliente: string
  client_id?: string | null
  filial_id?: string | null
  nota_fiscal: string
  valor_venda: number
  valor_icms: number
  porcentagem_honorarios: number
  valor_honorarios: number
  deferimento: string
  month_year: string
  status_fechamento?: string
}

export async function createIcmsOperation(data: CreateIcmsOperationInput) {
  const supabase = await createClient()
  
  const { data: newOp, error } = await supabase
    .from('icms_operations')
    .insert([{
      ...data,
      status_fechamento: data.status_fechamento || 'Open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }])
    .select()
    .single()
    
  if (error) {
    console.error('Error creating ICMS operation:', error)
    return { success: false, error: error.message }
  }
  
  revalidatePath('/dashboard/analise-credito')
  return { success: true, data: newOp }
}

export async function updateIcmsOperation(id: string, data: CreateIcmsOperationInput) {
  const supabase = await createClient()

  const { data: updatedOp, error } = await supabase
    .from('icms_operations')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating ICMS operation:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/analise-credito')
  return { success: true, data: updatedOp }
}

export async function deleteIcmsOperation(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('icms_operations').delete().eq('id', id)

  if (error) {
    console.error('Error deleting ICMS operation:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/analise-credito')
  return { success: true }
}

export async function closeIcmsMonthForClient(data: { monthYear: string; cliente?: string; empresa?: string }) {
  const supabase = await createClient()

  let query = supabase
    .from('icms_operations')
    .update({ status_fechamento: 'Closed', updated_at: new Date().toISOString() })
    .eq('month_year', data.monthYear)

  if (data.empresa) {
    query = query.eq('empresa', data.empresa)
  } else if (data.cliente) {
    query = query.eq('cliente', data.cliente)
  }

  const { data: updatedOps, error } = await query.select('id')

  if (error) {
    console.error('Error closing ICMS month:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/analise-credito')
  return { success: true, count: updatedOps?.length || 0 }
}
