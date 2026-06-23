'use client'

import { useState } from 'react'
import { 
  Package, Plus, Trash2, DollarSign, Tags,
  FileText, Zap, Shield, Search, RefreshCw,
  Tractor, Briefcase, Landmark, Handshake, Calculator
} from 'lucide-react'
import { toast } from 'sonner'
import ActionDialog from '@/components/action-dialog'
import InsiderLogo from '@/components/insider-logo'

type ProductCost = {
  id: string
  cost_type: string
  amount: number
  notes: string
  created_at: string
}

type Product = {
  id: string
  name: string
  slug: string
  emoji: string
  color: string
  description: string
  category: string
  active: boolean
}

const CATEGORIES = [
  'Compliance',
  'Consultoria',
  'Educacional',
  'Fiscal & Tributário',
  'ICMS',
  'ICMS & Créditos',
  'Jurídico',
  'NR1',
  'Parceria',
  'Produtor Rural (PF)',
  'Tributário',
  'Tributos Federais',
]

const COST_TYPES = ['Operacional', 'Captação', 'Fixo', 'Variável', 'Outro']

function getProductIcon(name: string) {
  const n = name.toLowerCase()
  if (n.includes('icms') || n.includes('pis') || n.includes('cat 83')) return Calculator
  if (n.includes('rural')) return Tractor
  if (n.includes('compliance')) return Shield
  if (n.includes('consulta') || n.includes('análise')) return Search
  if (n.includes('transferência') || n.includes('cessão')) return RefreshCw
  if (n.includes('crédito') || n.includes('credito')) return Landmark
  if (n.includes('parceria')) return Handshake
  if (n.includes('intermediação')) return Briefcase
  return Package
}

function getProductColor(name: string) {
  const n = name.toLowerCase()
  if (n.includes('icms')) return '#38bdf8'
  if (n.includes('pis') || n.includes('cat 83')) return '#fb7185'
  if (n.includes('rural')) return '#10b981'
  if (n.includes('compliance')) return '#f59e0b'
  if (n.includes('consulta') || n.includes('análise')) return '#a855f7'
  if (n.includes('transferência') || n.includes('cessão')) return '#6366f1'
  if (n.includes('crédito') || n.includes('credito')) return '#2dd4bf'
  if (n.includes('parceria')) return '#f43f5e'
  if (n.includes('intermediação')) return '#8b5cf6'
  return '#adbac7'
}

export default function ProdutosClient({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState(initialProducts)
  const [showNewProduct, setShowNewProduct] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [costsProduct, setCostsProduct] = useState<Product | null>(null)
  const [costs, setCosts] = useState<ProductCost[]>([])
  const [loadingCosts, setLoadingCosts] = useState(false)
  const [draft, setDraft] = useState({ name: '', desc: '', category: 'Tributário' })
  const [costDraft, setCostDraft] = useState({ cost_type: 'Operacional', amount: '', notes: '' })
  const [savingCost, setSavingCost] = useState(false)

  async function handleCreateProduct() {
    if (!draft.name.trim() || !draft.desc.trim()) {
      toast.error('Informe nome e descrição.')
      return
    }

    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: draft.name.trim(),
        description: draft.desc.trim(),
        category: draft.category,
      }),
    })

    if (res.ok) {
      const created = await res.json()
      setProducts((prev) => [
        {
          id: created.id,
          name: draft.name.trim(),
          slug: '',
          emoji: '📦',
          color: '#58a6ff',
          description: draft.desc.trim(),
          category: draft.category,
          active: true,
        },
        ...prev,
      ])
      toast.success('Produto criado com sucesso.')
      setDraft({ name: '', desc: '', category: 'Tributário' })
      setShowNewProduct(false)
    } else {
      toast.error('Erro ao criar produto.')
    }
  }

  async function handleUpdateProduct() {
    if (!editingProduct || !draft.name.trim() || !draft.desc.trim()) {
      toast.error('Informe nome e descrição.')
      return
    }

    const res = await fetch(`/api/products/${editingProduct.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: draft.name.trim(),
        description: draft.desc.trim(),
        category: draft.category,
      }),
    })

    if (res.ok) {
      const updated = await res.json()
      setProducts((prev) => prev.map((p) => p.id === updated.id ? { ...p, ...updated, description: draft.desc.trim() } : p))
      toast.success('Produto atualizado com sucesso.')
      setEditingProduct(null)
      setDraft({ name: '', desc: '', category: 'Tributário' })
    } else {
      toast.error('Erro ao atualizar produto.')
    }
  }

  function openEdit(product: Product) {
    setEditingProduct(product)
    setDraft({
      name: product.name,
      desc: product.description,
      category: product.category,
    })
  }

  async function handleDeleteProduct() {
    if (!confirmDelete) return

    const res = await fetch(`/api/products/${confirmDelete.id}`, { method: 'DELETE' })

    if (res.ok) {
      setProducts((prev) => prev.filter((p) => p.id !== confirmDelete.id))
      toast.success(`"${confirmDelete.name}" removido.`)
      setConfirmDelete(null)
    } else {
      toast.error('Erro ao excluir produto.')
    }
  }

  async function openCosts(product: Product) {
    setCostsProduct(product)
    setLoadingCosts(true)
    try {
      const res = await fetch(`/api/products/${product.id}/costs`)
      if (res.ok) {
        const data = await res.json()
        setCosts(data)
      }
    } finally {
      setLoadingCosts(false)
    }
  }

  async function handleAddCost() {
    if (!costsProduct || !costDraft.amount) {
      toast.error('Informe o valor do custo.')
      return
    }

    setSavingCost(true)
    try {
      const res = await fetch(`/api/products/${costsProduct.id}/costs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cost_type: costDraft.cost_type,
          amount: Number(costDraft.amount),
          notes: costDraft.notes,
        }),
      })

      if (res.ok) {
        const newCost = await res.json()
        setCosts((prev) => [newCost, ...prev])
        setCostDraft({ cost_type: 'Operacional', amount: '', notes: '' })
        toast.success('Custo registrado.')
      } else {
        toast.error('Erro ao registrar custo.')
      }
    } finally {
      setSavingCost(false)
    }
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value)
  }

  // Group products by category
  const byCategory = products.reduce<Record<string, Product[]>>((acc, p) => {
    const cat = p.category || 'Sem categoria'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(p)
    return acc
  }, {})

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--brand-text)', letterSpacing: '-0.02em' }}>Produtos</h1>
          <p style={{ color: 'var(--brand-muted)', fontSize: '0.84rem', marginTop: '4px' }}>
            {products.length} {products.length === 1 ? 'produto' : 'produtos'} · {Object.keys(byCategory).length} categorias
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setShowNewProduct(true)}>
          <Package size={15} aria-hidden="true" />
          Novo produto
        </button>
      </div>

      {/* Products by category */}
      {Object.keys(byCategory).length === 0 ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--brand-muted)' }}>
          Nenhum produto cadastrado ainda. Clique em &quot;Novo produto&quot; para começar.
        </div>
      ) : (
        Object.entries(byCategory).map(([category, categoryProducts]) => (
          <section key={category}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Tags size={14} color="var(--brand-muted)" />
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--brand-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {category}
              </span>
              <span style={{ fontSize: '0.72rem', color: '#4b5563', fontWeight: 600 }}>
                — {categoryProducts.length} {categoryProducts.length === 1 ? 'produto' : 'produtos'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
              {categoryProducts.map((product) => (
                <article
                  key={product.id}
                  className="glass-card"
                  style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                >
                  <div style={{ height: '3px', background: `linear-gradient(90deg, ${getProductColor(product.name)}, transparent)` }} />
                  <div style={{ padding: '18px 20px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>

                    {/* Product header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <span style={{
                        width: '42px', height: '42px', borderRadius: '12px',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        background: `${getProductColor(product.name)}18`, border: `1px solid ${getProductColor(product.name)}30`,
                        flexShrink: 0, color: getProductColor(product.name)
                      }}>
                        {(() => {
                           const IconComponent = getProductIcon(product.name)
                           return <IconComponent size={20} />
                        })()}
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <h3 style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--brand-text)', lineHeight: 1.3 }}>{product.name}</h3>
                        <p style={{ color: 'var(--brand-muted)', fontSize: '0.8rem', marginTop: '4px', lineHeight: 1.5 }}>{product.description}</p>
                      </div>
                    </div>

                    {/* Category chip */}
                    <div>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        padding: '4px 10px', borderRadius: '999px',
                        background: `${getProductColor(product.name)}12`, border: `1px solid ${getProductColor(product.name)}25`,
                        color: getProductColor(product.name), fontSize: '0.7rem', fontWeight: 700,
                      }}>
                        <Tags size={10} />
                        {product.category || 'Sem categoria'}
                      </span>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ flex: 1, justifyContent: 'center', fontSize: '0.76rem' }}
                        onClick={() => openEdit(product)}
                      >
                        <Package size={13} color="var(--brand-primary)" opacity={0.8} />
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ flex: 1, justifyContent: 'center', fontSize: '0.76rem' }}
                        onClick={() => openCosts(product)}
                      >
                        <DollarSign size={13} />
                        Custos
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ flex: 1, justifyContent: 'center', fontSize: '0.76rem' }}
                        onClick={() => setConfirmDelete(product)}
                      >
                        <Trash2 size={13} color="#ef4444" />
                        <span style={{ color: '#ef4444' }}>Excluir</span>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
      )}

      {/* ── DIALOG: Novo produto ── */}
      <ActionDialog
        open={showNewProduct}
        title="Novo produto"
        subtitle="Adicione um produto ao catálogo com nome, descrição e categoria."
        onClose={() => { setShowNewProduct(false); setDraft({ name: '', desc: '', category: 'Tributário' }) }}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setShowNewProduct(false)}>Cancelar</button>
            <button type="button" className="btn-primary" onClick={handleCreateProduct}>Salvar produto</button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>
              Nome *
            </label>
            <input
              className="input-field"
              value={draft.name}
              onChange={(e) => setDraft((s) => ({ ...s, name: e.target.value }))}
              placeholder="Ex: Compliance Tributário"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>
              Descrição *
            </label>
            <textarea
              className="input-field"
              rows={3}
              value={draft.desc}
              onChange={(e) => setDraft((s) => ({ ...s, desc: e.target.value }))}
              placeholder="Foco comercial do produto"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>
              Categoria *
            </label>
            <select
              className="input-field"
              value={draft.category}
              onChange={(e) => setDraft((s) => ({ ...s, category: e.target.value }))}
            >
              {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
        </div>
      </ActionDialog>

      {/* ── DIALOG: Editar produto ── */}
      <ActionDialog
        open={Boolean(editingProduct)}
        title="Editar produto"
        subtitle="Atualize as informações do produto no catálogo."
        onClose={() => { setEditingProduct(null); setDraft({ name: '', desc: '', category: 'Tributário' }) }}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setEditingProduct(null)}>Cancelar</button>
            <button type="button" className="btn-primary" onClick={handleUpdateProduct}>Salvar alterações</button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>
              Nome *
            </label>
            <input
              className="input-field"
              value={draft.name}
              onChange={(e) => setDraft((s) => ({ ...s, name: e.target.value }))}
              placeholder="Ex: Compliance Tributário"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>
              Descrição *
            </label>
            <textarea
              className="input-field"
              rows={3}
              value={draft.desc}
              onChange={(e) => setDraft((s) => ({ ...s, desc: e.target.value }))}
              placeholder="Foco comercial do produto"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>
              Categoria *
            </label>
            <select
              className="input-field"
              value={draft.category}
              onChange={(e) => setDraft((s) => ({ ...s, category: e.target.value }))}
            >
              {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
        </div>
      </ActionDialog>

      {/* ── DIALOG: Confirmar exclusão ── */}
      <ActionDialog
        open={Boolean(confirmDelete)}
        title="Excluir produto"
        subtitle={`Tem certeza que deseja excluir "${confirmDelete?.name}"? Esta ação não pode ser desfeita.`}
        onClose={() => setConfirmDelete(null)}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(null)}>Cancelar</button>
            <button
              type="button"
              className="btn-primary"
              style={{ background: 'rgba(239,68,68,0.9)', borderColor: 'rgba(239,68,68,0.4)' }}
              onClick={handleDeleteProduct}
            >
              <Trash2 size={14} />
              Excluir definitivamente
            </button>
          </>
        }
      >
        <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', fontSize: '0.85rem', lineHeight: 1.6 }}>
          ⚠️ Todos os leads vinculados a este produto perderão o vínculo. Os dados de leads não serão excluídos.
        </div>
      </ActionDialog>

      {/* ── DIALOG: Custos ── */}
      <ActionDialog
        open={Boolean(costsProduct)}
        title={`Custos — ${costsProduct?.name ?? ''}`}
        subtitle="Informações de custo registradas pelo financeiro para montar propostas mais precisas."
        width="640px"
        onClose={() => { setCostsProduct(null); setCosts([]) }}
        footer={
          <button type="button" className="btn-ghost" onClick={() => { setCostsProduct(null); setCosts([]) }}>
            Fechar
          </button>
        }
      >
        <div style={{ display: 'grid', gap: '20px' }}>
          {/* Add cost form */}
          <div style={{ padding: '16px', borderRadius: '14px', border: '1px solid rgba(251,191,36,0.15)', background: 'rgba(251,191,36,0.04)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
              Registrar novo custo
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: '#c9d1d9', fontSize: '0.78rem', fontWeight: 700 }}>Tipo</label>
                <select
                  className="input-field"
                  value={costDraft.cost_type}
                  onChange={(e) => setCostDraft((s) => ({ ...s, cost_type: e.target.value }))}
                >
                  {COST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: '#c9d1d9', fontSize: '0.78rem', fontWeight: 700 }}>Valor (R$)</label>
                <input
                  className="input-field"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={costDraft.amount}
                  onChange={(e) => setCostDraft((s) => ({ ...s, amount: e.target.value }))}
                />
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#c9d1d9', fontSize: '0.78rem', fontWeight: 700 }}>Observação</label>
              <input
                className="input-field"
                placeholder="Ex: Custo de captação por lead qualificado"
                value={costDraft.notes}
                onChange={(e) => setCostDraft((s) => ({ ...s, notes: e.target.value }))}
              />
            </div>
            <button
              type="button"
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={handleAddCost}
              disabled={savingCost}
            >
              <Plus size={14} />
              {savingCost ? 'Salvando...' : 'Adicionar custo'}
            </button>
          </div>

          {/* Cost list */}
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--brand-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
              Custos registrados ({costs.length})
            </div>
            {loadingCosts ? (
              <div style={{ color: 'var(--brand-muted)', fontSize: '0.85rem', padding: '20px', textAlign: 'center' }}>Carregando...</div>
            ) : costs.length === 0 ? (
              <div style={{ color: '#4b5563', fontSize: '0.85rem', padding: '16px', borderRadius: '10px', border: '1px dashed rgba(255,255,255,0.08)', textAlign: 'center' }}>
                Nenhum custo registrado ainda.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '8px' }}>
                {costs.map((cost) => (
                  <div key={cost.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#e2e8f0' }}>{cost.cost_type}</div>
                      {cost.notes && <div style={{ color: 'var(--brand-muted)', fontSize: '0.74rem', marginTop: '2px' }}>{cost.notes}</div>}
                    </div>
                    <span style={{ fontWeight: 900, fontSize: '0.9rem', color: '#10b981', flexShrink: 0 }}>
                      {formatCurrency(cost.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ActionDialog>
    </div>
  )
}
