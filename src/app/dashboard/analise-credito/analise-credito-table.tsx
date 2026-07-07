'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Edit3,
  FileText,
  History,
  LayoutGrid,
  Layers3,
  LockKeyhole,
  Percent,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { closeIcmsMonthForClient, createIcmsOperation, deleteIcmsOperation, updateIcmsOperation } from '@/app/actions/icms'
import { listFiliaisByClient, type FilialRecord } from '@/app/actions/filiais'
import { ClientSearchField, type ClienteOption } from '@/components/client-search-field'

export type IcmsOperation = {
  id: string
  data_venda: string
  empresa: string
  propriedade: string
  cliente: string
  client_id?: string | null
  filial_id?: string | null
  nota_fiscal: string
  valor_venda: number
  valor_icms: number
  porcentagem_honorarios: number
  valor_honorarios: number
  deferimento: string
  month_year: string
  status_fechamento: string
}

const brl = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value)

const brlFull = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

const controlClass =
  'h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20'

const defaultIcmsForm = {
  data_venda: '',
  empresa: '',
  propriedade: '',
  cliente: '',
  client_id: null as string | null,
  filial_id: null as string | null,
  nota_fiscal: '',
  valor_venda: '',
  valor_icms: '',
  pct: '1.5',
  valor_honorarios: '',
  deferimento: 'Deferido',
  month_year: '',
}

function formatCurrencyInput(digits: string) {
  const clean = digits.replace(/\D/g, '')
  if (!clean) return ''
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.parseInt(clean, 10) / 100)
}

function currencyDigitsToNumber(digits: string) {
  const clean = digits.replace(/\D/g, '')
  return clean ? Number.parseInt(clean, 10) / 100 : 0
}

function numberToCurrencyDigits(value: number) {
  return value ? String(Math.round(value * 100)) : ''
}

function monthYearFromDate(value: string) {
  if (!value) return ''
  const [year, month] = value.split('-')
  return month && year ? `${month}/${year}` : ''
}

function monthSortKey(monthYear: string) {
  const [month, year] = monthYear.split('/').map(Number)
  if (!month || !year) return 0
  return year * 12 + month
}

function statusAccentColor(value: string) {
  const normalized = value === 'Deferido' || value === 'Indeferido' ? value : 'Pendente'
  if (normalized === 'Deferido') return 'rgba(16,185,129,0.55)'
  if (normalized === 'Indeferido') return 'rgba(239,68,68,0.55)'
  return 'rgba(245,158,11,0.55)'
}

function StatusBadge({ value }: { value: string }) {
  const normalized = value === 'Deferido' || value === 'Indeferido' ? value : 'Pendente'
  const Icon = normalized === 'Deferido' ? BadgeCheck : normalized === 'Indeferido' ? AlertCircle : Clock
  const className =
    normalized === 'Deferido'
      ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
      : normalized === 'Indeferido'
        ? 'border-red-500/25 bg-red-500/10 text-red-300'
        : 'border-yellow-500/25 bg-yellow-500/10 text-yellow-300'

  return (
    <span className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-bold ${className}`}>
      <Icon size={13} aria-hidden="true" />
      {normalized}
    </span>
  )
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'info',
  accent = false,
}: {
  label: string
  value: string | number
  detail: string
  icon: typeof TrendingUp
  tone?: 'info' | 'sales' | 'credit' | 'fees'
  accent?: boolean
}) {
  return (
    <div className={`glass-card analise-kpi-card ${accent ? 'analise-kpi-accent' : ''}`}>
      <div className="analise-kpi-header">
        <span>{label}</span>
        <span className={`analise-kpi-icon analise-kpi-icon-${tone}`}>
          <Icon size={16} aria-hidden="true" />
        </span>
      </div>
      <strong className="font-kpi">{value}</strong>
      <small>{detail}</small>
    </div>
  )
}

export default function AnaliseCreditoTable({
  initialOperations,
  clientes = [],
}: {
  initialOperations: IcmsOperation[]
  clientes?: ClienteOption[]
}) {
  const [ops, setOps] = useState(initialOperations)
  const [tab, setTab] = useState<'Open' | 'Closed'>('Open')
  const [clientFilter, setClientFilter] = useState('Todos')
  const [monthFilter, setMonthFilter] = useState('Todos')
  const [search, setSearch] = useState('')
  const [grouped, setGrouped] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [isClosing, setIsClosing] = useState(false)
  const [modal, setModal] = useState(false)
  const [editingOperation, setEditingOperation] = useState<IcmsOperation | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(defaultIcmsForm)
  const [formFiliais, setFormFiliais] = useState<FilialRecord[]>([])
  const [formFiliaisLoading, setFormFiliaisLoading] = useState(false)

  useEffect(() => {
    const icms = currencyDigitsToNumber(form.valor_icms)
    const pct = Number.parseFloat(form.pct) || 0
    setForm((prev) => ({ ...prev, valor_honorarios: icms > 0 && pct > 0 ? (icms * pct / 100).toFixed(2) : '' }))
  }, [form.valor_icms, form.pct])

  // Só valores que realmente existem em `ops` entram no filtro, para o cliente selecionado
  // sempre bater exatamente com os lançamentos (e o botão "Encerrar mês" nunca ficar preso).
  const clients = useMemo(() => [...new Set(ops.map((op) => op.cliente).filter(Boolean))].sort(), [ops])

  async function fetchFiliaisForClient(clientId: string) {
    setFormFiliaisLoading(true)
    try {
      const result = await listFiliaisByClient(clientId)
      setFormFiliais(result)
    } catch {
      setFormFiliais([])
    } finally {
      setFormFiliaisLoading(false)
    }
  }

  function selectClientForForm(cliente: ClienteOption) {
    setForm((prev) => ({
      ...prev,
      cliente: cliente.nome,
      client_id: cliente.id,
      filial_id: null,
      propriedade: '',
      empresa: cliente.company_name || cliente.nome,
    }))
    void fetchFiliaisForClient(cliente.id)
  }

  function clearClientSelection() {
    setForm((prev) => ({ ...prev, cliente: '', client_id: null, filial_id: null, propriedade: '' }))
    setFormFiliais([])
  }

  const months = useMemo(() => {
    const relevant = clientFilter === 'Todos' ? ops : ops.filter((op) => op.cliente === clientFilter)
    return [...new Set(relevant.map((op) => op.month_year).filter(Boolean))].sort(
      (a, b) => monthSortKey(a) - monthSortKey(b)
    )
  }, [ops, clientFilter])

  useEffect(() => {
    if (monthFilter !== 'Todos' && !months.includes(monthFilter)) setMonthFilter('Todos')
  }, [months, monthFilter])

  useEffect(() => {
    setGrouped(tab === 'Closed')
  }, [tab])

  function goToMonth(direction: 1 | -1) {
    if (months.length === 0) return
    const currentIndex = monthFilter === 'Todos' ? -1 : months.indexOf(monthFilter)
    const nextIndex =
      currentIndex === -1
        ? direction === 1
          ? 0
          : months.length - 1
        : Math.min(months.length - 1, Math.max(0, currentIndex + direction))
    setMonthFilter(months[nextIndex])
  }

  const filtered = useMemo(
    () =>
      ops.filter((op) => {
        const q = search.trim().toLowerCase()
        const matchesSearch =
          !q || [op.cliente, op.empresa, op.nota_fiscal, op.propriedade].some((field) => field.toLowerCase().includes(q))
        return (
          matchesSearch &&
          (clientFilter === 'Todos' || op.cliente === clientFilter) &&
          (monthFilter === 'Todos' || op.month_year === monthFilter) &&
          op.status_fechamento === tab
        )
      }),
    [ops, search, clientFilter, monthFilter, tab]
  )

  const kpis = useMemo(() => {
    const totalVendas = filtered.reduce((sum, op) => sum + Number(op.valor_venda), 0)
    const totalIcms = filtered.reduce((sum, op) => sum + Number(op.valor_icms), 0)
    const totalHonorarios = filtered.reduce((sum, op) => sum + Number(op.valor_honorarios), 0)
    const mediaHonorarios = filtered.length
      ? filtered.reduce((sum, op) => sum + Number(op.porcentagem_honorarios), 0) / filtered.length
      : 0
    return { totalVendas, totalIcms, totalHonorarios, mediaHonorarios, count: filtered.length }
  }, [filtered])

  const selectedClientStats = useMemo(() => {
    if (clientFilter === 'Todos') return null
    const clientOps = ops.filter((op) => op.cliente === clientFilter)
    const branches = new Set(clientOps.map((op) => op.propriedade || op.empresa).filter(Boolean))
    return {
      operations: clientOps.length,
      branches: branches.size,
      sales: clientOps.reduce((sum, op) => sum + Number(op.valor_venda), 0),
      honorarios: clientOps.reduce((sum, op) => sum + Number(op.valor_honorarios), 0),
    }
  }, [ops, clientFilter])

  const groups = useMemo(() => {
    const groupedOps: Record<string, { ops: IcmsOperation[]; venda: number; icms: number; honorarios: number }> = {}
    filtered.forEach((op) => {
      groupedOps[op.cliente] ||= { ops: [], venda: 0, icms: 0, honorarios: 0 }
      groupedOps[op.cliente].ops.push(op)
      groupedOps[op.cliente].venda += Number(op.valor_venda)
      groupedOps[op.cliente].icms += Number(op.valor_icms)
      groupedOps[op.cliente].honorarios += Number(op.valor_honorarios)
    })
    return Object.entries(groupedOps).sort((a, b) => b[1].honorarios - a[1].honorarios)
  }, [filtered])

  const canClose = tab === 'Open' && clientFilter !== 'Todos' && monthFilter !== 'Todos' && filtered.length > 0

  function toggleGroup(cliente: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(cliente)) next.delete(cliente)
      else next.add(cliente)
      return next
    })
  }

  async function closeMonth() {
    if (!canClose) {
      toast.error('Selecione um cliente e um periodo especificos.')
      return
    }

    setIsClosing(true)
    try {
      const result = await closeIcmsMonthForClient({ cliente: clientFilter, monthYear: monthFilter })
      if (!result.success) throw new Error(result.error)
      setOps((current) =>
        current.map((op) =>
          op.month_year === monthFilter && op.cliente === clientFilter ? { ...op, status_fechamento: 'Closed' } : op
        )
      )
      toast.success('Mes encerrado.', { description: `${clientFilter} - ${monthFilter}` })
      setTab('Closed')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao encerrar mes.')
    } finally {
      setIsClosing(false)
    }
  }

  function openNewOperation() {
    setEditingOperation(null)
    setForm({
      ...defaultIcmsForm,
      cliente: clientFilter !== 'Todos' ? clientFilter : defaultIcmsForm.cliente,
      month_year: monthFilter !== 'Todos' ? monthFilter : defaultIcmsForm.month_year,
    })
    setFormFiliais([])
    setModal(true)
  }

  function openEditOperation(operation: IcmsOperation) {
    setEditingOperation(operation)
    setForm({
      data_venda: operation.data_venda,
      empresa: operation.empresa || '',
      propriedade: operation.propriedade || '',
      cliente: operation.cliente || '',
      client_id: operation.client_id || null,
      filial_id: operation.filial_id || null,
      nota_fiscal: operation.nota_fiscal || '',
      valor_venda: numberToCurrencyDigits(Number(operation.valor_venda) || 0),
      valor_icms: numberToCurrencyDigits(Number(operation.valor_icms) || 0),
      pct: String(operation.porcentagem_honorarios ?? '1.5'),
      valor_honorarios: String(operation.valor_honorarios ?? ''),
      deferimento: operation.deferimento || 'Deferido',
      month_year: operation.month_year || '',
    })
    if (operation.client_id) {
      void fetchFiliaisForClient(operation.client_id)
    } else {
      setFormFiliais([])
    }
    setModal(true)
  }

  function closeModal() {
    setModal(false)
    setEditingOperation(null)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = {
        data_venda: form.data_venda,
        empresa: form.empresa || form.cliente,
        propriedade: form.propriedade,
        cliente: form.cliente,
        client_id: form.client_id,
        filial_id: form.filial_id,
        nota_fiscal: form.nota_fiscal,
        valor_venda: currencyDigitsToNumber(form.valor_venda),
        valor_icms: currencyDigitsToNumber(form.valor_icms),
        porcentagem_honorarios: Number(form.pct),
        valor_honorarios: Number(form.valor_honorarios),
        deferimento: form.deferimento,
        month_year: monthYearFromDate(form.data_venda) || form.month_year,
        status_fechamento: editingOperation?.status_fechamento || 'Open',
      }
      const result = editingOperation
        ? await updateIcmsOperation(editingOperation.id, payload)
        : await createIcmsOperation(payload)
      if (!result.success) throw new Error(result.error)
      setOps((current) => {
        if (editingOperation) {
          return current.map((operation) => operation.id === editingOperation.id ? { ...operation, ...payload } : operation)
        }
        return [{ id: result.data?.id || crypto.randomUUID(), ...payload }, ...current]
      })
      toast.success(editingOperation ? 'Lancamento atualizado.' : 'Operacao registrada.')
      closeModal()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar operacao.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteOperation(operation: IcmsOperation) {
    if (!confirm(`Excluir o lancamento ${operation.nota_fiscal} de ${operation.cliente}? Essa acao nao pode ser desfeita.`)) return
    try {
      const result = await deleteIcmsOperation(operation.id)
      if (!result.success) throw new Error(result.error)
      setOps((current) => current.filter((op) => op.id !== operation.id))
      toast.success('Lancamento excluido.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir lancamento.')
    }
  }

  const rows = (items: IcmsOperation[]) =>
    items.map((op) => (
      <tr key={op.id}>
        <td style={{ borderLeft: `3px solid ${statusAccentColor(op.deferimento)}` }}>
          <strong>{new Date(`${op.data_venda}T12:00:00`).toLocaleDateString('pt-BR')}</strong>
          <small>{op.month_year}</small>
        </td>
        <td>
          <span className="analise-client-chip">
            <Building2 size={13} aria-hidden="true" />
            {op.cliente}
          </span>
          {op.propriedade && <small>{op.propriedade}</small>}
        </td>
        <td>
          <code>{op.nota_fiscal}</code>
        </td>
        <td className="text-right">{brl(op.valor_venda)}</td>
        <td className="text-right">{brl(op.valor_icms)}</td>
        <td className="text-right analise-money">
          {brl(op.valor_honorarios)}
          <small>{op.porcentagem_honorarios}%</small>
        </td>
        <td>
          <StatusBadge value={op.deferimento} />
        </td>
        <td className="analise-row-actions">
          <button type="button" onClick={() => openEditOperation(op)} aria-label={`Editar lancamento ${op.nota_fiscal}`}>
            <Edit3 size={15} aria-hidden="true" />
            Editar
          </button>
          <button type="button" className="analise-row-delete" onClick={() => handleDeleteOperation(op)} aria-label={`Excluir lancamento ${op.nota_fiscal}`}>
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </td>
      </tr>
    ))

  return (
    <div className="analise-shell">
      <div className="analise-tabs" role="tablist" aria-label="Visao da analise de credito">
        <button type="button" role="tab" aria-selected={tab === 'Open'} onClick={() => setTab('Open')}>
          <LayoutGrid size={17} aria-hidden="true" />
          Operacoes em aberto
        </button>
        <button type="button" role="tab" aria-selected={tab === 'Closed'} onClick={() => setTab('Closed')}>
          <History size={17} aria-hidden="true" />
          Historico
        </button>
      </div>

      <section className="analise-kpi-grid">
        <MetricCard label="Operacoes" value={kpis.count} detail="registros filtrados" icon={TrendingUp} tone="info" />
        <MetricCard label="Total vendas" value={brl(kpis.totalVendas)} detail="volume movimentado" icon={DollarSign} tone="sales" />
        <MetricCard label="ICMS liberado" value={brl(kpis.totalIcms)} detail="credito transferido" icon={FileText} tone="credit" />
        <MetricCard
          label="Honorarios"
          value={brl(kpis.totalHonorarios)}
          detail={`${kpis.mediaHonorarios.toFixed(1)}% medio`}
          icon={Percent}
          tone="fees"
          accent
        />
      </section>

      {selectedClientStats && (
        <section className="glass-card analise-client-summary">
          <div className="analise-client-summary-title">
            <Building2 size={16} aria-hidden="true" />
            <strong>{clientFilter}</strong>
            <span>{monthFilter === 'Todos' ? '· todos os periodos' : `· ${monthFilter}`}</span>
          </div>
          <div className="analise-client-summary-stats">
            <span><b>{selectedClientStats.branches}</b> filiais</span>
            <span><b>{selectedClientStats.operations}</b> lançamentos</span>
            <span><b>{brl(selectedClientStats.sales)}</b> vendas</span>
            <span><b>{brl(selectedClientStats.honorarios)}</b> honorários</span>
          </div>
        </section>
      )}

      <section className="analise-toolbar" aria-label="Filtros e acoes">
        <label className="analise-search">
          <Search size={17} aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por cliente, empresa ou nota fiscal"
          />
        </label>

        <select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} aria-label="Filtrar cliente">
          <option value="Todos">Todos os clientes</option>
          {clients.map((client) => (
            <option key={client} value={client}>
              {client}
            </option>
          ))}
        </select>

        <div className="analise-month-nav" role="group" aria-label="Navegar por mes">
          <button
            type="button"
            onClick={() => goToMonth(-1)}
            disabled={months.length === 0}
            aria-label="Mes anterior"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <span>{monthFilter === 'Todos' ? 'Todo periodo' : monthFilter}</span>
          <button
            type="button"
            onClick={() => goToMonth(1)}
            disabled={months.length === 0}
            aria-label="Proximo mes"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
          {monthFilter !== 'Todos' && (
            <button type="button" onClick={() => setMonthFilter('Todos')} aria-label="Ver todo periodo">
              Todos
            </button>
          )}
        </div>

        <div className="analise-toolbar-actions">
          <button type="button" className={grouped ? 'active' : ''} onClick={() => setGrouped((value) => !value)}>
            <Layers3 size={17} aria-hidden="true" />
            Agrupar
          </button>

          <button type="button" disabled={!canClose || isClosing} onClick={closeMonth}>
            <LockKeyhole size={17} aria-hidden="true" />
            {isClosing ? 'Encerrando' : 'Encerrar mes'}
          </button>

          <button type="button" className="primary" onClick={openNewOperation}>
            <Plus size={18} aria-hidden="true" />
            Nova operacao
          </button>
        </div>
      </section>


      <section className="glass-card analise-table-card">
        <div className="analise-table-scroll">
          <table className="analise-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th>Nota fiscal</th>
                <th className="text-right">Venda</th>
                <th className="text-right">ICMS</th>
                <th className="text-right">Honorarios</th>
                <th>Status</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="analise-empty">
                    <div className="analise-empty-content">
                      <FileText size={28} aria-hidden="true" />
                      <strong>Nenhuma operacao encontrada</strong>
                      <span>Cadastre a primeira operacao real por cliente e filial.</span>
                      <button type="button" className="btn-primary" onClick={openNewOperation}>
                        <Plus size={16} aria-hidden="true" />
                        Nova operacao
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {filtered.length > 0 &&
                (grouped
                  ? groups.map(([cliente, data]) => (
                      <Fragment key={cliente}>
                        <tr className="analise-group-row" onClick={() => toggleGroup(cliente)}>
                          <td colSpan={3}>
                            <button type="button" aria-expanded={expanded.has(cliente)}>
                              <ChevronRight size={17} aria-hidden="true" />
                              <span>
                                <strong>{cliente}</strong>
                                <small>{data.ops.length} operacao{data.ops.length === 1 ? '' : 'es'}</small>
                              </span>
                            </button>
                          </td>
                          <td className="text-right">{brl(data.venda)}</td>
                          <td className="text-right">{brl(data.icms)}</td>
                          <td className="text-right analise-money">{brl(data.honorarios)}</td>
                          <td />
                          <td />
                        </tr>
                        {expanded.has(cliente) && rows(data.ops)}
                      </Fragment>
                    ))
                  : rows(filtered))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={3}>Total geral - {kpis.count} operacao{kpis.count === 1 ? '' : 'es'}</td>
                  <td className="text-right">{brl(kpis.totalVendas)}</td>
                  <td className="text-right">{brl(kpis.totalIcms)}</td>
                  <td className="text-right analise-money">{brlFull(kpis.totalHonorarios)}</td>
                  <td />
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {modal && (
        <div className="analise-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="icms-modal-title">
          <form className="analise-modal glass-card" onSubmit={handleSubmit}>
            <header>
              <div>
                <h2 id="icms-modal-title">{editingOperation ? 'Editar lancamento ICMS' : 'Nova operacao ICMS'}</h2>
                <p>Busque o cliente cadastrado e escolha a filial. Empresa, mes de fechamento e honorarios sao preenchidos automaticamente.</p>
              </div>
              <button type="button" onClick={closeModal} aria-label="Fechar modal">
                <X size={20} aria-hidden="true" />
              </button>
            </header>

            <div className="analise-form-grid">
              <label>
                Cliente
                <ClientSearchField
                  clientes={clientes}
                  selected={form.client_id ? { id: form.client_id, nome: form.cliente } : null}
                  onSelect={selectClientForForm}
                  onClear={clearClientSelection}
                  onQueryChange={(value) => setForm((prev) => ({ ...prev, cliente: value, client_id: null, filial_id: null, propriedade: '' }))}
                  initialQuery={form.cliente}
                  placeholder="Buscar cliente cadastrado"
                />
              </label>
              <label>
                Filial / propriedade
                {form.client_id && formFiliais.length > 0 ? (
                  <select
                    required
                    className={controlClass}
                    value={form.filial_id || ''}
                    onChange={(event) => {
                      const filial = formFiliais.find((item) => item.id === event.target.value)
                      setForm((prev) => ({ ...prev, filial_id: filial?.id || null, propriedade: filial?.nome || '' }))
                    }}
                  >
                    <option value="" disabled>Selecione a filial</option>
                    {formFiliais.map((filial) => (
                      <option key={filial.id} value={filial.id}>{filial.nome}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    required
                    className={controlClass}
                    value={form.propriedade}
                    onChange={(event) => setForm((prev) => ({ ...prev, propriedade: event.target.value }))}
                    placeholder={form.client_id && !formFiliaisLoading ? 'Sem filial cadastrada, digite manualmente' : undefined}
                  />
                )}
              </label>
              <label>
                Nota fiscal
                <input
                  required
                  className={controlClass}
                  value={form.nota_fiscal}
                  onChange={(event) => setForm((prev) => ({ ...prev, nota_fiscal: event.target.value }))}
                />
              </label>
              <label>
                Data da venda
                <span>
                  <Calendar size={16} aria-hidden="true" />
                  <input
                    required
                    type="date"
                    className={`${controlClass} [color-scheme:dark]`}
                    value={form.data_venda}
                    onChange={(event) => {
                      const dataVenda = event.target.value
                      setForm((prev) => ({
                        ...prev,
                        data_venda: dataVenda,
                        month_year: monthYearFromDate(dataVenda),
                      }))
                    }}
                  />
                </span>
                {form.month_year && (
                  <small className="analise-field-hint">Fechamento: {form.month_year} (automatico)</small>
                )}
              </label>
              <label>
                Valor da venda (R$)
                <input
                  required
                  type="text"
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  className={controlClass}
                  value={formatCurrencyInput(form.valor_venda)}
                  onChange={(event) => setForm((prev) => ({ ...prev, valor_venda: event.target.value.replace(/\D/g, '') }))}
                />
              </label>
              <label>
                Credito ICMS (R$)
                <input
                  required
                  type="text"
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  className={controlClass}
                  value={formatCurrencyInput(form.valor_icms)}
                  onChange={(event) => setForm((prev) => ({ ...prev, valor_icms: event.target.value.replace(/\D/g, '') }))}
                />
              </label>
              <label>
                Taxa de honorarios (%)
                <input
                  required
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  className={controlClass}
                  value={form.pct}
                  onChange={(event) => setForm((prev) => ({ ...prev, pct: event.target.value }))}
                />
              </label>
              <label>
                Deferimento
                <select className={controlClass} value={form.deferimento} onChange={(event) => setForm((prev) => ({ ...prev, deferimento: event.target.value }))}>
                  <option value="Pending">Pendente</option>
                  <option value="Deferido">Deferido</option>
                  <option value="Indeferido">Indeferido</option>
                </select>
              </label>
              <div className="analise-calculated">
                <span>Honorarios calculados (R$)</span>
                <strong>{brlFull(Number.parseFloat(form.valor_honorarios) || 0)}</strong>
              </div>
            </div>

            <footer>
              <button type="button" onClick={closeModal}>
                Cancelar
              </button>
              <button type="submit" className="primary" disabled={saving}>
                {saving ? 'Salvando...' : editingOperation ? 'Salvar alteracoes' : 'Registrar operacao'}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  )
}
