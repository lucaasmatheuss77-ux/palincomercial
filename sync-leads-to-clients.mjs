import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function sync() {
  console.log('Fetching leads...')
  const { data: leads, error: leadsErr } = await supabase.from('leads').select('*')
  
  if (leadsErr) {
    console.error('Error fetching leads:', leadsErr)
    return
  }

  console.log(`Found ${leads.length} leads.`)
  
  const { data: clients, error: clientsErr } = await supabase.from('clientes').select('*')
  if (clientsErr) {
    console.error('Error fetching clients:', clientsErr)
    return
  }

  const existingClientLeads = new Set(clients.map(c => c.origin_lead_id).filter(Boolean))
  let inserted = 0

  for (const lead of leads) {
    // If the lead already has a client record by origin_lead_id or client_id, skip it
    if (existingClientLeads.has(lead.id)) {
      continue
    }

    console.log(`Creating client for orphaned lead: ${lead.name}`)
    
    const { data: newClient, error: insertErr } = await supabase.from('clientes').insert({
      origin_lead_id: lead.id,
      name: lead.name || 'Sem nome',
      company_name: lead.company_name || lead.company || null,
      email: lead.email || null,
      phone: lead.phone || null,
      whatsapp: lead.whatsapp || null,
      status_cliente: lead.stage === 'Fechado' ? 'ativo' : 'lead',
      consultant_id: lead.consultant_id || null,
      product_id: lead.product_id || null,
    }).select('id').single()

    if (insertErr) {
      console.error(`Error inserting client for lead ${lead.id}:`, insertErr.message)
    } else if (newClient) {
      // link back to lead
      await supabase.from('leads').update({ client_id: newClient.id }).eq('id', lead.id)
      inserted++
    }
  }

  console.log(`\nSync completed! Inserted ${inserted} new clients.`)
}

sync()
