'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Settings } from 'lucide-react'
import { toast } from 'sonner'
import ActionDialog from '@/components/action-dialog'
import { createCommissionRule, updateCommissionRule, deleteCommissionRule } from '@/app/actions/commissions'

export type RuleType = {
  id: string
  produto: string
  product_id: string
  base: string
  base_rate: number
  base_fixed: number
  recurrent_rate: number
  sdr_rate: number
  notes: string
}

type Option = { id: string; name: string }

const emptyDraft = {
  product_id: '',
  tipo_base: 'percentual' as 'percentual' | 'fixo',
  base_value: '',
  recurrent_rate: '',
  sdr_rate: '',
  notes: '',
}

export default function CommissionRulesManager({
  initialRules,
  products,
}: {
  initialRules: RuleType[]
  products: Option[]
}) {
  const [rules, setRules] = useState<RuleType[]>(initialRules)
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [editingRule, setEditingRule] = useState<RuleType | null>(null)
  const [draft, setDraft] = useState({ ...emptyDraft })

  function openCreate() {
    setDraft({ ...emptyDraft })
    setShowCreate(true)
  }

  function openEdit(rule: RuleType) {
    setEditingRule(rule)
    setDraft({
      product_id: rule.product_id,
      tipo_base: rule.base_fixed > 0 ? 'fixo' : 'percentual',
      base_value: rule.base_fixed > 0 ? String(rule.base_fixed) : String(rule.base_rate * 100),
      recurrent_rate: rule.recurrent_rate > 0 ? String(rule.recurrent_rate * 100) : '',
      sdr_rate: rule.sdr_rate > 0 ? String(rule.sdr_rate * 100) : '',
      notes: rule.notes,
    })
    setShowEdit(true)
  }

  async function handleCreate() {
    if (!draft.product_id) {
      toast.error('Selecione um produto para a regra.')
      return
    }
    if (!draft.base_value) {
      toast.error('Informe o valor da comissão base.')
      return
    }

    const base_rate = draft.tipo_base === 'percentual' ? Number(draft.base_value) / 100 : 0
    const base_fixed = draft.tipo_base === 'fixo' ? Number(draft.base_value) : 0

    const result = await createCommissionRule({
      product_id: draft.product_id,
      base_rate,
      base_fixed,
      recurrent_rate: draft.recurrent_rate ? Number(draft.recurrent_rate) / 100 : 0,
      sdr_rate: draft.sdr_rate ? Number(draft.sdr_rate) / 100 : 0,
      notes: draft.notes,
    })

    if (!result.success) {
      toast.error('Erro ao criar regra', { description: result.error })
      return
    }

    const product = products.find((p) => p.id === draft.product_id)
    const baseDisplay = draft.tipo_base === 'fixo' ? `R$ ${Number(draft.base_value).toFixed(2)}` : `${draft.base_value}%`

    const newRule: RuleType = {
      id: `temp-${Date.now()}`,
      produto: product?.name || 'Produto',
      product_id: draft.product_id,
      base: baseDisplay,
      base_rate,
      base_fixed,
      recurrent_rate: draft.recurrent_rate ? Number(draft.recurrent_rate) / 100 : 0,
      sdr_rate: draft.sdr_rate ? Number(draft.sdr_rate) / 100 : 0,
      notes: draft.notes,
    }

    setRules((current) => [...current, newRule])
    setShowCreate(false)
    toast.success('Regra de comissão criada.')
  }

  async function handleEdit() {
    if (!editingRule) return

    const base_rate = draft.tipo_base === 'percentual' ? Number(draft.base_value) / 100 : 0
    const base_fixed = draft.tipo_base === 'fixo' ? Number(draft.base_value) : 0

    const result = await updateCommissionRule(editingRule.id, {
      product_id: draft.product_id,
      base_rate,
      base_fixed,
      recurrent_rate: draft.recurrent_rate ? Number(draft.recurrent_rate) / 100 : 0,
      sdr_rate: draft.sdr_rate ? Number(draft.sdr_rate) / 100 : 0,
      notes: draft.notes,
    })

    if (!result.success) {
      toast.error('Erro ao atualizar regra', { description: result.error })
      return
    }

    const product = products.find((p) => p.id === draft.product_id)
    const baseDisplay = draft.tipo_base === 'fixo' ? `R$ ${Number(draft.base_value).toFixed(2)}` : `${draft.base_value}%`

    setRules((current) =>
      current.map((r) =>
        r.id === editingRule.id
          ? { ...r, produto: product?.name || r.produto, product_id: draft.product_id, base: baseDisplay, base_rate, base_fixed, recurrent_rate: draft.recurrent_rate ? Number(draft.recurrent_rate) / 100 : 0, sdr_rate: draft.sdr_rate ? Number(draft.sdr_rate) / 100 : 0, notes: draft.notes }
          : r
      )
    )
    setShowEdit(false)
    setEditingRule(null)
    toast.success('Regra atualizada com sucesso.')
  }

  async function handleDelete(rule: RuleType) {
    const result = await deleteCommissionRule(rule.id)
    if (!result.success) {
      toast.error('Erro ao remover regra', { description: result.error })
      return
    }
    setRules((current) => current.filter((r) => r.id !== rule.id))
    toast.success(`Regra de ${rule.produto} removida.`)
  }

  const ruleForm = (
    <div style={{ display: 'grid', gap: '14px' }}>
      <div>
        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--brand-primary)', marginBottom: '6px', textTransform: 'uppercase' }}>Produto *</label>
        <select
          className="input-field"
          value={draft.product_id}
          onChange={(e) => setDraft((c) => ({ ...c, product_id: e.target.value }))}
          style={{ background: 'var(--brand-surface)', color: draft.product_id ? '#e2e8f0' : '#64748b' }}
        >
          <option value="">Selecionar produto</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--brand-primary)', marginBottom: '6px', textTransform: 'uppercase' }}>Tipo de comissão base</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          {(['percentual', 'fixo'] as const).map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => setDraft((c) => ({ ...c, tipo_base: tipo }))}
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: `1px solid ${draft.tipo_base === tipo ? 'rgba(251,191,36,0.5)' : 'rgba(255,255,255,0.06)'}`,
                background: draft.tipo_base === tipo ? 'rgba(251,191,36,0.12)' : 'transparent',
                color: draft.tipo_base === tipo ? 'var(--brand-primary)' : '#64748b',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {tipo === 'percentual' ? '% Percentual' : 'R$ Fixo'}
            </button>
          ))}
        </div>
        <input
          className="input-field"
          type="number"
          placeholder={draft.tipo_base === 'percentual' ? 'Ex: 10 (para 10%)' : 'Ex: 500 (para R$ 500)'}
          value={draft.base_value}
          onChange={(e) => setDraft((c) => ({ ...c, base_value: e.target.value }))}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>Taxa Recorrência (%)</label>
          <input className="input-field" type="number" placeholder="Ex: 5" value={draft.recurrent_rate} onChange={(e) => setDraft((c) => ({ ...c, recurrent_rate: e.target.value }))} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>Taxa SDR (%)</label>
          <input className="input-field" type="number" placeholder="Ex: 3" value={draft.sdr_rate} onChange={(e) => setDraft((c) => ({ ...c, sdr_rate: e.target.value }))} />
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>Observações / Bônus</label>
        <textarea
          className="input-field"
          placeholder="Ex: Bônus de R$ 200 para contratos acima de R$ 10k"
          value={draft.notes}
          onChange={(e) => setDraft((c) => ({ ...c, notes: e.target.value }))}
          rows={3}
          style={{ resize: 'vertical' }}
        />
      </div>
    </div>
  )

  return (
    <>
      <div className="glass-card" style={{ marginBottom: '24px', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(30,58,95,0.5)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings size={16} color="#f59e0b" />
          <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: '#e2e8f0' }}>Regras ativas</h3>
          <span className="badge badge-green" style={{ marginLeft: 'auto' }}>Sincronizado</span>
          <button type="button" className="btn-primary" onClick={openCreate} style={{ padding: '6px 14px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={14} />
            Nova regra
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(30,58,95,0.5)' }}>
                {['Produto', 'Comissão Base', 'Recorrência', 'Taxa SDR', 'Observações', ''].map((header) => (
                  <th key={header} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} style={{ borderBottom: '1px solid rgba(30,58,95,0.2)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '0.82rem', color: '#e2e8f0' }}>{rule.produto}</td>
                  <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#10b981' }}>{rule.base}</td>
                  <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#3b82f6' }}>{rule.recurrent_rate > 0 ? `${(rule.recurrent_rate * 100).toFixed(1)}%` : 'N/A'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#94a3b8' }}>{rule.sdr_rate > 0 ? `${(rule.sdr_rate * 100).toFixed(1)}%` : 'N/A'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#f59e0b' }}>{rule.notes || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button type="button" onClick={() => openEdit(rule)} style={{ background: 'rgba(251,191,36,0.1)', border: 'none', borderRadius: '6px', padding: '5px', cursor: 'pointer', color: '#f59e0b', display: 'flex' }}>
                        <Pencil size={13} />
                      </button>
                      <button type="button" onClick={() => handleDelete(rule)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '6px', padding: '5px', cursor: 'pointer', color: '#ef4444', display: 'flex' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>
                    Nenhuma regra configurada. Clique em &quot;Nova regra&quot; para adicionar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ActionDialog
        open={showCreate}
        title="Nova regra de comissão"
        subtitle="Define como o comissionamento é calculado por produto."
        onClose={() => setShowCreate(false)}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Cancelar</button>
            <button type="button" className="btn-primary" onClick={handleCreate}>Criar regra</button>
          </>
        }
      >
        {ruleForm}
      </ActionDialog>

      <ActionDialog
        open={showEdit}
        title="Editar regra de comissão"
        subtitle={editingRule?.produto || ''}
        onClose={() => { setShowEdit(false); setEditingRule(null) }}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => { setShowEdit(false); setEditingRule(null) }}>Cancelar</button>
            <button type="button" className="btn-primary" onClick={handleEdit}>Salvar alterações</button>
          </>
        }
      >
        {ruleForm}
      </ActionDialog>
    </>
  )
}
