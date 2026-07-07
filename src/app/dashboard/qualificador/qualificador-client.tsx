'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  Zap, ChevronRight, RotateCcw, Send,
  TrendingUp, AlertCircle, Users, FileText,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createLead } from '@/app/actions/pipeline'

interface Product { id: string; name: string; color?: string | null }

const SEGS = [
  { id: 'rural',     icon: '🌾', label: 'RURAL',       sub: 'Produtor PF / Agro' },
  { id: 'pj',        icon: '🏢', label: 'EMPRESA PJ',   sub: 'Lucro Real / Presumido' },
  { id: 'industria', icon: '🏭', label: 'INDÚSTRIA',    sub: 'Frigorífico / Agroindustrial' },
]

const PRODUTOS_POR_SEG: Record<string, { id: string; label: string }[]> = {
  rural: [
    { id: 'cat153',          label: 'CAT 153 (Crédito Rural PF)' },
    { id: 'cat207',          label: 'CAT 207 / CAT 83 (Acumulado)' },
    { id: 'compliance_est',  label: 'Compliance Estadual' },
    { id: 'comercializacao', label: 'Comercialização ICMS' },
    { id: 'consulta_trib',   label: 'Consulta Tributária' },
    { id: 'dca',             label: 'DCA Empresas (CNPJ associado)' },
  ],
  pj: [
    { id: 'dca',             label: 'DCA / Cessão de Créditos' },
    { id: 'compliance_est',  label: 'Compliance Estadual' },
    { id: 'compliance_fed',  label: 'Compliance Federal' },
    { id: 'tese_jur',        label: 'Tese Jurídica (federal)' },
    { id: 'comercializacao', label: 'Comercialização de crédito' },
    { id: 'consulta_trib',   label: 'Consulta Tributária' },
  ],
  industria: [
    { id: 'cat207',          label: 'CAT 207 / CAT 83 (Acumulado)' },
    { id: 'comercializacao', label: 'Comercialização ICMS' },
    { id: 'dca',             label: 'DCA Empresas' },
    { id: 'compliance_est',  label: 'Compliance Estadual' },
    { id: 'tese_jur',        label: 'Tese Jurídica federal' },
    { id: 'constituicao',    label: 'Constituição de crédito' },
  ],
}

interface Opp {
  id: string; title: string; dept: string; priority: 'alta' | 'media'
  bonus: string; action: string
}

const OPPS: Record<string, Opp[]> = {
  rural: [
    { id: 'reforma_trib', title: 'Consultoria Reforma Tributária (IBS/CBS)', dept: 'Jurídico', priority: 'alta', bonus: 'R$180', action: 'Todo produtor com CNPJ é impactado pelo novo sistema a partir de 2026.' },
    { id: 'pauta_fiscal',  title: 'Pauta Fiscal / Regimes Especiais ICMS',    dept: 'Crédito Acumulado', priority: 'alta', bonus: 'R$150', action: 'Pecuaristas e exportadores com diferimento têm oportunidade imediata.' },
    { id: 'insumos',       title: 'Créditos sobre Insumos (IPVA, Frota)',     dept: 'Crédito Acumulado', priority: 'media', bonus: 'R$150', action: 'Frota e maquinário geram crédito — verificar IPVA dos últimos 5 anos.' },
    { id: 'dca',           title: 'DCA Empresas (CNPJ associado)',              dept: 'Comercial', priority: 'alta', bonus: 'R$200', action: 'Produtor com empresa associada: apresentar DCA como produto adicional.' },
  ],
  pj: [
    { id: 'exclusao_icms', title: 'Exclusão ICMS da base PIS/COFINS',         dept: 'Teses Federais',    priority: 'alta', bonus: 'R$200', action: 'Indústrias >R$5M/ano. Alto retorno, tese consolidada STJ/STF.' },
    { id: 'majoracoes',    title: 'Majorações Legais Lei 224/2025',            dept: 'Compliance Federal', priority: 'alta', bonus: 'R$180', action: 'Recuperação PIS/COFINS pagos a maior em 2025. Incluir em toda reunião.' },
    { id: 'reforma_trib',  title: 'Consultoria Reforma Tributária (IBS/CBS)',  dept: 'Jurídico', priority: 'alta', bonus: 'R$180', action: 'Todo cliente PJ precisa de planejamento para 2026+.' },
    { id: 'subvencoes',    title: 'Subvenções para Investimentos (MP 1185)',   dept: 'Teses Federais', priority: 'alta', bonus: 'R$200', action: 'Empresas Lucro Real com incentivos estaduais. Alto potencial.' },
  ],
  industria: [
    { id: 'exclusao_icms',  title: 'Exclusão ICMS da base PIS/COFINS',        dept: 'Teses Federais', priority: 'alta', bonus: 'R$200', action: 'Indústrias com alto volume de NF têm potencial de recuperação retroativa.' },
    { id: 'credito_interm', title: 'Crédito ICMS sobre Produtos Intermediários', dept: 'Teses Estaduais', priority: 'alta', bonus: 'R$150', action: 'Insumos de produção geram crédito ICMS — tese de alto valor unitário.' },
    { id: 'mandado',        title: 'Mandado de Segurança (Liberação)',         dept: 'Jurídico', priority: 'alta', bonus: 'R$200', action: 'Créditos bloqueados no SEFAZ — decisão judicial em até 360 dias.' },
    { id: 'subvencoes',     title: 'Subvenções para Investimentos',            dept: 'Teses Federais', priority: 'alta', bonus: 'R$200', action: 'Frigoríficos com incentivos estaduais têm alto potencial.' },
  ],
}

const DEPT_COLORS: Record<string, string> = {
  'Teses Federais':    '#1B3A6B',
  'Compliance Federal':'#6B3FA0',
  'Jurídico':          '#1B3A6B',
  'Crédito Acumulado': '#006D77',
  'Teses Estaduais':   '#006D77',
  'Comercial':         '#1A7A4A',
}

export default function QualificadorClient({ products }: { products: Product[] }) {
  const router   = useRouter()
  const [seg, setSeg]             = useState('')
  const [nome, setNome]           = useState('')
  const [faturamento, setFat]     = useState('')
  const [funcionarios, setFun]    = useState('')
  const [estadoFiscal, setEF]     = useState('')
  const [obs, setObs]             = useState('')
  const [marcados, setMarcados]   = useState<string[]>([])
  const [opps, setOpps]           = useState<Opp[]>([])
  const [qualified, setQualified] = useState(false)
  const [aiText, setAiText]       = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [isPending, start]        = useTransition()

  function toggleProd(id: string) {
    setMarcados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function handleSeg(s: string) {
    setSeg(s); setMarcados([]); setOpps([]); setQualified(false); setAiText('')
  }

  function qualificar() {
    if (!nome.trim()) { toast.error('Informe o nome do cliente.'); return }
    if (!seg)         { toast.error('Selecione o segmento.'); return }

    const segOpps = (OPPS[seg] || []).filter(op => !marcados.includes(op.id))
    setOpps(segOpps)
    setQualified(true)
    setAiText('')
    setTimeout(() => document.getElementById('resultado')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  async function gerarPitchIA() {
    if (!qualified) return
    setAiLoading(true)
    setAiText('')
    const segLabel: Record<string, string> = { rural:'Produtor Rural PF', pj:'Empresa PJ', industria:'Indústria/Frigorífico' }
    const fatLabel: Record<string, string> = { micro:'até R$360k', pequeno:'R$360k–R$4,8M', medio:'R$4,8M–R$30M', grande:'acima de R$30M' }
    const topOpps = opps.slice(0,3).map((o,i) => `${i+1}. ${o.title} — ${o.dept}`).join('\n')
    const produtosTexto = marcados.length > 0
      ? (PRODUTOS_POR_SEG[seg]||[]).filter(p => marcados.includes(p.id)).map(p => p.label).join(', ')
      : 'nenhum ainda'

    const message = `
/diagnostico ${nome} ${segLabel[seg]} ${fatLabel[faturamento]||'porte não informado'}

Produtos atuais: ${produtosTexto}
Situação fiscal: ${estadoFiscal || 'não informada'}
Funcionários: ${funcionarios || 'não informado'}
Contexto: ${obs || 'sem observações'}

Top oportunidades:
${topOpps}

Gere: abertura (3 linhas), diagnóstico (5 perguntas), pitch das 2 principais oportunidades (problema→solução→resultado→CTA), quebra da objeção "já tenho contador", fechamento com próximo passo.`.trim()

    try {
      const res = await fetch('/api/assistant/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history: [] }),
      })
      const data = await res.json() as { reply?: string }
      setAiText(data.reply || 'Sem resposta da IA.')
      toast.success('Pitch gerado!')
    } catch {
      toast.error('Erro ao chamar PALIN AI.')
    } finally {
      setAiLoading(false)
    }
  }

  function salvarComoLead() {
    if (!nome.trim()) return
    // Encontra o primeiro produto correspondente do CRM
    const topOpp = opps[0]
    const matchedProduct = products.find(p =>
      p.name.toLowerCase().includes(topOpp?.dept?.toLowerCase().split(' ')[0] || '')
    )
    start(async () => {
      const r = await createLead({
        name: nome,
        company: nome,
        product_id: matchedProduct?.id || products[0]?.id || '',
        consultant_id: '',
        expected_value: 0,
        stage: 'Contato Inicial',
        segmento_especifico: [
          seg, faturamento, estadoFiscal, obs,
          opps[0]?.title,
        ].filter(Boolean).join(' | '),
      })
      if (r.success) {
        toast.success('Lead criado no CRM!', { description: `${nome} adicionado ao pipeline.` })
        router.push('/dashboard/pipeline')
      } else {
        toast.error('Erro ao criar lead.')
      }
    })
  }

  const prodsSeg = PRODUTOS_POR_SEG[seg] || []
  const qtdAlta  = opps.filter(o => o.priority === 'alta').length

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gap: 20 }}>

      {/* Header */}
      <div className="page-hero">
        <div className="page-hero-badge">🎯</div>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--brand-text)', letterSpacing: '-0.02em' }}>
            Qualificador de Cliente
          </h1>
          <p style={{ color: 'var(--brand-muted)', fontSize: '0.84rem', marginTop: 4 }}>
            Diagnóstico de perfil · Cross-sell inteligente · Pitch com PALIN AI
          </p>
        </div>
      </div>

      {/* Card de dados */}
      <div className="glass-card" style={{ padding: '20px 24px', display: 'grid', gap: 20 }}>

        {/* Linha 1 — nome + faturamento */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
              Nome / Razão Social
            </label>
            <input
              className="input-field"
              type="text"
              placeholder="Ex: João Silva Agropecuária Ltda"
              value={nome}
              onChange={e => setNome(e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
              Faturamento Anual
            </label>
            <select className="input-field" value={faturamento} onChange={e => setFat(e.target.value)}>
              <option value="">Selecione o porte</option>
              <option value="micro">Até R$ 360k (MEI/Micro)</option>
              <option value="pequeno">R$ 360k – R$ 4,8M (Pequeno)</option>
              <option value="medio">R$ 4,8M – R$ 30M (Médio)</option>
              <option value="grande">Acima de R$ 30M (Grande)</option>
            </select>
          </div>
        </div>

        {/* Linha 2 — situação fiscal + funcionários */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
              Situação Fiscal
            </label>
            <select className="input-field" value={estadoFiscal} onChange={e => setEF(e.target.value)}>
              <option value="">Selecione</option>
              <option value="regular">Regular (sem pendências)</option>
              <option value="debitos">Com débitos em aberto</option>
              <option value="autuado">Autuado / Em fiscalização</option>
              <option value="desconhecido">Desconhecida</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
              Funcionários
            </label>
            <select className="input-field" value={funcionarios} onChange={e => setFun(e.target.value)}>
              <option value="">Selecione</option>
              <option value="zero">Produtor individual / Sem CLT</option>
              <option value="ate10">1 – 10 funcionários</option>
              <option value="ate50">11 – 50 funcionários</option>
              <option value="acima50">Acima de 50 funcionários</option>
            </select>
          </div>
        </div>

        {/* Segmento */}
        <div>
          <label style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 10 }}>
            Segmento Principal
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {SEGS.map(s => (
              <button
                key={s.id}
                onClick={() => handleSeg(s.id)}
                style={{
                  border: `1.5px solid ${seg === s.id ? 'var(--brand-primary)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: 12, padding: '14px 8px', textAlign: 'center',
                  cursor: 'pointer',
                  background: seg === s.id ? 'rgba(251,191,36,0.08)' : 'rgba(22,27,34,0.8)',
                  boxShadow: seg === s.id ? '0 0 16px rgba(251,191,36,0.15)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontSize: '0.7rem', fontWeight: 900, color: seg === s.id ? 'var(--brand-primary)' : 'var(--brand-text)', letterSpacing: '0.05em' }}>{s.label}</div>
                <div style={{ fontSize: '0.58rem', color: 'var(--brand-muted)', marginTop: 3 }}>{s.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Produtos já contratados */}
        {prodsSeg.length > 0 && (
          <div>
            <label style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 10 }}>
              Produtos que o Cliente Já Tem — marque todos
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {prodsSeg.map(p => {
                const checked = marcados.includes(p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => toggleProd(p.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '9px 12px',
                      border: `1.5px solid ${checked ? 'var(--teal-color,#14b8a6)' : 'rgba(255,255,255,0.07)'}`,
                      borderRadius: 8, cursor: 'pointer',
                      background: checked ? 'rgba(20,184,166,0.08)' : 'rgba(22,27,34,0.6)',
                      color: checked ? 'var(--brand-text)' : 'var(--brand-muted)',
                      fontSize: '0.78rem', textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{
                      width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                      border: `1.5px solid ${checked ? '#14b8a6' : 'rgba(255,255,255,0.15)'}`,
                      background: checked ? '#14b8a6' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: '#fff',
                    }}>
                      {checked && '✓'}
                    </div>
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Observações */}
        <div>
          <label style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
            Contexto Adicional
          </label>
          <textarea
            className="input-field"
            rows={2}
            placeholder="Dívida no SEFAZ, exporta, tem frota, recebeu notificação..."
            value={obs}
            onChange={e => setObs(e.target.value)}
          />
        </div>

        {/* Botão qualificar */}
        <button
          className="btn-primary"
          onClick={qualificar}
          style={{ padding: '14px 20px', fontSize: '0.92rem', letterSpacing: '0.06em', justifyContent: 'center' }}
        >
          <Zap size={18} /> Qualificar e Ver Oportunidades
        </button>
      </div>

      {/* Resultado */}
      {qualified && (
        <div id="resultado" style={{ display: 'grid', gap: 16 }}>

          {/* Stats */}
          <div className="glass-card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--brand-text)' }}>
                📊 {nome}
              </h2>
              <span style={{
                fontSize: '0.72rem', fontWeight: 900, padding: '5px 14px',
                borderRadius: 999,
                background: opps.length >= 5 ? 'rgba(239,68,68,0.1)' : 'rgba(251,191,36,0.1)',
                border: `1px solid ${opps.length >= 5 ? 'rgba(239,68,68,0.3)' : 'rgba(251,191,36,0.25)'}`,
                color: opps.length >= 5 ? '#ef4444' : 'var(--brand-primary)',
              }}>
                {opps.length} oportunidades
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { icon: <TrendingUp size={14} />, val: opps.length, label: 'Total', color: 'var(--brand-primary)' },
                { icon: <AlertCircle size={14} />, val: qtdAlta, label: 'Alta Prioridade', color: '#ef4444' },
                { icon: <Users size={14} />, val: marcados.length, label: 'Já tem', color: '#14b8a6' },
                { icon: <FileText size={14} />, val: seg.toUpperCase(), label: 'Segmento', color: '#94a3b8' },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: 'center', padding: '12px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ color: s.color, marginBottom: 4, display: 'flex', justifyContent: 'center' }}>{s.icon}</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: '0.55rem', color: 'var(--brand-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 3 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Oportunidades */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {opps.map((op, i) => {
              const cor = DEPT_COLORS[op.dept] || '#1B3A6B'
              return (
                <div key={op.id} style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ padding: '10px 14px', background: cor, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 900, color: '#fff', flexShrink: 0 }}>
                      {String(i+1).padStart(2,'0')}
                    </div>
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>{op.title}</span>
                  </div>
                  <div style={{ padding: '10px 14px', background: 'rgba(22,27,34,0.9)' }}>
                    <div style={{ fontSize: '0.58rem', color: 'var(--brand-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{op.dept}</div>
                    <div style={{ fontSize: '0.76rem', color: '#c9d1d9', marginBottom: 6, lineHeight: 1.5 }}>{op.action}</div>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: 'rgba(251,191,36,0.1)', color: 'var(--brand-primary)' }}>
                      Bônus: {op.bonus}
                    </span>
                    <span style={{ marginLeft: 6, fontSize: '0.62rem', fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: op.priority === 'alta' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', color: op.priority === 'alta' ? '#ef4444' : '#f59e0b' }}>
                      {op.priority === 'alta' ? '🔴 Alta' : '🟡 Média'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* PALIN AI + Salvar como Lead */}
          <div className="glass-card" style={{ padding: '20px 24px', display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>PALIN AI</div>
                <p style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--brand-text)' }}>Gerar Pitch Personalizado</p>
                <p style={{ fontSize: '0.74rem', color: 'var(--brand-muted)', marginTop: 2 }}>Script completo de abordagem para {nome}</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn-primary"
                  onClick={gerarPitchIA}
                  disabled={aiLoading}
                  style={{ padding: '10px 18px', fontSize: '0.82rem' }}
                >
                  {aiLoading ? <RotateCcw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={14} />}
                  {aiLoading ? 'Gerando...' : 'Gerar Pitch IA'}
                </button>
                <button
                  className="btn-primary"
                  onClick={salvarComoLead}
                  disabled={isPending}
                  style={{ padding: '10px 18px', fontSize: '0.82rem', background: 'linear-gradient(135deg,#059669,#10b981)' }}
                >
                  <Send size={14} /> Salvar Lead no CRM
                </button>
              </div>
            </div>

            {/* Resultado IA */}
            {aiLoading && (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--brand-muted)', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-primary)', animation: `bounce 1.4s infinite ${i*0.2}s` }} />
                  ))}
                </div>
                PALIN AI analisando o perfil de <strong style={{ color: 'var(--brand-text)' }}>{nome}</strong>...
              </div>
            )}

            {aiText && (
              <div style={{
                background: '#050c1a', border: '1px solid rgba(251,191,36,0.15)',
                borderRadius: 12, padding: '16px 18px',
                fontSize: '0.82rem', color: '#a5c8f0', lineHeight: 1.75,
                fontFamily: 'inherit', whiteSpace: 'pre-wrap',
                maxHeight: 420, overflowY: 'auto',
              }}>
                {aiText}
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button
                    className="btn-ghost"
                    onClick={() => { navigator.clipboard.writeText(aiText); toast.success('Copiado!') }}
                    style={{ padding: '8px 16px', fontSize: '0.75rem' }}
                  >
                    📋 Copiar
                  </button>
                  {opps[0]?.title && (
                    <a
                      href={`https://wa.me/5517?text=${encodeURIComponent(`Olá! Identificamos uma oportunidade de ${opps[0].title} para a ${nome}. Posso agendar um diagnóstico gratuito?`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)', color: '#25d366', fontSize: '0.75rem', fontWeight: 700, textDecoration: 'none' }}
                    >
                      <ChevronRight size={13} /> Abrir WhatsApp
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin   { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes bounce { 0%,80%,100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }
        select.input-field { appearance: none; }
        textarea.input-field { resize: vertical; }
      `}</style>
    </div>
  )
}
