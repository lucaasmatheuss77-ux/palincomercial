import { createClient } from '@/lib/supabase/server'
import { listUsers } from '@/app/actions/usuarios'
import EquipeClient from './equipe-client'
import type { RacePlayer } from '@/components/PixelRaceTrack'
import { skinFromName } from '@/components/avatar-utils'

export const dynamic = 'force-dynamic'

// Pontuação por ação
const SCORE = {
  contrato:      500,
  leadFechado:   300,
  negociando:    100,
  proposta:       60,
  apresentacao:   30,
  qualificacao:   10,
  ativo:          15,
}

const META_SCORE = 1500 // 100% = 1500 pontos (~3 contratos)

export default async function EquipePage() {
  const supabase = await createClient()

  const [members, products, leadsData, dealsData] = await Promise.all([
    listUsers(),
    supabase.from('products').select('id, name').order('name').then(r => r.data ?? []),
    supabase.from('leads').select('consultant_id, stage').then(r => r.data ?? []),
    supabase.from('deals').select('consultant_id').then(r => r.data ?? []),
  ])

  // Agrupa leads por consultor
  const leadsByConsultant: Record<string, {
    fechados: number; negociando: number; proposta: number;
    apresentacao: number; qualificacao: number; ativos: number;
  }> = {}

  for (const lead of leadsData) {
    const cid = lead.consultant_id
    if (!cid) continue
    if (!leadsByConsultant[cid]) leadsByConsultant[cid] = { fechados: 0, negociando: 0, proposta: 0, apresentacao: 0, qualificacao: 0, ativos: 0 }
    const s = lead.stage as string
    if (s === 'Fechado')          leadsByConsultant[cid].fechados++
    else if (s === 'Negociacao')  leadsByConsultant[cid].negociando++
    else if (s === 'Proposta')    leadsByConsultant[cid].proposta++
    else if (s === 'Apresentacao')leadsByConsultant[cid].apresentacao++
    else if (s === 'Qualificacao')leadsByConsultant[cid].qualificacao++
    if (!['Fechado','Perdido'].includes(s)) leadsByConsultant[cid].ativos++
  }

  const dealsByConsultant: Record<string, number> = {}
  for (const deal of dealsData) {
    if (!deal.consultant_id) continue
    dealsByConsultant[deal.consultant_id] = (dealsByConsultant[deal.consultant_id] ?? 0) + 1
  }

  // Monta players — apenas consultores e gestor
  const consultorRoles = ['consultor', 'Consultor', 'gestor', 'Gestor', 'SDR', 'sdr']
  const players: RacePlayer[] = members
    .filter(m => consultorRoles.some(r => (m.role ?? '').toLowerCase().includes(r.toLowerCase())))
    .map(m => {
      const ls = leadsByConsultant[m.id] ?? { fechados: 0, negociando: 0, proposta: 0, apresentacao: 0, qualificacao: 0, ativos: 0 }
      const contratos = dealsByConsultant[m.id] ?? 0
      const score =
        contratos           * SCORE.contrato +
        ls.fechados         * SCORE.leadFechado +
        ls.negociando       * SCORE.negociando +
        ls.proposta         * SCORE.proposta +
        ls.apresentacao     * SCORE.apresentacao +
        ls.qualificacao     * SCORE.qualificacao +
        ls.ativos           * SCORE.ativo
      const progress = Math.min(Math.round((score / META_SCORE) * 100), 100)
      return {
        id: m.id,
        name: m.full_name ?? 'Consultor',
        role: m.role ?? 'Consultor',
        produtoFoco: m.produto_foco ?? '',
        score,
        progress,
        skin: (m.avatar_skin ?? skinFromName(m.full_name ?? m.id)) as import('@/components/avatar-utils').AvatarSkin,
        isLeader: false, // definido abaixo
        contratos,
        leadsFechados: ls.fechados,
        leadsAtivos: ls.ativos,
      }
    })

  // Define líder (maior score)
  if (players.length > 0) {
    const maxScore = Math.max(...players.map(p => p.score))
    players.forEach(p => { p.isLeader = p.score === maxScore && maxScore > 0 })
  }

  return (
    <EquipeClient
      members={members}
      products={products}
      racePlayers={players}
    />
  )
}
