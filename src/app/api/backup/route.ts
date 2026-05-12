import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Tabelas a exportar no backup
const BACKUP_TABLES = [
  'meetings',
  'meeting_tasks',
  'meeting_logistics',
  'events',
  'app_users',
  'user_permissions',
  'lead_contacts',
  'settings',
  'leads',
  'clientes',
  'contracts',
  'commissions',
  'deals',
  'products',
  'profiles',
  'commercial_activities',
] as const

type BackupTableName = typeof BACKUP_TABLES[number]

export async function GET() {
  const supabase = await createClient()

  // Verificar autenticação
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nao autorizado.' }, { status: 401 })
  }

  // Verificar se é admin (apenas admin pode baixar backup completo)
  const { data: appUser } = await supabase
    .from('app_users')
    .select('role')
    .eq('email', user.email!.toLowerCase())
    .eq('is_active', true)
    .maybeSingle()

  if (!appUser || !['Administrador', 'Gestor'].includes(appUser.role)) {
    return NextResponse.json({ error: 'Apenas Administradores e Gestores podem exportar o backup.' }, { status: 403 })
  }

  const timestamp = new Date().toISOString()
  const backup: Record<string, unknown[]> = {
    _meta: [{
      exported_at: timestamp,
      exported_by: user.email,
      version: '1.0',
      tables: BACKUP_TABLES,
    }] as unknown[],
  }

  const rowCounts: Record<string, number> = {}

  // Exportar cada tabela
  for (const table of BACKUP_TABLES) {
    try {
      const { data, error } = await supabase.from(table as BackupTableName).select('*')
      if (error) {
        backup[table] = []
        rowCounts[table] = 0
      } else {
        backup[table] = data || []
        rowCounts[table] = (data || []).length
      }
    } catch {
      backup[table] = []
      rowCounts[table] = 0
    }
  }

  // Registrar log de backup
  try {
    await supabase.from('backup_logs').insert({
      tables: BACKUP_TABLES,
      row_counts: rowCounts,
      status: 'ok',
      triggered_by: user.email,
    })
  } catch {
    // log falhou mas backup segue
  }

  const json = JSON.stringify(backup, null, 2)
  const fileName = `palin-backup-${timestamp.slice(0, 10)}.json`

  return new NextResponse(json, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}
