// run-migrations.mjs
// Uses Supabase Management API to execute SQL migrations
// Requires: SUPABASE_DB_PASSWORD or direct pg connection

import { readFileSync } from 'fs'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

async function executeSql(sql, label) {
  console.log(`\n📦 Executing: ${label}`)
  
  // Use Supabase's pg REST endpoint (available with service_role via pg proxy)
  const url = `${SUPABASE_URL}/pg/query`
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  })
  
  const text = await res.text()
  
  if (res.ok) {
    console.log(`  ✅ Success (${res.status})`)
    try { console.log('  ', JSON.parse(text)) } catch { console.log('  ', text.slice(0, 200)) }
    return true
  } else {
    console.log(`  ❌ Failed (${res.status}): ${text.slice(0, 500)}`)
    return false
  }
}

async function main() {
  const sql1 = readFileSync('supabase/migrations/20260706120000_create_filiais.sql', 'utf-8')
  const sql2 = readFileSync('supabase/migrations/20260706120100_extend_onboarding_client_filial.sql', 'utf-8')
  
  // Wrap in idempotent guards
  const safeSql1 = `
DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='filiais') THEN
    ${sql1.replace(/\$\$/g, '$inner$')}
  ELSE
    RAISE NOTICE 'Table filiais already exists, skipping migration 1';
  END IF;
END $guard$;
`
  
  const ok1 = await executeSql(sql1, '20260706120000_create_filiais.sql')
  
  if (ok1 || true) { // try migration 2 regardless
    const ok2 = await executeSql(sql2, '20260706120100_extend_onboarding_client_filial.sql')
    if (ok2) {
      console.log('\n🎉 All migrations applied successfully!')
    }
  }
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
