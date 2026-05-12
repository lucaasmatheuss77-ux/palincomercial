import { createClient } from '@/lib/supabase/server'
import DownloadActionButton from '@/components/download-action-button'
import CommissionPayButton from './commission-pay-button'
import CommissionRulesManager, { RuleType } from './commission-rules-manager'

export const dynamic = 'force-dynamic'

type DbRule = {
  id: string
  base_rate: number
  base_fixed: number
  recurrent_rate: number
  sdr_rate: number
  notes: string | null
  product_id: string | null
  product: { name: string } | null
}

type DbCommission = {
  id: string
  amount: number
  status: string
  created_at: string
  profile: { full_name: string | null } | null
  deal: { value: number | null; product: { name: string } | null } | null
}

type DbProduct = {
  id: string
  name: string
}

export default async function ComissoesPage() {
  const supabase = await createClient()

  const [{ data: dbRules }, { data: dbCommissions }, { data: productsData }] = await Promise.all([
    supabase
      .from('commission_rules')
      .select('id, base_rate, base_fixed, recurrent_rate, sdr_rate, notes, product_id, product:products(name)')
      .order('created_at', { ascending: true }),
    supabase
      .from('commissions')
      .select(`
        id, amount, status, created_at,
        profile:profiles(full_name),
        deal:deals(value, product:products(name))
      `)
      .order('created_at', { ascending: false }),
    supabase.from('products').select('id, name').order('name'),
  ])

  const rules: RuleType[] = (dbRules as unknown as DbRule[] || []).map((rule) => ({
    id: rule.id,
    produto: rule.product?.name || 'Desconhecido',
    product_id: rule.product_id || '',
    base: Number(rule.base_fixed) > 0 ? `R$ ${Number(rule.base_fixed).toFixed(2)}` : `${(Number(rule.base_rate) * 100).toFixed(1)}%`,
    base_rate: Number(rule.base_rate) || 0,
    base_fixed: Number(rule.base_fixed) || 0,
    recurrent_rate: Number(rule.recurrent_rate) || 0,
    sdr_rate: Number(rule.sdr_rate) || 0,
    notes: rule.notes || '',
  }))

  const commissions = (dbCommissions as unknown as DbCommission[] || []).map((commission) => ({
    id: commission.id,
    name: commission.profile?.full_name?.split(' ')[0] || 'Desconhecido',
    produto: commission.deal?.product?.name || 'Venda',
    valor: Number(commission.deal?.value || 0),
    comissao: Number(commission.amount || 0),
    status: commission.status,
    mes: new Date(commission.created_at).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
  }))

  const products = (productsData as DbProduct[] || []).map((p) => ({ id: p.id, name: p.name }))

  const total = commissions.reduce((sum, c) => sum + c.comissao, 0)
  const totalPago = commissions.filter((c) => c.status === 'pago').reduce((sum, c) => sum + c.comissao, 0)
  const totalPendente = commissions.filter((c) => c.status === 'pendente').reduce((sum, c) => sum + c.comissao, 0)

  const exportContent = [
    'Consultor;Produto;Receita Gerada;Comissao;Status;Mes',
    ...commissions.map((c) => `${c.name};${c.produto};${c.valor};${c.comissao};${c.status};${c.mes}`),
  ].join('\n')

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--brand-text)', letterSpacing: '-0.02em' }}>Comissoes</h1>
          <p style={{ color: 'var(--brand-muted)', fontSize: '0.84rem', marginTop: '4px' }}>{commissions.length} {commissions.length === 1 ? 'registro' : 'registros'}</p>
        </div>
        <DownloadActionButton className="btn-primary" fileName="comissoes.csv" content={exportContent} successMessage="Extrato exportado.">
          Exportar CSV
        </DownloadActionButton>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        <div className="kpi-card">
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '6px' }}>Total a pagar</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b' }}>R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="kpi-card">
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '6px' }}>Ja pago</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981' }}>R$ {totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="kpi-card">
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '6px' }}>Pendente</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ef4444' }}>R$ {totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      <CommissionRulesManager initialRules={rules} products={products} />

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: '#e2e8f0' }}>Contas a pagar / extrato</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(30,58,95,0.5)' }}>
                {['Consultor', 'Produto', 'Receita Gerada', 'Comissao', 'Status', 'Mes', ''].map((header) => (
                  <th key={header} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {commissions.map((commission, index) => (
                <tr key={`${commission.id}-${index}`} style={{ borderBottom: '1px solid rgba(30,58,95,0.2)' }}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="avatar" style={{ width: '30px', height: '30px', fontSize: '0.72rem' }}>{commission.name ? commission.name[0] : '?'}</div>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#e2e8f0' }}>{commission.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '0.8rem', color: '#94a3b8' }}>{commission.produto}</td>
                  <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: '#e2e8f0' }}>R$ {commission.valor.toLocaleString('pt-BR')}</td>
                  <td style={{ padding: '14px 16px', fontSize: '0.9rem', fontWeight: 800, color: '#f59e0b' }}>R$ {commission.comissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span className={`badge ${commission.status === 'pago' ? 'badge-green' : 'badge-gold'}`}>{commission.status}</span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '0.8rem', color: '#64748b' }}>{commission.mes}</td>
                  <td style={{ padding: '14px 16px' }}>
                    {commission.status === 'pendente' ? <CommissionPayButton commissionId={commission.id} /> : null}
                  </td>
                </tr>
              ))}
              {commissions.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>Nenhum contrato fechado ainda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
