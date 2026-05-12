
import { createClient } from './src/lib/supabase/server'

async function test() {
  const supabase = await createClient()
  const result = await supabase
      .from('leads')
      .select(`
        id, name, company, stage, estimated_value, created_at, notes,
        phone, whatsapp, email,
        client_id,
        product_id, consultant_id,
        product:products(id, name),
        consultant:profiles(id, full_name)
      `)
      .order('created_at', { ascending: false })
  
  console.log('Result:', JSON.stringify(result, null, 2))
}

test()
