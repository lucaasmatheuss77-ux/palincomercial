'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import ActionDialog from '@/components/action-dialog'
import { createManualCommission } from '@/app/actions/commissions'

type Option = { id: string; name: string }

export default function CommissionManualEntry({ consultants, products }: { consultants: Option[]; products: Option[] }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState({
    profileId: '',
    productId: '',
    amount: '',
    status: 'pendente' as 'pendente' | 'pago',
    notes: '',
  })

  function closeDialog() {
    setOpen(false)
    setDraft({ profileId: '', productId: '', amount: '', status: 'pendente', notes: '' })
  }

  async function handleSave() {
    if (!draft.profileId) { toast.error('Selecione o consultor.'); return }
    if (!draft.amount || Number(draft.amount) <= 0) { toast.error('Informe o valor da comissão.'); return }

    setSaving(true)
    try {
      const result = await createManualCommission({
        profileId: draft.profileId,
        productId: draft.productId || null,
        amount: Number(draft.amount),
        status: draft.status,
        notes: draft.notes || null,
      })
      if (!result.success) {
        toast.error('Erro ao lançar comissão', { description: result.error })
        return
      }
      toast.success('Comissão lançada. Atualize a página para ver no extrato.')
      closeDialog()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        <Plus size={15} />
        Lançar comissão
      </button>

      <ActionDialog
        open={open}
        title="Lançar comissão manual"
        subtitle="Registre uma comissão avulsa, escolhendo o consultor e o produto."
        onClose={closeDialog}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={closeDialog}>Cancelar</button>
            <button type="button" className="btn-primary" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Salvando...' : 'Lançar comissão'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '7px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>Consultor *</label>
            <select className="input-field" value={draft.profileId} onChange={(e) => setDraft((c) => ({ ...c, profileId: e.target.value }))}>
              <option value="">Selecione o consultor</option>
              {consultants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '7px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>Produto (opcional)</label>
            <select className="input-field" value={draft.productId} onChange={(e) => setDraft((c) => ({ ...c, productId: e.target.value }))}>
              <option value="">— Sem produto específico —</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '7px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>Valor da comissão (R$) *</label>
              <input className="input-field" type="number" min="0" step="0.01" placeholder="Ex: 250.00" value={draft.amount} onChange={(e) => setDraft((c) => ({ ...c, amount: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '7px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>Status</label>
              <select className="input-field" value={draft.status} onChange={(e) => setDraft((c) => ({ ...c, status: e.target.value as 'pendente' | 'pago' }))}>
                <option value="pendente">Pendente</option>
                <option value="pago">Já pago</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '7px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>Observação</label>
            <input className="input-field" placeholder="Ex: Bônus por indicação" value={draft.notes} onChange={(e) => setDraft((c) => ({ ...c, notes: e.target.value }))} />
          </div>
        </div>
      </ActionDialog>
    </>
  )
}
