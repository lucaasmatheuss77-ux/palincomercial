'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { updateLeadStage } from './pipeline'

export async function syncLeadToOnboarding(data: {
  leadId: string
  clientName: string
  contactInfo: string
  contractLink: string
}) {
  const supabase = await createClient()

  // Update lead stage to Fechado
  await updateLeadStage(data.leadId, 'Fechado')

  const { error } = await supabase.from('onboarding').insert({
    lead_id: data.leadId,
    client_name: data.clientName,
    contact_info: data.contactInfo,
    contract_link: data.contractLink,
    status: 'Pendente',
  })

  if (error) {
    console.error('Error syncing lead to onboarding:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/onboarding')
  revalidatePath('/dashboard/pipeline')
  return { success: true }
}
