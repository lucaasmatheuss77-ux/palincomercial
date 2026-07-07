const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
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
  console.log('Testing lead count with service role...');
  const { count: totalCount, error: countError } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true });
  
  if (countError) console.error('Count error:', countError);
  console.log('Total leads in DB (service role):', totalCount);

  console.log('Fetching policies for leads table...');
  const { data, error } = await supabase.rpc('get_policies_for_table', { table_name: 'leads' });
  if (error) {
    console.log('Could not use RPC, querying pg_policies...');
    const res = await supabase.from('pg_policies').select('*').eq('tablename', 'leads');
    console.log(res.data);
  } else {
    console.log(data);
  }
}
run();
