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
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function deleteConsultants() {
  console.log('Fetching all profiles...');
  const { data: profiles, error } = await supabaseAdmin.from('profiles').select('id, email, full_name');
  
  if (error) {
    console.error('Error fetching profiles:', error);
    return;
  }
  
  if (!profiles || profiles.length === 0) {
    console.log('No consultants found to delete.');
    return;
  }
  
  console.log(`Found ${profiles.length} consultants. Deleting...`);
  
  for (const p of profiles) {
    console.log(`Deleting user: ${p.full_name} (${p.email})`);
    
    // Delete from public.profiles
    const { error: profileError } = await supabaseAdmin.from('profiles').delete().eq('id', p.id);
    if (profileError) {
      console.error(`Failed to delete profile for ${p.email}:`, profileError);
    }
    
    // Delete from auth.users
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(p.id);
    if (authError) {
      console.error(`Failed to delete auth user for ${p.email}:`, authError);
    }
  }
  
  console.log('All consultants deleted successfully.');
}

deleteConsultants();
