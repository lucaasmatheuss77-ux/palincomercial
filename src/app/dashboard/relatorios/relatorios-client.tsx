'use client'

import { useMemo, useState } from 'react'
import { ArrowUpRight, Calendar, Download, FileText, LineChart as LineChartIcon, Printer } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import DownloadActionButton from '@/components/download-action-button'

export type MonthlyDataPoint = {
  mes: string
  contratos: number
  receita: number
  taxa: number
}

type Props = {
  allMonthlyData: MonthlyDataPoint[]
  teamExport: string
  productsExport: string
  commissionsExport: string
  totalLeads: number
  totalClosed: number
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)
}

export default function RelatoriosClient({
  allMonthlyData,
  teamExport,
  productsExport,
  commissionsExport,
  totalLeads,
  totalClosed,
}: Props) {
  const [period, setPeriod] = useState<'3m' | '6m'>('6m')

  const monthlyData = useMemo(
    () => (period === '3m' ? allMonthlyData.slice(-3) : allMonthlyData),
    [period, allMonthlyData],
  )

  const summary = useMemo(() => {
    const contratos = monthlyData.reduce((sum, item) => sum + item.contratos, 0)
    const receita = monthlyData.reduce((sum, item) => sum + item.receita, 0)
    const ticket = contratos > 0 ? receita / contratos : 0
    const taxaMedia =
      monthlyData.length > 0
        ? monthlyData.reduce((sum, item) => sum + item.taxa, 0) / monthlyData.length
        : 0
    const topMonth = [...monthlyData].sort((a, b) => b.receita - a.receita)[0] ?? null

    // Compare current window revenue with the previous equal-size window
    const windowSize = period === '3m' ? 3 : 6
    const previous = allMonthlyData.slice(0, allMonthlyData.length - windowSize)
    const previousRevenue = previous.slice(-windowSize).reduce((sum, item) => sum + item.receita, 0)
    const revenueTrend =
      previousRevenue > 0 ? Math.round(((receita - previousRevenue) / previousRevenue) * 100) : 0

    return { contratos, receita, ticket, taxaMedia, topMonth, revenueTrend }
  }, [allMonthlyData, monthlyData, period])

  const exportContent = useMemo(() => {
    const lines = [
      `Periodo: ${period === '3m' ? 'Ultimos 3 meses' : 'Ultimos 6 meses'}`,
      `Contratos: ${summary.contratos}`,
      `Receita total: ${summary.receita}`,
      `Ticket medio: ${summary.ticket.toFixed(2)}`,
      `Taxa media de conversao: ${summary.taxaMedia.toFixed(1)}%`,
      `Total de leads no sistema: ${totalLeads}`,
      `Total de contratos fechados (historico): ${totalClosed}`,
      '',
      'Mes;Contratos;Receita;Taxa de Conversao',
      ...monthlyData.map((item) => `${item.mes};${item.contratos};${item.receita};${item.taxa}%`),
    ]
    return lines.join('\n')
  }, [monthlyData, period, summary, totalClosed, totalLeads])

  function handlePrint() {
    window.print()
    toast.success('Janela de impressao aberta.')
  }

  const reportCards = [
    {
      title: 'Relatorio de Equipe',
      desc: 'Performance individual por consultor e SDR',
      content: teamExport,
      fileName: 'relatorio-equipe.csv',
    },
    {
      title: 'Relatorio de Produtos',
      desc: 'Conversao e receita por produto',
      content: productsExport,
      fileName: 'relatorio-produtos.csv',
    },
    {
      title: 'Relatorio de Comissoes',
      desc: 'Extrato completo de comissoes pagas e pendentes',
      content: commissionsExport,
      fileName: 'relatorio-comissoes.csv',
    },
  ]

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--brand-text)', letterSpacing: '-0.02em' }}>Relatorios</h1>
          <p style={{ color: 'var(--brand-muted)', fontSize: '0.84rem', marginTop: '4px' }}>
            {totalLeads} leads · {totalClosed} fechados · {period === '6m' ? 'ultimos 6 meses' : 'ultimos 3 meses'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" className="btn-ghost" onClick={() => setPeriod((c) => (c === '6m' ? '3m' : '6m'))}>
            <Calendar size={15} aria-hidden="true" />
            {period === '6m' ? 'Ver 3 meses' : 'Ver 6 meses'}
          </button>
          <button type="button" className="btn-ghost" onClick={handlePrint}>
            <Printer size={15} aria-hidden="true" />
            Imprimir
          </button>
          <DownloadActionButton
            className="btn-primary"
            fileName={`relatorio-${period}.csv`}
            content={exportContent}
            successMessage="Relatorio exportado."
          >
            <Download size={15} aria-hidden="true" />
            Exportar
          </DownloadActionButton>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        {[
          {
            label: 'Receita',
            value: formatCurrency(summary.receita),
            note: summary.revenueTrend !== 0
              ? `${summary.revenueTrend >= 0 ? '+' : ''}${summary.revenueTrend}% vs anterior`
              : 'sem periodo anterior',
            color: summary.revenueTrend >= 0 ? '#10b981' : '#ef4444',
          },
          { label: 'Contratos', value: String(summary.contratos), note: 'no periodo', color: 'var(--brand-text)' },
          { label: 'Ticket medio', value: formatCurrency(summary.ticket), note: 'por fechamento', color: 'var(--brand-text)' },
          { label: 'Conversao media', value: `${summary.taxaMedia.toFixed(1)}%`, note: 'fechado / (fechado+perdido)', color: 'var(--brand-text)' },
          {
            label: 'Mes mais forte',
            value: summary.topMonth?.mes || '—',
            note: summary.topMonth ? formatCurrency(summary.topMonth.receita) : 'sem dados',
            color: 'var(--brand-primary)',
          },
        ].map(({ label, value, note, color }) => (
          <div key={label} className="kpi-card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.66rem', color: 'var(--brand-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
            <div style={{ marginTop: '8px', fontSize: '1.1rem', fontWeight: 900, color }}>{value}</div>
            <div style={{ marginTop: '4px', fontSize: '0.72rem', color: '#64748b' }}>{note}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <section className="reports-charts-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1fr)', gap: '18px' }}>
        <div className="glass-card" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '18px' }}>
            <div>
              <h3 style={{ fontWeight: 800, fontSize: '0.95rem', color: '#f8fafc' }}>Receita e contratos</h3>
              <p style={{ color: 'var(--brand-muted)', fontSize: '0.78rem', marginTop: '4px' }}>Comparativo mensal de leads fechados.</p>
            </div>
            <span className="badge badge-blue">Dados reais</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="reportsRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.26} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: 'var(--brand-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--brand-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip
                contentStyle={{ background: '#0d1117', border: '1px solid rgba(56,189,248,0.24)', borderRadius: '10px', color: '#f8fafc' }}
                formatter={(value: number, name: string) => [
                  name === 'receita' ? formatCurrency(value) : value,
                  name === 'receita' ? 'Receita' : 'Contratos',
                ]}
              />
              <Area type="monotone" dataKey="receita" stroke="#38bdf8" fill="url(#reportsRevenue)" strokeWidth={3} name="receita" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '18px' }}>
            <div>
              <h3 style={{ fontWeight: 800, fontSize: '0.95rem', color: '#f8fafc' }}>Conversao e ritmo</h3>
              <p style={{ color: 'var(--brand-muted)', fontSize: '0.78rem', marginTop: '4px' }}>Fechados vs. perdidos por mes de abertura do lead.</p>
            </div>
            <span className="badge badge-gold">Qualidade</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: 'var(--brand-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--brand-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{ background: '#0d1117', border: '1px solid rgba(251,191,36,0.24)', borderRadius: '10px', color: '#f8fafc' }}
                formatter={(value: number) => [`${value}%`, 'Conversao']}
              />
              <Line type="monotone" dataKey="taxa" stroke="#f59e0b" strokeWidth={3} dot={{ fill: '#f59e0b', r: 4 }} name="taxa" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Contracts bar chart */}
      <div className="glass-card" style={{ padding: '22px' }}>
        <div style={{ marginBottom: '18px' }}>
          <h3 style={{ fontWeight: 800, fontSize: '0.95rem', color: '#f8fafc' }}>Contratos por mes</h3>
          <p style={{ color: 'var(--brand-muted)', fontSize: '0.78rem', marginTop: '4px' }}>Volume de leads fechados no periodo.</p>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={monthlyData} barSize={28}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
            <XAxis dataKey="mes" tick={{ fill: 'var(--brand-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--brand-muted)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#0d1117', border: '1px solid rgba(34,197,94,0.24)', borderRadius: '10px', color: '#f8fafc' }}
              formatter={(value: number) => [value, 'Contratos']}
            />
            <Bar dataKey="contratos" fill="#22c55e" radius={[6, 6, 0, 0]} name="contratos" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Report download cards */}
      <section className="glass-card" style={{ padding: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontWeight: 800, fontSize: '0.95rem', color: '#f8fafc' }}>Relatorios por frente</h3>
            <p style={{ color: 'var(--brand-muted)', fontSize: '0.78rem', marginTop: '4px' }}>Downloads com dados reais para uso gerencial.</p>
          </div>
          <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.08)' }}>
            {reportCards.length} relatorios
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          {reportCards.map((report, index) => (
            <div key={report.title} className="kpi-card" style={{ minHeight: '170px', display: 'grid', alignContent: 'space-between', gap: '16px' }}>
              <div>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '14px', marginBottom: '12px',
                  background: index % 2 === 0 ? 'rgba(56,189,248,0.14)' : 'rgba(245,158,11,0.14)',
                  color: index % 2 === 0 ? '#38bdf8' : '#f59e0b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {index % 2 === 0 ? <LineChartIcon size={18} /> : <FileText size={18} />}
                </div>
                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#f8fafc', marginBottom: '6px' }}>{report.title}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--brand-muted)', lineHeight: 1.55 }}>{report.desc}</div>
              </div>
              <DownloadActionButton
                className="btn-ghost"
                style={{ width: '100%', justifyContent: 'center', fontSize: '0.76rem' }}
                fileName={report.fileName}
                content={report.content}
                successMessage={`${report.title} exportado.`}
              >
                <ArrowUpRight size={14} />
                Gerar relatorio
              </DownloadActionButton>
            </div>
          ))}
        </div>
      </section>

      <style>{`
        @media (max-width: 1080px) {
          .reports-charts-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
