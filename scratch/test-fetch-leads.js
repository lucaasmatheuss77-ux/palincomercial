const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envData = fs.readFileSync(envPath, 'utf8');
  envData.split('\n').forEach(line => {
    const [key, ...values] = line.split('=');
    if (key && values.length > 0) {
      process.env[key.trim()] = values.join('=').trim();
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: leadsData, error } = await supabase
      .from('leads')
      .select(`
        id, name, company, stage, estimated_value, created_at, notes,
        phone, whatsapp, email,
        client_id,
        product_id, consultant_id,
        product:products(id, name),
        consultant:profiles!consultant_id(id, full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(5);
  
  if (error) {
    console.error('Error fetching leads:', error);
  } else {
    console.log('Successfully fetched', leadsData?.length, 'leads');
  }
}
run();
