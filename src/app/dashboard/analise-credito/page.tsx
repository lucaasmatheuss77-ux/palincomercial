import { Landmark } from 'lucide-react'
import { listClienteOptions } from '@/app/actions/clientes'
import { createClient } from '@/lib/supabase/server'
import AnaliseCreditoTable from './analise-credito-table'

export const dynamic = 'force-dynamic'

export default async function AnaliseCreditoPage() {
  const supabase = await createClient()
  const clientes = await listClienteOptions()

  const { data: operations, error: operationsError } = await supabase
    .from('icms_operations')
    .select('*')
    .order('data_venda', { ascending: false })
    .limit(500)
  if (operationsError) {
    console.error('Erro ao carregar operacoes ICMS:', operationsError.message)
  }

  return (
    <div className="flex w-full max-w-[1600px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-start gap-3">
        <span className="mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-yellow-500/25 bg-yellow-500/10 text-yellow-400">
          <Landmark size={20} aria-hidden="true" />
        </span>
        <div>
          <h1 className="mb-1 text-2xl font-bold text-white">Analise de Credito de ICMS</h1>
          <p className="text-slate-400">Controle por cliente, filial, nota fiscal, valores, honorarios e fechamento mensal.</p>
        </div>
      </div>

      <AnaliseCreditoTable initialOperations={operations || []} clientes={clientes} />
    </div>
  )
}
