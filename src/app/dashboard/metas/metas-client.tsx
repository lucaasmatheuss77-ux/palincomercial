'use client'

import { useState } from 'react'
import { Edit3, Target, Plus, Trash2, Trophy, TrendingUp, Users } from 'lucide-react'
import { toast } from 'sonner'
import ActionDialog from '@/components/action-dialog'

type ProductStat = {
  id: string
  name: string
  emoji: string | null
  color: string | null
  totalLeads: number
  closed: number
  open: number
  subs: { id: string; name: string }[]
}

type MemberRow = {
  id: string
  name: string
  role: string
  contracts: number
  open: number
  byProduct: { productId: string; productName: string; emoji: string | null; closed: number; open: number }[]
}

type SalesGoal = {
  id: string
  period: string
  product_id: string | null
  consultant_id: string | null
  goal_contracts: number
  notes: string
  products?: { name: string; emoji: string; color: string } | null
  profiles?: { full_name: string } | null
}

type Props = {
  totalContracts: number
  totalOpen: number
  byProduct: ProductStat[]
  memberRows: MemberRow[]
  products: { id: string; name: string; emoji: string | null }[]
  consultants: { id: string; name: string }[]
  goals: SalesGoal[]
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function currentPeriod() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatPeriod(period: string) {
  const [year, month] = period.split('-')
  return `${MONTHS[parseInt(month, 10) - 1]} ${year}`
}

export default function MetasClient({
  totalContracts,
  totalOpen,
  byProduct,
  memberRows,
  products,
  consultants,
  goals: initialGoals,
}: Props) {
  const [showNewGoal, setShowNewGoal] = useState(false)
  const [goals, setGoals] = useState<SalesGoal[]>(initialGoals)
  const [saving, setSaving] = useState(false)
  const [editingGoal, setEditingGoal] = useState<SalesGoal | null>(null)
  const [draft, setDraft] = useState({
    period: currentPeriod(),
    product_id: '',
    consultant_id: '',
    goal_contracts: '',
    notes: '',
  })

  async function handleCreateGoal() {
    if (!draft.period || !draft.goal_contracts) {
      toast.error('Informe o período e a meta de contratos.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period: draft.period,
          product_id: draft.product_id || null,
          consultant_id: draft.consultant_id || null,
          goal_contracts: Number(draft.goal_contracts),
          notes: draft.notes,
        }),
      })

      if (res.ok) {
        const newGoal = await res.json()
        const product = products.find((p) => p.id === draft.product_id)
        const consultant = consultants.find((c) => c.id === draft.consultant_id)
        setGoals((prev) => [
          {
            ...newGoal,
            products: product ? { name: product.name, emoji: product.emoji || '📦', color: '#58a6ff' } : null,
            profiles: consultant ? { full_name: consultant.name } : null,
          },
          ...prev,
        ])
        toast.success('Meta criada com sucesso!')
        setDraft({ period: currentPeriod(), product_id: '', consultant_id: '', goal_contracts: '', notes: '' })
        setShowNewGoal(false)
      } else {
        toast.error('Erro ao criar meta.')
      }
    } finally {
      setSaving(false)
    }
  }

  function closeGoalDialog() {
    setShowNewGoal(false)
    setEditingGoal(null)
    setDraft({ period: currentPeriod(), product_id: '', consultant_id: '', goal_contracts: '', notes: '' })
  }

  function openEditGoal(goal: SalesGoal) {
    setEditingGoal(goal)
    setDraft({
      period: goal.period,
      product_id: goal.product_id || '',
      consultant_id: goal.consultant_id || '',
      goal_contracts: String(goal.goal_contracts || ''),
      notes: goal.notes || '',
    })
    setShowNewGoal(true)
  }

  async function handleSaveGoal() {
    if (!editingGoal) {
      await handleCreateGoal()
      return
    }

    if (!draft.period || !draft.goal_contracts) {
      toast.error('Informe o periodo e a meta de contratos.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/goals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingGoal.id,
          period: draft.period,
          product_id: draft.product_id || null,
          consultant_id: draft.consultant_id || null,
          goal_contracts: Number(draft.goal_contracts),
          notes: draft.notes,
        }),
      })

      if (!res.ok) {
        toast.error('Erro ao atualizar meta.')
        return
      }

      const updated = await res.json()
      setGoals((prev) => prev.map((goal) => goal.id === editingGoal.id ? updated : goal))
      toast.success('Meta atualizada.')
      closeGoalDialog()
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteGoal(goal: SalesGoal) {
    if (!window.confirm(`Excluir a meta de ${formatPeriod(goal.period)}?`)) return

    const res = await fetch(`/api/goals?id=${goal.id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Erro ao excluir meta.')
      return
    }

    setGoals((prev) => prev.filter((item) => item.id !== goal.id))
    toast.success('Meta excluida.')
  }

  // Calculate progress for goals
  const goalsWithProgress = goals.map((goal) => {
    let realized = 0

    if (goal.product_id && goal.consultant_id) {
      realized = memberRows
        .find((m) => m.id === goal.consultant_id)
        ?.byProduct.find((bp) => bp.productId === goal.product_id)?.closed ?? 0
    } else if (goal.product_id) {
      realized = byProduct.find((p) => p.id === goal.product_id)?.closed ?? 0
    } else if (goal.consultant_id) {
      realized = memberRows.find((m) => m.id === goal.consultant_id)?.contracts ?? 0
    } else {
      realized = totalContracts
    }

    const percent = goal.goal_contracts > 0 ? Math.round((realized / goal.goal_contracts) * 100) : 0
    return { ...goal, realized, percent }
  })

  const goalsByPeriod = goalsWithProgress.reduce<Record<string, typeof goalsWithProgress>>((acc, goal) => {
    acc[goal.period] ||= []
    acc[goal.period].push(goal)
    return acc
  }, {})
  const orderedGoalPeriods = Object.keys(goalsByPeriod).sort((a, b) => b.localeCompare(a))

  // ── Dados estáticos do plano bimestral Mai-Jun 2026 ──────────────────────────
  const METAS_DEPT = [
    { id: 1, titulo: 'Novos Contratos', diaria: '1/consultor', semanal: 5, mensal: 20, bimestral: 40, detalhe: '10 PJ + 10 Rural/mês', cor: '#22c55e', realizado: totalContracts },
    { id: 2, titulo: 'Renovações', diaria: '—', semanal: 4, mensal: 15, bimestral: 30, detalhe: 'Giovana + Juliana | Base: 0 em Jan-Abr', cor: '#f59e0b', realizado: 0 },
    { id: 3, titulo: 'Cross-sells', diaria: '—', semanal: 5, mensal: 20, bimestral: 40, detalhe: 'Produto diferente do atual, registrado no CRM', cor: '#38bdf8', realizado: 0 },
    { id: 4, titulo: 'Comercialização Créditos ICMS', diaria: '—', semanal: 30000, mensal: 120000, bimestral: 240000, detalhe: 'Ingrid + Eddi | Base: R$87k/mês (mar)', cor: '#10b981', realizado: 87488, isCurrency: true },
    { id: 5, titulo: 'Atividade Comercial (contatos)', diaria: '5/consultor', semanal: 125, mensal: 500, bimestral: 1000, detalhe: '5 consultores × 25 contatos/semana | CRM até 18h', cor: '#f97316', realizado: 0 },
    { id: 6, titulo: 'Qualificação de Leads Rural', diaria: '—', semanal: 2, mensal: 8, bimestral: 16, detalhe: 'Conversão histórica: 29,4% → contrato', cor: '#84cc16', realizado: 0 },
  ]

  const CONSULTORES = [
    { nome: 'Bertoni', tipo: 'Rural', contratos: 5, crossSell: 2, crossDetalhe: 'DCA para produtores com CNPJ', contatos: 25, extra: '2 leads PJ/mês → Carina/Fernanda' },
    { nome: 'Ana Julia', tipo: 'Rural', contratos: 5, crossSell: 2, crossDetalhe: 'Reforma Tributária + e-CredPDD', contatos: 25, extra: '10 produtores c/ CNPJ associado/mês' },
    { nome: 'Carina', tipo: 'PJ', contratos: 4, crossSell: 2, crossDetalhe: 'Lei 224/2025 + INSS Horas Extras', contatos: 25, extra: '1 diagnóstico DCA/semana mínimo' },
    { nome: 'Fernanda', tipo: 'PJ', contratos: 3, crossSell: 2, crossDetalhe: 'Subvenção + Exclusão ICMS', contatos: 25, extra: '10 leads ativos em andamento' },
    { nome: 'Juliana', tipo: 'PJ + Renovações', contratos: 3, renovacoes: 8, crossSell: 1, crossDetalhe: '1 produto novo por cliente em onboarding', contatos: 25, extra: 'Onboarding DCA em até 5 dias úteis' },
    { nome: 'Giovana', tipo: 'Onboarding + Renovações', contratos: 0, renovacoes: 7, crossSell: 0, crossDetalhe: '100% dos clientes sem contato em 60+ dias', contatos: 0, extra: 'Onboarding DCA em até 3 dias úteis' },
    { nome: 'Ingrid', tipo: 'Comercialização', contratos: 0, crossSell: 0, crossDetalhe: '3 parcerias empresa-produtor/mês', contatos: 0, extra: 'Meta: R$60k/mês | Pipeline R$150k/15d' },
    { nome: 'Eddi', tipo: 'Comercialização', contratos: 0, crossSell: 0, crossDetalhe: '5 empresas compradoras/mês + PDD', contatos: 0, extra: 'Meta: R$60k/mês' },
  ]

  const SEMANAS = [
    { sem: 1, periodo: '05–09 Mai', contratos: 5, renovacoes: 3, crossSells: 5, creditos: 'R$30k pipeline' },
    { sem: 2, periodo: '12–16 Mai', contratos: 5, renovacoes: 4, crossSells: 5, creditos: 'R$30k fechado' },
    { sem: 3, periodo: '19–23 Mai', contratos: 5, renovacoes: 4, crossSells: 5, creditos: 'R$30k pipeline' },
    { sem: 4, periodo: '26–30 Mai', contratos: 5, renovacoes: 4, crossSells: 5, creditos: 'R$30k fechado' },
    { sem: 5, periodo: '02–06 Jun', contratos: 5, renovacoes: 4, crossSells: 5, creditos: 'R$30k pipeline' },
    { sem: 6, periodo: '09–13 Jun', contratos: 5, renovacoes: 4, crossSells: 5, creditos: 'R$30k fechado' },
    { sem: 7, periodo: '16–20 Jun', contratos: 5, renovacoes: 4, crossSells: 5, creditos: 'R$30k pipeline' },
    { sem: 8, periodo: '23–27 Jun', contratos: 5, renovacoes: 4, crossSells: 5, creditos: 'R$30k fechado' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--brand-text)', letterSpacing: '-0.02em' }}>Metas</h1>
          <p style={{ color: 'var(--brand-muted)', fontSize: '0.84rem', marginTop: '4px' }}>
            Acompanhamento por contratos e produto · {memberRows.length} pessoas
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => { setEditingGoal(null); setShowNewGoal(true) }}>
          <Plus size={15} />
          Adicionar meta
        </button>
      </div>

      {/* Summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
        <div className="glass-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Trophy size={14} color="#93c5fd" />
            <div style={{ fontSize: '0.68rem', color: '#93c5fd', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Contratos fechados</div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#f8fafc' }}>{totalContracts}</div>
        </div>
        <div className="glass-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <TrendingUp size={14} color="#fcd34d" />
            <div style={{ fontSize: '0.68rem', color: '#fcd34d', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Em negociação</div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#f8fafc' }}>{totalOpen}</div>
        </div>
        <div className="glass-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Users size={14} color="#6ee7b7" />
            <div style={{ fontSize: '0.68rem', color: '#6ee7b7', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Produtos ativos</div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#f8fafc' }}>{byProduct.length}</div>
        </div>
        <div className="glass-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Target size={14} color="#c084fc" />
            <div style={{ fontSize: '0.68rem', color: '#c084fc', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Metas definidas</div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#f8fafc' }}>{goals.length}</div>
        </div>
      </div>

      <section className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Target size={16} color="var(--brand-primary)" />
            <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#f8fafc' }}>Metas criadas no sistema</h3>
          </div>
          <span style={{ color: 'var(--brand-muted)', fontSize: '0.78rem' }}>Essas metas alimentam o dashboard inicial.</span>
        </div>

        {orderedGoalPeriods.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', border: '1px dashed rgba(255,255,255,0.09)', borderRadius: 12, color: 'var(--brand-muted)' }}>
            Nenhuma meta criada ainda. Cadastre a meta do mes para o painel inicial sair de zero.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {orderedGoalPeriods.map((period) => (
              <div key={period} style={{ display: 'grid', gap: 10 }}>
                <div style={{ color: 'var(--brand-primary)', fontSize: '0.78rem', fontWeight: 900, textTransform: 'uppercase' }}>{formatPeriod(period)}</div>
                {goalsByPeriod[period].map((goal) => (
                  <div key={goal.id} style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--brand-text)', fontSize: '0.88rem' }}>
                          {goal.products ? `${goal.products.emoji} ${goal.products.name}` : 'Meta geral'}
                          {goal.profiles ? ` - ${goal.profiles.full_name}` : ''}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--brand-muted)', marginTop: 2 }}>{goal.notes || 'Sem observacao'}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ color: goal.percent >= 100 ? '#6ee7b7' : 'var(--brand-primary)', fontSize: '0.9rem', fontWeight: 900 }}>{goal.realized}</span>
                          <span style={{ color: 'var(--brand-muted)', fontSize: '0.82rem' }}> / {goal.goal_contracts} contratos</span>
                        </div>
                        <button type="button" className="btn-ghost" onClick={() => openEditGoal(goal)} style={{ padding: '7px 9px' }} aria-label="Editar meta">
                          <Edit3 size={14} />
                        </button>
                        <button type="button" className="btn-ghost" onClick={() => handleDeleteGoal(goal)} style={{ padding: '7px 9px', color: '#f87171' }} aria-label="Excluir meta">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="progress-bar" style={{ height: 8 }}>
                      <div className="progress-fill" style={{ width: `${Math.min(goal.percent, 100)}%`, background: goal.percent >= 100 ? '#10b981' : undefined }} />
                    </div>
                    <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', color: 'var(--brand-muted)', fontSize: '0.72rem' }}>
                      <span>{goal.percent}% concluido</span>
                      {goal.percent < 100 && <span>Faltam {Math.max(goal.goal_contracts - goal.realized, 0)} contratos</span>}
                      {goal.percent >= 100 && <span style={{ color: '#10b981', fontWeight: 800 }}>Meta batida</span>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ══ PAINEL BIMESTRAL MAI–JUN 2026 ══ */}
      <section className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Target size={16} color="var(--brand-primary)" />
            <span style={{ fontWeight: 900, fontSize: '0.9rem', color: 'var(--brand-text)' }}>Plano Bimestral — Maio + Junho 2026</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--brand-muted)', fontWeight: 700 }}>Base: ~7 contratos/mês histórico → Meta: 20/mês</span>
        </div>
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {METAS_DEPT.map(m => {
            const pct = m.isCurrency
              ? Math.min(100, Math.round((m.realizado / m.mensal) * 100))
              : Math.min(100, Math.round((m.realizado / m.bimestral) * 100))
            const valorExib = m.isCurrency
              ? `R$${(m.realizado/1000).toFixed(0)}k / R$${(m.bimestral/1000).toFixed(0)}k`
              : `${m.realizado} / ${m.bimestral}`
            return (
              <div key={m.id} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${m.cor}22`, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: m.cor }}>{m.titulo}</span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 900, color: pct >= 100 ? '#22c55e' : 'var(--brand-text)' }}>{pct}%</span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: m.cor, borderRadius: 2, transition: 'width 0.6s ease' }} />
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--brand-muted)', lineHeight: 1.4 }}>
                  <div style={{ color: 'var(--brand-text)', fontWeight: 700 }}>{valorExib} bimestral</div>
                  <div>Semanal: {m.isCurrency ? `R$${(m.semanal/1000).toFixed(0)}k` : m.semanal} · Mensal: {m.isCurrency ? `R$${(m.mensal/1000).toFixed(0)}k` : m.mensal}</div>
                  {m.diaria !== '—' && <div>Diária: {m.diaria}</div>}
                  <div style={{ marginTop: 4, color: '#64748b', fontSize: '0.65rem' }}>{m.detalhe}</div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ══ METAS INDIVIDUAIS POR CONSULTOR ══ */}
      <section className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid #38bdf8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={16} color="#38bdf8" />
            <span style={{ fontWeight: 900, fontSize: '0.9rem', color: 'var(--brand-text)' }}>Metas Individuais — Bimestre Mai+Jun 2026</span>
          </div>
        </div>
        <div style={{ padding: '14px 20px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Consultor','Tipo','Contratos/mês','Renovações/mês','Cross-sells/mês','Contatos/sem','Obs. chave'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 800, color: 'var(--brand-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CONSULTORES.map((c, i) => (
                <tr key={c.nome} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 800, color: 'var(--brand-text)', whiteSpace: 'nowrap' }}>{c.nome}</td>
                  <td style={{ padding: '8px 10px', color: 'var(--brand-muted)', fontSize: '0.72rem' }}>{c.tipo}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 700, color: c.contratos > 0 ? '#22c55e' : 'var(--brand-muted)', textAlign: 'center' }}>{c.contratos > 0 ? `${c.contratos} →  ${c.contratos*2} bim` : '—'}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 700, color: (c.renovacoes ?? 0) > 0 ? '#f59e0b' : 'var(--brand-muted)', textAlign: 'center' }}>{(c.renovacoes ?? 0) > 0 ? `${c.renovacoes} → ${(c.renovacoes??0)*2} bim` : '—'}</td>
                  <td style={{ padding: '8px 10px', color: 'var(--brand-muted)', fontSize: '0.72rem' }}>{c.crossDetalhe}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 700, color: c.contatos > 0 ? '#38bdf8' : 'var(--brand-muted)', textAlign: 'center' }}>{c.contatos > 0 ? c.contatos : '—'}</td>
                  <td style={{ padding: '8px 10px', color: '#64748b', fontSize: '0.7rem' }}>{c.extra}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ══ CRONOGRAMA SEMANAL ══ */}
      <section className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid #10b981' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <TrendingUp size={16} color="#10b981" />
            <span style={{ fontWeight: 900, fontSize: '0.9rem', color: 'var(--brand-text)' }}>Cronograma Semanal — 8 Semanas</span>
          </div>
        </div>
        <div style={{ padding: '14px 20px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Sem','Período','Contratos','Renovações','Cross-sells','Créditos ICMS'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 800, color: 'var(--brand-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SEMANAS.map((s, i) => {
                const isPipeline = s.creditos.includes('pipeline')
                return (
                  <tr key={s.sem} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 900, color: '#10b981' }}>{s.sem}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--brand-text)', fontWeight: 600, whiteSpace: 'nowrap' }}>{s.periodo}</td>
                    <td style={{ padding: '8px 10px', color: '#22c55e', fontWeight: 700, textAlign: 'center' }}>{s.contratos}</td>
                    <td style={{ padding: '8px 10px', color: '#f59e0b', fontWeight: 700, textAlign: 'center' }}>{s.renovacoes}</td>
                    <td style={{ padding: '8px 10px', color: '#38bdf8', fontWeight: 700, textAlign: 'center' }}>{s.crossSells}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: isPipeline ? 'rgba(59,130,246,0.12)' : 'rgba(34,197,94,0.12)', color: isPipeline ? '#3b82f6' : '#22c55e', border: `1px solid ${isPipeline ? 'rgba(59,130,246,0.25)' : 'rgba(34,197,94,0.25)'}` }}>
                        {s.creditos}
                      </span>
                    </td>
                  </tr>
                )
              })}
              <tr style={{ borderTop: '2px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
                <td colSpan={2} style={{ padding: '8px 10px', fontWeight: 900, color: 'var(--brand-primary)', fontSize: '0.78rem' }}>TOTAL Bimestral</td>
                <td style={{ padding: '8px 10px', color: '#22c55e', fontWeight: 900, textAlign: 'center' }}>40</td>
                <td style={{ padding: '8px 10px', color: '#f59e0b', fontWeight: 900, textAlign: 'center' }}>30</td>
                <td style={{ padding: '8px 10px', color: '#38bdf8', fontWeight: 900, textAlign: 'center' }}>40</td>
                <td style={{ padding: '8px 10px', color: 'var(--brand-primary)', fontWeight: 900, fontSize: '0.78rem' }}>R$240.000</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 20px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(245,158,11,0.03)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[
            { label: '100% meta mensal', valor: '+10% sobre comissões', cor: '#22c55e' },
            { label: '120% meta mensal', valor: '+20% sobre comissões', cor: '#f59e0b' },
            { label: 'Pagamento', valor: 'Até 5º dia útil após recebimento', cor: '#38bdf8' },
          ].map(b => (
            <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: b.cor }} />
              <span style={{ fontSize: '0.72rem', color: 'var(--brand-muted)' }}>{b.label}:</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: b.cor }}>{b.valor}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Goals list */}
      {false && goalsWithProgress.length > 0 && (
        <section className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Target size={16} color="var(--brand-primary)" />
            <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#f8fafc' }}>Metas do período</h3>
          </div>
          <div style={{ display: 'grid', gap: '12px' }}>
            {goalsWithProgress.map((goal) => (
              <div key={goal.id} style={{ borderRadius: '14px', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 800, color: 'var(--brand-text)', fontSize: '0.88rem' }}>
                      {goal.products ? `${goal.products.emoji} ${goal.products.name}` : '🎯 Geral'}
                      {goal.profiles ? ` · ${goal.profiles.full_name}` : ''}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--brand-muted)', marginTop: '2px' }}>
                      {formatPeriod(goal.period)}
                      {goal.notes ? ` · ${goal.notes}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: goal.percent >= 100 ? '#6ee7b7' : 'var(--brand-primary)', fontSize: '0.9rem', fontWeight: 900 }}>
                      {goal.realized}
                    </span>
                    <span style={{ color: 'var(--brand-muted)', fontSize: '0.82rem' }}> / {goal.goal_contracts} contratos</span>
                  </div>
                </div>
                <div className="progress-bar" style={{ height: '8px' }}>
                  <div
                    className="progress-fill"
                    style={{ width: `${Math.min(goal.percent, 100)}%`, background: goal.percent >= 100 ? '#10b981' : undefined }}
                  />
                </div>
                <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between', color: 'var(--brand-muted)', fontSize: '0.72rem' }}>
                  <span>{goal.percent}% concluído</span>
                  {goal.percent < 100 && <span>Faltam {goal.goal_contracts - goal.realized} contratos</span>}
                  {goal.percent >= 100 && <span style={{ color: '#10b981', fontWeight: 800 }}>✓ Meta batida!</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* By product */}
      <section className="glass-card" style={{ padding: '20px' }}>
        <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#f8fafc', marginBottom: '4px' }}>Contratos por produto</h3>
        <p style={{ color: 'var(--brand-muted)', fontSize: '0.78rem', marginBottom: '16px' }}>
          Distribuição de contratos fechados e leads em negociação por linha de serviço.
        </p>
        <div style={{ display: 'grid', gap: '12px' }}>
          {byProduct.map((p) => {
            const total = p.closed + p.open
            const closedPercent = total > 0 ? Math.round((p.closed / total) * 100) : 0

            return (
              <div key={p.id} style={{ borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1rem' }}>{p.emoji || '📦'}</span>
                    <span style={{ fontWeight: 800, color: 'var(--brand-text)', fontSize: '0.88rem' }}>{p.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ color: '#6ee7b7', fontSize: '0.78rem', fontWeight: 800 }}>{p.closed} fechados</span>
                    <span style={{ color: '#fcd34d', fontSize: '0.78rem', fontWeight: 700 }}>{p.open} abertos</span>
                  </div>
                </div>
                <div className="progress-bar" style={{ height: '8px' }}>
                  <div className="progress-fill" style={{ width: `${closedPercent}%` }} />
                </div>
                <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', color: 'var(--brand-muted)', fontSize: '0.72rem' }}>
                  <span>{closedPercent}% conversão</span>
                  <span>{total} contatos no total</span>
                </div>
              </div>
            )
          })}
          {byProduct.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--brand-muted)' }}>Nenhum produto cadastrado.</div>
          )}
        </div>
      </section>

      {/* By person — without revenue */}
      <section className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontWeight: 800, fontSize: '0.95rem', color: '#f8fafc' }}>Ritmo por pessoa</h3>
            <p style={{ color: 'var(--brand-muted)', fontSize: '0.78rem', marginTop: '4px' }}>
              Contratos fechados e em negociação por consultor, com detalhamento por produto.
            </p>
          </div>
          <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.08)' }}>
            {memberRows.length} pessoas
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Pessoa', 'Fechados', 'Em negociação', 'Por produto'].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.72rem', color: 'var(--brand-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {memberRows.map((m) => (
                <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="avatar">{m.name[0]}</div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#f8fafc' }}>{m.name}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--brand-muted)' }}>{m.role}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ fontWeight: 800, color: '#6ee7b7', fontSize: '0.92rem' }}>{m.contracts}</span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ fontWeight: 800, color: '#fcd34d', fontSize: '0.92rem' }}>{m.open}</span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {m.byProduct.length > 0 ? m.byProduct.map((bp) => (
                        <span key={bp.productId} className="chip" style={{ fontSize: '0.68rem' }}>
                          {bp.emoji || '📦'} {bp.closed}✓ {bp.open > 0 ? `${bp.open}⏳` : ''}
                        </span>
                      )) : (
                        <span style={{ color: '#64748b', fontSize: '0.74rem' }}>—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {memberRows.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '28px', textAlign: 'center', color: 'var(--brand-muted)' }}>
                    Nenhum membro cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── DIALOG: Nova Meta ── */}
      <ActionDialog
        open={showNewGoal}
        title={editingGoal ? 'Editar meta' : 'Adicionar meta'}
        subtitle="Defina uma meta de contratos por período, produto ou consultor."
        onClose={closeGoalDialog}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={closeGoalDialog}>Cancelar</button>
            <button type="button" className="btn-primary" onClick={handleSaveGoal} disabled={saving}>
              <Target size={14} />
              {saving ? 'Salvando...' : editingGoal ? 'Atualizar meta' : 'Salvar meta'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '7px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>
                Período (mês/ano) *
              </label>
              <input
                className="input-field"
                type="month"
                value={draft.period}
                onChange={(e) => setDraft((s) => ({ ...s, period: e.target.value }))}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '7px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>
                Meta de contratos *
              </label>
              <input
                className="input-field"
                type="number"
                min="1"
                placeholder="Ex: 10"
                value={draft.goal_contracts}
                onChange={(e) => setDraft((s) => ({ ...s, goal_contracts: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '7px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>
              Produto (opcional — vazio = geral)
            </label>
            <select
              className="input-field"
              value={draft.product_id}
              onChange={(e) => setDraft((s) => ({ ...s, product_id: e.target.value }))}
            >
              <option value="">— Geral / Todos os produtos —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.emoji || '📦'} {p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '7px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>
              Consultor (opcional — vazio = equipe toda)
            </label>
            <select
              className="input-field"
              value={draft.consultant_id}
              onChange={(e) => setDraft((s) => ({ ...s, consultant_id: e.target.value }))}
            >
              <option value="">— Todos da equipe —</option>
              {consultants.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '7px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>
              Observação
            </label>
            <input
              className="input-field"
              placeholder="Ex: Meta de captação por campanha"
              value={draft.notes}
              onChange={(e) => setDraft((s) => ({ ...s, notes: e.target.value }))}
            />
          </div>
        </div>
      </ActionDialog>
    </div>
  )
}
