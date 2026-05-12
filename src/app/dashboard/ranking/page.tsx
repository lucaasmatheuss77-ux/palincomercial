import { createClient } from '@/lib/supabase/server'
import { Award, TrendingUp } from 'lucide-react'
import PixelAvatar from '@/components/PixelAvatar'
import { skinFromName } from '@/components/avatar-utils'

export const dynamic = 'force-dynamic'

export default async function RankingPage() {
  const supabase = await createClient()

  const { data: dbProfiles } = await supabase.from('profiles').select('id, full_name, role, avatar_skin')
  const { data: dbDeals } = await supabase.from('deals').select('consultant_id')

  const contractsMap: Record<string, number> = {}
  dbDeals?.forEach((deal) => {
    if (!contractsMap[deal.consultant_id]) contractsMap[deal.consultant_id] = 0
    contractsMap[deal.consultant_id] += 1
  })

  const ranking = (dbProfiles || [])
    .map((profile) => ({
      id: profile.id,
      name: profile.full_name || 'Usuario',
      role: profile.role || 'Comercial',
      contratos: contractsMap[profile.id] || 0,
      avatar_skin: profile.avatar_skin,
    }))
    .sort((a, b) => b.contratos - a.contratos || a.name.localeCompare(b.name))
    .map((member, index) => ({ ...member, pos: index + 1 }))

  const contractsTotal = ranking.reduce((sum, m) => sum + m.contratos, 0)
  const topCloser = ranking[0]

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--brand-text)', letterSpacing: '-0.02em' }}>Performance do time</h1>
          <p style={{ color: 'var(--brand-muted)', fontSize: '0.84rem', marginTop: '4px' }}>Ranking por contratos fechados</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ padding: '8px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--brand-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Time</div>
            <div style={{ marginTop: '2px', fontSize: '1.1rem', color: '#f8fafc', fontWeight: 900 }}>{ranking.length}</div>
          </div>
          <div style={{ padding: '8px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--brand-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Contratos</div>
            <div style={{ marginTop: '2px', fontSize: '1.1rem', color: '#f8fafc', fontWeight: 900 }}>{contractsTotal}</div>
          </div>
          {topCloser && topCloser.contratos > 0 && (
            <div style={{ padding: '8px 14px', borderRadius: '12px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.14)' }}>
              <div style={{ fontSize: '0.62rem', color: 'var(--brand-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Lider</div>
              <div style={{ marginTop: '2px', fontSize: '0.9rem', color: 'var(--brand-primary)', fontWeight: 900 }}>{topCloser.name.split(' ')[0]}</div>
            </div>
          )}
        </div>
      </div>

      {/* Ranking table */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        {ranking.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <Award size={32} color="#30363d" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--brand-muted)', fontSize: '0.9rem' }}>Nenhum membro encontrado.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['#', 'Membro', 'Funcao', 'Contratos'].map((col) => (
                  <th
                    key={col}
                    style={{
                      padding: '12px 16px',
                      textAlign: col === 'Contratos' ? 'right' : 'left',
                      fontSize: '0.66rem',
                      fontWeight: 800,
                      color: 'var(--brand-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranking.map((member, index) => {
                const isTop3 = index < 3
                const posColor = index === 0 ? '#f59e0b' : index === 1 ? '#94a3b8' : index === 2 ? '#cd7f32' : '#30363d'

                return (
                  <tr
                    key={member.id}
                    style={{
                      borderBottom: index < ranking.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      background: isTop3 ? 'rgba(251,191,36,0.03)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '14px 16px', width: '48px' }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: `${posColor}22`,
                          color: posColor,
                          fontWeight: 900,
                          fontSize: '0.8rem',
                        }}
                      >
                        {member.pos}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <PixelAvatar
                          skin={(member.avatar_skin ?? skinFromName(member.name)) as import('@/components/avatar-utils').AvatarSkin}
                          size={2}
                          crowned={index === 0}
                          label={member.name}
                          role={member.role}
                        />
                        <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--brand-text)' }}>{member.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ color: 'var(--brand-muted)', fontSize: '0.8rem' }}>{member.role}</span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      {member.contratos > 0 ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <TrendingUp size={13} color="#10b981" aria-hidden="true" />
                          <span style={{ fontWeight: 800, fontSize: '0.86rem', color: '#10b981' }}>{member.contratos}</span>
                        </div>
                      ) : (
                        <span style={{ color: '#30363d', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
