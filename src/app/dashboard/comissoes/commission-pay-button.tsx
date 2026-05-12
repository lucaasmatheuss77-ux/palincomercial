'use client'

import { useState } from 'react'
import { DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import { markCommissionPaid } from '@/app/actions/commissions'

export default function CommissionPayButton({ commissionId }: { commissionId: string }) {
  const [loading, setLoading] = useState(false)

  async function handlePay() {
    setLoading(true)
    const result = await markCommissionPaid(commissionId)

    if (!result.success) {
      toast.error('Erro ao processar pagamento', { description: result.error })
      setLoading(false)
      return
    }

    toast.success('Comissão marcada como paga')
    setLoading(false)
  }

  return (
    <button
      type="button"
      className="btn-primary"
      onClick={handlePay}
      disabled={loading}
      style={{ padding: '6px 12px', fontSize: '0.72rem', opacity: loading ? 0.7 : 1, cursor: loading ? 'wait' : 'pointer' }}
    >
      {loading ? (
        <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      ) : (
        <DollarSign size={12} />
      )}
      {loading ? 'Processando...' : 'Pagar'}
    </button>
  )
}
