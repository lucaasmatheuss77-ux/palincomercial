'use server'

import { createClient } from '@/lib/supabase/server'

export async function registrarInscricao(eventId: string, data: {
  name: string
  email: string
  phone: string
  company: string
}) {
  try {
    const supabase = await createClient()

    // 1. Get Event Details to know Product ID and assigned owner (created_by)
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single()

    if (eventError || !event) {
      return { success: false, error: 'Evento nao encontrado.' }
    }

    // 2. Check if Lead already exists by email or phone
    let leadId = null
    let isNewLead = false

    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .or(`email.eq."${data.email}",phone.eq."${data.phone}"`)
      .limit(1)
      .single()

    if (existingLead) {
      leadId = existingLead.id
    } else {
      // Create new Lead
      isNewLead = true
      
      // Determine the owner (Pessoa responsável para eventos)
      // Usually, we can use the event's created_by. 
      // Just to be safe, if we have a default system property, we could use it, but `event.created_by` is reliable.
      const ownerId = event.created_by
      
      const { data: newLead, error: insertLeadError } = await supabase
        .from('leads')
        .insert({
          name: data.name,
          email: data.email,
          phone: data.phone,
          company: data.company,
          stage: 'Contato Inicial',
          product_id: event.product_id,
          consultant_id: ownerId, // Assign to the Event Owner
          notes: `Inscrito pelo evento: ${event.name}`
        })
        .select('id')
        .single()

      if (insertLeadError) throw insertLeadError
      leadId = newLead.id
    }

    // 3. Register as Participant
    // Check if not already participating
    const { data: existingParticipant } = await supabase
      .from('event_participants')
      .select('id')
      .eq('event_id', event.id)
      .eq('email', data.email)
      .single()

    if (!existingParticipant) {
      const { error: partError } = await supabase
        .from('event_participants')
        .insert({
          event_id: event.id,
          name: data.name,
          email: data.email,
          phone: data.phone,
          company: data.company,
          converted_to_lead: true,
          lead_id: leadId,
        })
      
      if (partError) throw partError
    }

    // 4. Create an Interaction (Alert System for CRM)
    // Se o lead já existia, criamos um log reforçando que ele voltou a se engajar.
    const interactionMsg = isNewLead 
      ? `Lead gerado automaticamente pela inscricao no evento: ${event.name}`
      : `ALERTA: Lead antigo se inscreveu no evento: ${event.name}. Excelente oportunidade de contato!`

    await supabase.from('interactions').insert({
      lead_id: leadId,
      profile_id: event.created_by, // Send to the event owner
      type: 'nota',
      description: interactionMsg
    })

    return { success: true }

  } catch (error) {
    console.error('Erro na inscricao:', error)
    return { success: false, error: 'Ocorreu um erro interno ao processar a inscricao.' }
  }
}
