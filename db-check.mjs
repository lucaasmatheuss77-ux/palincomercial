import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(process.cwd(), '.env.local');
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
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log('--- Checking Profiles (Consultants) ---');
  const { data: profiles, error: err3 } = await supabaseAdmin.from('profiles').select('*');
  console.log('Profiles:', profiles, err3);

  console.log('--- Checking Leads with Admin ---');
  const { count: countAdmin } = await supabaseAdmin.from('leads').select('*', { count: 'exact', head: true });
  console.log('Admin leads count:', countAdmin);

  console.log('--- Checking Leads with Anon ---');
  const { count: countAnon, error: errAnon } = await supabaseAnon.from('leads').select('*', { count: 'exact', head: true });
  console.log('Anon leads count:', countAnon, errAnon);
}

check();
