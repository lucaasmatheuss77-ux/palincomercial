import { createClient } from '@/lib/supabase/server'
import QualificadorClient from './qualificador-client'

export const dynamic = 'force-dynamic'

export default async function QualificadorPage() {
  const supabase = await createClient()
  const { data: products } = await supabase
    .from('products')
    .select('id, name, color')
    .order('name')

  return <QualificadorClient products={products ?? []} />
}
