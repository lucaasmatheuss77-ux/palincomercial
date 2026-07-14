'use client'

import { useState } from 'react'
import {
  BarChart3,
  Download,
  Edit3,
  Eye,
  Flag,
  ListChecks,
  Loader2,
  LockKeyhole,
  Paperclip,
  Plus,
  Rocket,
  ShieldAlert,
  Target,
  Trash2,
  TrendingUp,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import ActionDialog from '@/components/action-dialog'
import {
  createStrategicPlanItem,
  deleteStrategicPlanItem,
  updateStrategicPlanItem,
  uploadStrategicPlanFile,
  type StrategicPlanItem,
} from '@/app/actions/planejamento'

const pillars = [
  {
    title: 'Proposta de valor',
    current: 'Consolidada em 2025',
    text: 'Recuperar créditos tributários e estruturar estratégias jurídicas com resultado comprovado para empresas B2B e produtores rurais.',
  },
  {
    title: 'Posicionamento',
    current: 'Fortalecer comunicação',
    text: 'Especialista regional em ICMS, crédito rural e teses tributárias, com diferenciação por técnica e relacionamento.',
  },
  {
    title: 'Segmento PJ',
    current: 'ICMS e Jurídico com maior peso',
    text: 'Indústrias, agro e comércio atacadista com decisão pelo dono e ciclo comercial mais curto.',
  },
  {
    title: 'Segmento Rural',
    current: 'Potencial recorrente',
    text: 'Produtores com crédito ICMS acumulado em cooperativas, tradings e operações rurais.',
  },
]

type PlanningStats = {
  contratosPj: number
  contratosRurais: number
  mediaPjMes: number
  renovacaoPj: number
  creditoIcmsLiberado: number
  honorariosFixosAtivos: number
  trabalhosVariaveisAtivos: number
  clientesAtivos: number
  clientesAvencer: number
  monthlyCounts: number[]
}

function formatCompactCurrency(value: number) {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace('.0', '')}M`
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(1).replace('.0', '')}mil`
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value)
}

function buildNumericGoals(stats: PlanningStats) {
  return [
    { label: 'Contratos PJ no ano', actual: String(stats.contratosPj), target: '90' },
    { label: 'Contratos rurais no ano', actual: String(stats.contratosRurais), target: '110' },
    { label: 'Média PJ por mês', actual: String(stats.mediaPjMes), target: '9' },
    { label: 'Renovação PJ', actual: `${stats.renovacaoPj}%`, target: '35%' },
    { label: 'Crédito ICMS liberado', actual: formatCompactCurrency(stats.creditoIcmsLiberado), target: 'R$ 8,5M' },
    { label: 'Honorários fixos/mes', actual: formatCompactCurrency(stats.honorariosFixosAtivos), target: '—' },
    { label: 'Trabalhos com honorario variavel', actual: String(stats.trabalhosVariaveisAtivos), target: '—' },
  ]
}

const quarters = [
  {
    period: 'Q1',
    title: 'Estruturação e base',
    owner: 'Liderança Comercial',
    kpi: '9 contratos PJ/mês e 3 consultores rurais ativos',
    actions: ['Implantar metas por consultor', 'Mapear produtores potenciais', 'Organizar rotina semanal de pipeline'],
  },
  {
    period: 'Q2',
    title: 'Crescimento e novos clientes',
    owner: 'Juliana e Carina',
    kpi: '10 contratos PJ/mês e renovação acima de 20%',
    actions: ['Campanha de ICMS', 'Portfólio completo por cliente', 'Revisão semanal de propostas quentes'],
  },
  {
    period: 'Q3',
    title: 'Consolidação e retenção',
    owner: 'Toda equipe',
    kpi: '11 contratos PJ/mês e zero cliente A perdido',
    actions: ['Follow-up de 90 dias', 'Cross-sell em clientes ativos', 'Análise ABC de clientes em risco'],
  },
  {
    period: 'Q4',
    title: 'Fechamento e previsibilidade',
    owner: 'Gestão',
    kpi: '90 contratos PJ no ano e crédito rural acima da meta',
    actions: ['Plano de renovação 2027', 'Forecast por categoria', 'Ajuste final de carteira e metas'],
  },
]

const staticRisks = [
  'Dependência de poucos consultores em carteiras importantes.',
  'Sazonalidade com meses fracos sem pré-aquecimento.',
  'Metas comerciais desconectadas do painel operacional.',
]

const scoreMonths = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Target
  title: string
  subtitle: string
}) {
  return (
    <div className="planning-section-title">
      <span><Icon size={18} /></span>
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  )
}

const emptyItemDraft = {
  title: '',
  description: '',
  category: 'geral',
  target_value: '',
  current_value: '',
  unit: '',
  due_date: '',
  status: 'em_andamento',
  owner_id: '',
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  em_andamento: { label: 'Em andamento', color: '#60a5fa' },
  concluido: { label: 'Concluído', color: '#86efac' },
  atrasado: { label: 'Atrasado', color: '#f87171' },
  planejado: { label: 'Planejado', color: '#c084fc' },
}

export default function PlanejamentoClient({
  canEdit = false,
  stats,
  items: initialItems = [],
  owners = [],
}: {
  canEdit?: boolean
  stats: PlanningStats
  items?: StrategicPlanItem[]
  owners?: { id: string; name: string }[]
}) {
  const numericGoals = buildNumericGoals(stats)
  const risks = [
    stats.clientesAvencer > 0
      ? `${stats.clientesAvencer} cliente${stats.clientesAvencer === 1 ? '' : 's'} com contrato a vencer nos próximos 12 meses sem renovação garantida.`
      : 'Nenhum cliente com contrato vencendo nos próximos 12 meses no momento.',
    ...staticRisks,
  ]

  const [items, setItems] = useState<StrategicPlanItem[]>(initialItems)
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<StrategicPlanItem | null>(null)
  const [itemDraft, setItemDraft] = useState(emptyItemDraft)
  const [savingItem, setSavingItem] = useState(false)
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null)

  function openNewItem() {
    setEditingItem(null)
    setItemDraft(emptyItemDraft)
    setItemDialogOpen(true)
  }

  function openEditItem(item: StrategicPlanItem) {
    setEditingItem(item)
    setItemDraft({
      title: item.title,
      description: item.description || '',
      category: item.category || 'geral',
      target_value: item.target_value != null ? String(item.target_value) : '',
      current_value: item.current_value != null ? String(item.current_value) : '',
      unit: item.unit || '',
      due_date: item.due_date || '',
      status: item.status,
      owner_id: item.owner_id || '',
    })
    setItemDialogOpen(true)
  }

  function closeItemDialog() {
    setItemDialogOpen(false)
    setEditingItem(null)
    setItemDraft(emptyItemDraft)
  }

  async function handleSaveItem() {
    if (!itemDraft.title.trim()) { toast.error('Informe o título do item.'); return }
    setSavingItem(true)
    try {
      const payload = {
        title: itemDraft.title,
        description: itemDraft.description || null,
        category: itemDraft.category || 'geral',
        target_value: itemDraft.target_value ? Number(itemDraft.target_value) : null,
        current_value: itemDraft.current_value ? Number(itemDraft.current_value) : 0,
        unit: itemDraft.unit || null,
        due_date: itemDraft.due_date || null,
        status: itemDraft.status,
        owner_id: itemDraft.owner_id || null,
      }
      const result = editingItem
        ? await updateStrategicPlanItem(editingItem.id, payload)
        : await createStrategicPlanItem(payload)
      if (!result.success) { toast.error(result.error || 'Erro ao salvar item.'); return }

      const owner = owners.find((o) => o.id === itemDraft.owner_id)
      if (editingItem) {
        setItems((current) => current.map((item) => item.id === editingItem.id ? { ...item, ...payload, owner_name: owner?.name || null } : item))
      } else {
        const newId = (result as { data?: { id: string } }).data?.id || crypto.randomUUID()
        setItems((current) => [{ id: newId, ...payload, owner_name: owner?.name || null, file_path: null, file_name: null, file_signed_url: null, created_at: new Date().toISOString() }, ...current])
      }
      toast.success(editingItem ? 'Item atualizado.' : 'Item criado.')
      closeItemDialog()
    } finally {
      setSavingItem(false)
    }
  }

  async function handleDeleteItem(item: StrategicPlanItem) {
    if (!confirm(`Excluir o item "${item.title}"?`)) return
    const result = await deleteStrategicPlanItem(item.id)
    if (!result.success) { toast.error(result.error || 'Erro ao excluir item.'); return }
    setItems((current) => current.filter((row) => row.id !== item.id))
    toast.success('Item excluído.')
  }

  async function handleUploadItemFile(item: StrategicPlanItem, file: File) {
    setUploadingItemId(item.id)
    try {
      const formData = new FormData()
      formData.append('item_id', item.id)
      formData.append('file', file)
      const result = await uploadStrategicPlanFile(formData)
      if (!result.success) { toast.error(result.error || 'Erro ao enviar arquivo.'); return }
      setItems((current) => current.map((row) => row.id === item.id ? { ...row, file_name: file.name } : row))
      toast.success('Arquivo anexado. Recarregue a página para abrir o link.')
    } finally {
      setUploadingItemId(null)
    }
  }

  function handleExport() {
    const rows = [
      ['Indicador', 'Real', 'Meta'],
      ...numericGoals.map((goal) => [goal.label, goal.actual, goal.target]),
      ['Clientes ativos', String(stats.clientesAtivos), ''],
      ['Clientes a vencer (12 meses)', String(stats.clientesAvencer), ''],
    ]
    const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `planejamento-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="planning-shell">
      <section className="glass-card planning-hero">
        <div>
          <span className="planning-kicker"><Target size={16} /> Planejamento comercial 2026</span>
          <h1>Plano estratégico Palin & Martins</h1>
          <p>
            Uma visão simples para o time acompanhar direção, metas, riscos e próximos movimentos sem parecer planilha solta.
          </p>
        </div>
        <div className="planning-actions">
          <span className={canEdit ? 'planning-mode is-open' : 'planning-mode'}>
            {canEdit ? <Edit3 size={15} /> : <LockKeyhole size={15} />}
            {canEdit ? 'Edição liberada' : 'Leitura do time'}
          </span>
          <button type="button" className="planning-button" onClick={handleExport}>
            <Download size={16} />
            Exportar
          </button>
          <button type="button" className="planning-button primary" disabled={!canEdit} onClick={openNewItem}>
            <Plus size={16} />
            Adicionar item ao plano
          </button>
        </div>
      </section>

      <section className="planning-metrics">
        <div className="glass-card planning-metric"><span>Clientes ativos</span><strong>{stats.clientesAtivos}</strong><small>carteira atual</small></div>
        <div className="glass-card planning-metric"><span>Foco mensal PJ</span><strong>{stats.mediaPjMes}</strong><small>meta: 9 contratos/mês</small></div>
        <div className="glass-card planning-metric"><span>Rural</span><strong>{stats.contratosRurais}</strong><small>meta: 110 contratos no ano</small></div>
        <div className="glass-card planning-metric"><span>ICMS liberado</span><strong>{formatCompactCurrency(stats.creditoIcmsLiberado)}</strong><small>meta: R$ 8,5M</small></div>
      </section>

      <section className="glass-card planning-card">
        <SectionTitle icon={Eye} title="Visão e posicionamento" subtitle="O que o time precisa defender em cada conversa comercial." />
        <div className="planning-pillars">
          {pillars.map((pillar) => (
            <article key={pillar.title}>
              <span>{pillar.title}</span>
              <h3>{pillar.current}</h3>
              <p>{pillar.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="glass-card planning-card">
        <SectionTitle icon={BarChart3} title="Metas numéricas" subtitle="Resumo editável pela gestão e lido pelo time no dia a dia." />
        <div className="planning-goals">
          {numericGoals.map((goal) => (
            <div key={goal.label}>
              <span>{goal.label}</span>
              <strong>{goal.target}</strong>
              <small>Real: {goal.actual}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-card planning-card">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <SectionTitle icon={ListChecks} title="Itens do plano" subtitle="Crie, acompanhe e anexe documentos aos itens do planejamento." />
          <button type="button" className="planning-button primary" disabled={!canEdit} onClick={openNewItem} style={{ minHeight: '38px' }}>
            <Plus size={15} />
            Novo item
          </button>
        </div>
        {items.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--brand-muted)', border: '1px dashed rgba(255,255,255,0.09)', borderRadius: '10px' }}>
            Nenhum item cadastrado ainda. {canEdit ? 'Clique em "Novo item" para começar.' : ''}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {items.map((item) => {
              const statusInfo = STATUS_LABEL[item.status] || STATUS_LABEL.em_andamento
              const progress = item.target_value ? Math.min(100, Math.round(((item.current_value || 0) / item.target_value) * 100)) : null
              return (
                <div key={item.id} style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', padding: '14px 16px', display: 'grid', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ color: 'var(--brand-text)', fontSize: '0.92rem' }}>{item.title}</strong>
                        <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 800, color: statusInfo.color, background: `${statusInfo.color}1a`, border: `1px solid ${statusInfo.color}40`, textTransform: 'uppercase' }}>
                          {statusInfo.label}
                        </span>
                      </div>
                      {item.description && <p style={{ color: 'var(--brand-muted)', fontSize: '0.8rem', margin: '4px 0 0' }}>{item.description}</p>}
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '6px', fontSize: '0.74rem', color: '#8da2c2' }}>
                        {item.owner_name && <span>Responsável: {item.owner_name}</span>}
                        {item.due_date && <span>Prazo: {new Date(`${item.due_date}T12:00:00`).toLocaleDateString('pt-BR')}</span>}
                        {item.target_value != null && <span>{item.current_value || 0} / {item.target_value} {item.unit}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {item.file_signed_url ? (
                        <a href={item.file_signed_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#60a5fa', fontSize: '0.75rem', fontWeight: 700, textDecoration: 'none' }}>
                          <Paperclip size={13} /> {item.file_name}
                        </a>
                      ) : canEdit ? (
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700, cursor: uploadingItemId === item.id ? 'wait' : 'pointer', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '6px 10px' }}>
                          {uploadingItemId === item.id ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                          Anexar
                          <input
                            type="file"
                            style={{ display: 'none' }}
                            disabled={uploadingItemId === item.id}
                            onChange={(event) => {
                              const file = event.target.files?.[0]
                              if (file) void handleUploadItemFile(item, file)
                              event.target.value = ''
                            }}
                          />
                        </label>
                      ) : null}
                      {canEdit && (
                        <>
                          <button type="button" onClick={() => openEditItem(item)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }} aria-label="Editar item"><Edit3 size={15} /></button>
                          <button type="button" onClick={() => void handleDeleteItem(item)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }} aria-label="Excluir item"><Trash2 size={15} /></button>
                        </>
                      )}
                    </div>
                  </div>
                  {progress !== null && (
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${progress}%`, background: progress >= 100 ? '#22c55e' : 'var(--brand-primary)', transition: 'width 0.4s ease' }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="glass-card planning-card">
        <SectionTitle icon={Rocket} title="Plano trimestral" subtitle="Escopo de execução para o ano, sem excesso de texto na tela." />
        <div className="planning-quarters">
          {quarters.map((quarter) => (
            <article key={quarter.period}>
              <div>
                <span>{quarter.period}</span>
                <h3>{quarter.title}</h3>
              </div>
              <p>{quarter.kpi}</p>
              <ul>
                {quarter.actions.map((action) => <li key={action}>{action}</li>)}
              </ul>
              <small>{quarter.owner}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="planning-two-columns">
        <div className="glass-card planning-card">
          <SectionTitle icon={ShieldAlert} title="Riscos de atenção" subtitle="Pontos que precisam de rotina, dono e cobrança." />
          <div className="planning-risk-list">
            {risks.map((risk, index) => (
              <div key={risk}>
                <b>{index + 1}</b>
                <span>{risk}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card planning-card">
          <SectionTitle icon={TrendingUp} title="Score mensal" subtitle="Leitura rápida para acompanhar o ano." />
          <div className="planning-score">
            {scoreMonths.map((month, index) => {
              const count = stats.monthlyCounts[index] || 0
              const isFuture = index > new Date().getMonth()
              return (
                <div key={month}>
                  <span>{month}</span>
                  <b>{count}</b>
                  <small>{isFuture ? 'a vir' : count > 0 ? 'contratos' : 'sem contrato'}</small>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="glass-card planning-footer">
        <Flag size={18} />
        <div>
          <strong>Como usar</strong>
          <p>
            O time acompanha em modo leitura. O responsável atualiza metas, plano e riscos conforme o fechamento mensal e o painel de metas.
          </p>
        </div>
      </section>

      <ActionDialog
        open={itemDialogOpen}
        title={editingItem ? 'Editar item do plano' : 'Novo item do plano'}
        subtitle="Defina o que precisa ser feito, a meta numérica (se houver) e o responsável."
        onClose={closeItemDialog}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={closeItemDialog}>Cancelar</button>
            <button type="button" className="btn-primary" onClick={() => void handleSaveItem()} disabled={savingItem}>
              {savingItem ? 'Salvando...' : editingItem ? 'Salvar alterações' : 'Criar item'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '7px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>Título *</label>
            <input className="input-field" placeholder="Ex: Lançar campanha de ICMS" value={itemDraft.title} onChange={(e) => setItemDraft((c) => ({ ...c, title: e.target.value }))} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '7px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>Descrição</label>
            <textarea className="input-field" rows={2} placeholder="Detalhe o que precisa ser feito" value={itemDraft.description} onChange={(e) => setItemDraft((c) => ({ ...c, description: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '7px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>Meta numérica (opcional)</label>
              <input className="input-field" type="number" placeholder="Ex: 20" value={itemDraft.target_value} onChange={(e) => setItemDraft((c) => ({ ...c, target_value: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '7px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>Valor atual</label>
              <input className="input-field" type="number" placeholder="Ex: 8" value={itemDraft.current_value} onChange={(e) => setItemDraft((c) => ({ ...c, current_value: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '7px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>Unidade</label>
              <input className="input-field" placeholder="Ex: contratos, R$, %" value={itemDraft.unit} onChange={(e) => setItemDraft((c) => ({ ...c, unit: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '7px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>Prazo</label>
              <input className="input-field" type="date" value={itemDraft.due_date} onChange={(e) => setItemDraft((c) => ({ ...c, due_date: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '7px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>Status</label>
              <select className="input-field" value={itemDraft.status} onChange={(e) => setItemDraft((c) => ({ ...c, status: e.target.value }))}>
                <option value="planejado">Planejado</option>
                <option value="em_andamento">Em andamento</option>
                <option value="concluido">Concluído</option>
                <option value="atrasado">Atrasado</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '7px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>Responsável</label>
              <select className="input-field" value={itemDraft.owner_id} onChange={(e) => setItemDraft((c) => ({ ...c, owner_id: e.target.value }))}>
                <option value="">— Sem responsável definido —</option>
                {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      </ActionDialog>

      <style>{`
        .planning-shell {
          width: 100%;
          max-width: 1600px;
          margin: 0 auto;
          display: grid;
          gap: 18px;
        }

        .planning-hero {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          padding: 26px;
          border-color: rgba(212,160,23,0.22);
        }

        .planning-kicker,
        .planning-mode {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--brand-primary);
          font-size: 0.78rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0;
        }

        .planning-hero h1 {
          margin: 12px 0 8px;
          color: var(--brand-text);
          font-size: clamp(2rem, 4vw, 3.7rem);
          line-height: 1;
          letter-spacing: 0;
        }

        .planning-hero p {
          max-width: 760px;
          color: var(--brand-muted);
          font-size: 1rem;
          line-height: 1.45;
        }

        .planning-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
        }

        .planning-mode {
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 8px;
          background: rgba(255,255,255,0.04);
          color: #90a0b8;
          padding: 10px 12px;
        }

        .planning-mode.is-open {
          border-color: rgba(34,197,94,0.35);
          background: rgba(34,197,94,0.1);
          color: #86efac;
        }

        .planning-button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 42px;
          border: 1px solid rgba(212,160,23,0.22);
          border-radius: 8px;
          background: rgba(255,255,255,0.035);
          color: var(--brand-text);
          padding: 0 14px;
          font-weight: 900;
          cursor: pointer;
        }

        .planning-button.primary {
          background: var(--brand-primary);
          color: #080b10;
          box-shadow: 0 12px 24px rgba(212,160,23,0.18);
        }

        .planning-button:disabled {
          opacity: 0.42;
          cursor: not-allowed;
        }

        .planning-metrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .planning-metric,
        .planning-card,
        .planning-footer {
          padding: 18px;
        }

        .planning-metric span,
        .planning-goals span,
        .planning-pillars span {
          color: #8da2c2;
          font-size: 0.75rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .planning-metric strong {
          display: block;
          color: var(--brand-primary);
          font-size: 2rem;
          line-height: 1;
          margin: 10px 0 6px;
        }

        .planning-metric small,
        .planning-goals small,
        .planning-quarters small,
        .planning-score small {
          color: var(--brand-muted);
          font-size: 0.78rem;
        }

        .planning-section-title {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 16px;
        }

        .planning-section-title > span {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          background: rgba(212,160,23,0.1);
          color: var(--brand-primary);
        }

        .planning-section-title h2 {
          color: var(--brand-text);
          font-size: 1.2rem;
          margin: 0 0 4px;
        }

        .planning-section-title p {
          color: var(--brand-muted);
          margin: 0;
        }

        .planning-pillars,
        .planning-goals,
        .planning-quarters,
        .planning-score {
          display: grid;
          gap: 12px;
        }

        .planning-pillars {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .planning-pillars article,
        .planning-goals div,
        .planning-quarters article,
        .planning-risk-list div,
        .planning-score div {
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 8px;
          background: rgba(255,255,255,0.025);
          padding: 14px;
        }

        .planning-pillars h3,
        .planning-quarters h3 {
          color: var(--brand-text);
          font-size: 1rem;
          margin: 8px 0;
        }

        .planning-pillars p,
        .planning-quarters p,
        .planning-footer p {
          color: var(--brand-muted);
          line-height: 1.45;
          margin: 0;
        }

        .planning-goals {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .planning-goals strong {
          display: block;
          color: var(--brand-text);
          font-size: 1.55rem;
          margin: 10px 0 6px;
        }

        .planning-quarters {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .planning-quarters article > div {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .planning-quarters article > div span,
        .planning-risk-list b {
          width: 38px;
          height: 38px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          background: var(--brand-primary);
          color: #090b10;
          font-weight: 1000;
          flex: 0 0 auto;
        }

        .planning-quarters ul {
          margin: 12px 0;
          padding-left: 18px;
          color: #b6c3d7;
          display: grid;
          gap: 6px;
          font-size: 0.86rem;
        }

        .planning-two-columns {
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
          gap: 18px;
        }

        .planning-risk-list {
          display: grid;
          gap: 10px;
        }

        .planning-risk-list div {
          display: flex;
          align-items: center;
          gap: 12px;
          border-color: rgba(255,70,70,0.18);
          background: rgba(255,70,70,0.06);
        }

        .planning-risk-list span {
          color: #ffd4d4;
          line-height: 1.35;
        }

        .planning-score {
          grid-template-columns: repeat(6, minmax(0, 1fr));
        }

        .planning-score div {
          text-align: center;
        }

        .planning-score span {
          display: block;
          color: #8da2c2;
          font-weight: 900;
        }

        .planning-score b {
          display: block;
          color: var(--brand-primary);
          font-size: 1.4rem;
          margin: 6px 0 2px;
        }

        .planning-footer {
          display: flex;
          align-items: center;
          gap: 12px;
          border-color: rgba(34,197,94,0.2);
        }

        .planning-footer svg {
          color: #22c55e;
          flex: 0 0 auto;
        }

        .planning-footer strong {
          color: var(--brand-text);
        }

        @media (max-width: 1100px) {
          .planning-hero,
          .planning-two-columns {
            grid-template-columns: 1fr;
            display: grid;
          }
          .planning-metrics,
          .planning-pillars,
          .planning-quarters {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .planning-metrics,
          .planning-pillars,
          .planning-goals,
          .planning-quarters,
          .planning-score {
            grid-template-columns: 1fr;
          }
          .planning-hero {
            padding: 20px;
          }
          .planning-actions {
            justify-content: flex-start;
          }
        }
      `}</style>
    </div>
  )
}
