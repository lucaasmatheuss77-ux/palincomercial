import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const vars = {}
env.split('\n').forEach(line => {
  const [k, ...v] = line.split('=')
  if (k) vars[k.trim()] = v.join('=').trim()
})

const supabase = createClient(vars['NEXT_PUBLIC_SUPABASE_URL'], vars['SUPABASE_SERVICE_ROLE_KEY'])

// Add onboarding_data column to club_members
console.log('=== Adding onboarding_data column to club_members ===')

// Try via RPC/SQL - some Supabase setups allow this
const { error: alterErr } = await supabase.rpc('exec_sql', {
  sql: 'ALTER TABLE club_members ADD COLUMN IF NOT EXISTS onboarding_data jsonb DEFAULT NULL;'
})

if (alterErr) {
  console.log('RPC not available:', alterErr.message)
  console.log('\n=== MANUAL ACTION REQUIRED ===')
  console.log('Run this SQL in the Supabase SQL Editor:')
  console.log('ALTER TABLE club_members ADD COLUMN IF NOT EXISTS onboarding_data jsonb DEFAULT NULL;')
  console.log('')
  console.log('URL: https://supabase.com/dashboard → SQL Editor')
} else {
  console.log('✅ Column added successfully!')
  
  // Verify
  const { data: test } = await supabase.from('club_members').select('onboarding_data').limit(1)
  console.log('Verified:', test !== null ? '✅' : '❌')
}
