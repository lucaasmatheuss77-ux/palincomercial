import { createClient } from '@/lib/supabase/server'
import OnboardingTable from './onboarding-table'
import { listFiliaisByClients, getOnboardingFiliais } from '@/app/actions/filiais'

export const dynamic = 'force-dynamic'

type ClienteRow = {
  id: string
  name: string
  company_name: string | null
  documento: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  status_cliente: string | null
  product_id: string | null
  created_at: string | null
}

type ContractRow = {
  client_id: string | null
  start_date: string | null
  created_at: string | null
}

type ProductRow = {
  id: string
  name: string | null
}

function isClubOrEducationalProduct(productName: string) {
  const normalized = productName.toLowerCase()
  return ['educ', 'curso', 'trein', 'mentoria', 'palestra', 'clube', 'club', 'insider'].some((term) =>
    normalized.includes(term)
  )
}

export default async function OnboardingPage() {
  const supabase = await createClient()

  const { data: clientesData, error: clientesError } = await supabase
    .from('clientes')
    .select('id, name, company_name, documento, email, phone, whatsapp, status_cliente, product_id, created_at')
    .in('status_cliente', ['aguardando_contrato', 'ativo'])
    .order('created_at', { ascending: false })

  if (clientesError) {
    console.error('Error loading clientes for onboarding:', clientesError)
  }

  const clientes = (clientesData || []) as ClienteRow[]
  const clientIds = clientes.map((cliente) => cliente.id)

  const [contractsResult, productsResult, filiaisList, onboardingFiliais] = await Promise.all([
    clientIds.length
      ? supabase.from('contracts').select('client_id, start_date, created_at').in('client_id', clientIds)
      : Promise.resolve({ data: [] as ContractRow[] }),
    supabase.from('products').select('id, name'),
    listFiliaisByClients(clientIds),
    getOnboardingFiliais(clientIds),
  ])

  const contractsByClient = new Map<string, ContractRow>()
  for (const contract of (contractsResult.data || []) as ContractRow[]) {
    if (!contract.client_id) continue
    const contractDate = contract.start_date || contract.created_at || ''
    const current = contractsByClient.get(contract.client_id)
    const currentDate = current ? current.start_date || current.created_at || '' : ''
    if (!current || contractDate > currentDate) contractsByClient.set(contract.client_id, contract)
  }

  const productsById = new Map(
    ((productsResult.data || []) as ProductRow[]).map((product) => [product.id, product.name || 'Geral'])
  )

  const filiaisByClient = new Map<string, { id: string; nome: string }[]>()
  for (const filial of filiaisList) {
    const list = filiaisByClient.get(filial.client_id) || []
    list.push({ id: filial.id, nome: filial.nome })
    filiaisByClient.set(filial.client_id, list)
  }

  const clients = clientes
    .map((cliente) => {
      const contract = contractsByClient.get(cliente.id)
      const product = (cliente.product_id && productsById.get(cliente.product_id)) || 'Geral'
      return {
        id: cliente.id,
        name: cliente.name,
        company_name: cliente.company_name,
        documento: cliente.documento,
        email: cliente.email,
        phone: cliente.phone,
        whatsapp: cliente.whatsapp,
        product,
        contract_date: contract?.start_date || contract?.created_at || cliente.created_at || '',
        filiais: filiaisByClient.get(cliente.id) || [],
        selected_filial_id: onboardingFiliais[cliente.id] || null,
      }
    })
    .filter((client) => !isClubOrEducationalProduct(client.product))

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1500px] mx-auto p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-black text-white mb-1 tracking-tight">Onboarding Operacional</h1>
        <p className="text-slate-400 text-sm">
          Clientes entram aqui a partir do cadastro em{' '}
          <span className="text-sky-400 font-semibold">Clientes</span>, já com filial vinculada. Produtos
          educacionais ficam no menu <span className="text-sky-400 font-semibold">Clube</span>.
        </p>
      </div>

      <OnboardingTable clients={clients} />
    </div>
  )
}
