import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function ProcessoPage() {
  const supabase = await createClient()

  const [
    { data: leadsData },
    { data: contractsData },
    { data: clientsData },
    { count: meetingsCount },
    { count: nextContactsCount },
    { count: followUpsOpen },
  ] = await Promise.all([
    supabase.from('leads').select('id, stage'),
    supabase.from('contracts').select('id, status'),
    supabase.from('clientes').select('id, status_cliente'),
    supabase.from('meetings').select('id', { count: 'exact', head: true }),
    supabase.from('meetings').select('id', { count: 'exact', head: true }).not('next_contact_at', 'is', null),
    supabase.from('meeting_tasks').select('id', { count: 'exact', head: true }).neq('status', 'concluida'),
  ])

  interface LeadData { id: string; stage: string }
  interface ContractData { id: string; status: string }
  interface ClientData { id: string; status_cliente: string }

  const leads = (leadsData as LeadData[]) || []
  const contracts = (contractsData as ContractData[]) || []
  const clients = (clientsData as ClientData[]) || []

  const processCards = [
    {
      step: '1. Entrada do lead',
      helper: 'Captação, cadastro inicial e primeira leitura do potencial.',
      value: leads.filter((lead) => lead.stage !== 'Fechado').length,
      color: '#38bdf8',
    },
    {
      step: '2. Reunioes e diagnostico',
      helper: 'Pauta, necessidades, o que foi falado e contexto da conta.',
      value: meetingsCount ?? 0,
      color: '#86efac',
    },
    {
      step: '3. Follow-up',
      helper: 'Proximo passo, proximo contato e tarefas abertas.',
      value: (nextContactsCount ?? 0) + (followUpsOpen ?? 0),
      color: 'var(--brand-primary)',
    },
    {
      step: '4. Negociacao no CRM',
      helper: 'Andamento comercial ate gerar deal e contrato pendente.',
      value: leads.filter((lead) => lead.stage === 'Fechado').length,
      color: '#f97316',
    },
    {
      step: '5. Fechamento e clientes',
      helper: 'Contrato, validade, PDF, renovacao e base ativa.',
      value: clients.filter((client) => client.status_cliente === 'ativo').length || contracts.filter((contract) => contract.status === 'ativo').length,
      color: '#3b82f6',
    },
  ]

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--brand-text)', letterSpacing: '-0.02em' }}>Processo Comercial</h1>
        <p style={{ color: 'var(--brand-muted)', fontSize: '0.84rem', marginTop: '4px' }}>Lead ao fechamento · {processCards.reduce((s, c) => s + c.value, 0)} itens em acompanhamento</p>
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '12px' }}>
        {processCards.map((card) => (
          <div key={card.step} className="glass-card" style={{ padding: '18px', display: 'grid', gap: '10px' }}>
            <div style={{ color: card.color, fontSize: '0.76rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {card.step}
            </div>
            <div style={{ color: '#f8fafc', fontSize: '1.8rem', fontWeight: 900 }}>{card.value}</div>
            <div style={{ color: '#94a3b8', fontSize: '0.84rem', lineHeight: 1.5 }}>{card.helper}</div>
          </div>
        ))}
      </section>

      <section className="glass-card" style={{ padding: '24px', display: 'grid', gap: '14px' }}>
        <div style={{ color: '#f8fafc', fontWeight: 850, fontSize: '1rem' }}>Como navegar no processo</div>
        <div style={{ display: 'grid', gap: '10px' }}>
          {[
            'Use Processo Comercial para leitura da sequencia e gargalos.',
            'Use Reunioes para registrar pauta, o que foi falado e proximo contato.',
            'Use Follow-ups para executar a continuidade comercial do que saiu das reunioes.',
            'Use CRM para negociar e fechar a oportunidade.',
            'Use Clientes para contrato, PDF, validade, renovacao e pos-fechamento.',
          ].map((item) => (
            <div key={item} style={{ padding: '14px 16px', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#cbd5e1', lineHeight: 1.5 }}>
              {item}
            </div>
          ))}
        </div>
      </section>

      <style>{`
        @media (max-width: 1200px) {
          section[style*='repeat(5'] {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 720px) {
          section[style*='repeat(5'] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
