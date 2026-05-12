'use client'

/**
 * PixelRaceTrack — Pista de corrida gamificada com avatares pixel art.
 * Cada consultor tem sua faixa. O avatar avança conforme o score.
 * Score = contratos × 500 + leads_fechados × 300 + leads_negociando × 100 + ...
 */

import { useEffect, useState } from 'react'
import PixelAvatar from './PixelAvatar'
import type { AvatarSkin } from './PixelAvatar'

export type RacePlayer = {
  id: string
  name: string
  role: string
  produtoFoco?: string
  score: number
  progress: number   // 0–100 (% da meta)
  skin: AvatarSkin
  isLeader: boolean
  contratos: number
  leadsFechados: number
  leadsAtivos: number
}

// Checkpoints visuais na pista
const CHECKPOINTS = [25, 50, 75, 100]

// Tier por progresso
function getTier(p: number) {
  if (p >= 100) return { label: '🏆 META!', color: '#fbbf24', glow: 'rgba(251,191,36,0.4)' }
  if (p >= 75)  return { label: '🔥 Elite', color: '#f97316', glow: 'rgba(249,115,22,0.3)' }
  if (p >= 50)  return { label: '⚡ Forte', color: '#10b981', glow: 'rgba(16,185,129,0.3)' }
  if (p >= 25)  return { label: '📈 Aquecendo', color: '#3b82f6', glow: 'rgba(59,130,246,0.2)' }
  return         { label: '🚀 Início', color: '#64748b', glow: 'rgba(100,116,139,0.15)' }
}

function Lane({ player, rank }: { player: RacePlayer; rank: number }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), rank * 120); return () => clearTimeout(t) }, [rank])

  const tier = getTier(player.progress)
  const clampedProgress = Math.min(player.progress, 100)

  return (
    <div style={{
      position: 'relative',
      padding: '10px 16px',
      borderRadius: 14,
      background: player.isLeader
        ? 'linear-gradient(135deg, rgba(251,191,36,0.06), rgba(0,0,0,0.2))'
        : 'rgba(255,255,255,0.02)',
      border: player.isLeader
        ? '1px solid rgba(251,191,36,0.2)'
        : '1px solid rgba(255,255,255,0.04)',
      transition: 'all 0.3s ease',
    }}>
      {/* Linha de cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        {/* Posição */}
        <div style={{
          width: 24, height: 24, borderRadius: 6, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: rank === 0 ? 'rgba(251,191,36,0.2)' : rank === 1 ? 'rgba(148,163,184,0.15)' : rank === 2 ? 'rgba(205,127,50,0.15)' : 'rgba(255,255,255,0.04)',
          color: rank === 0 ? '#fbbf24' : rank === 1 ? '#94a3b8' : rank === 2 ? '#cd7f32' : '#475569',
          fontSize: '0.7rem', fontWeight: 900,
        }}>
          {rank + 1}
        </div>

        {/* Avatar inline pequeno */}
        <div style={{ flexShrink: 0 }}>
          <PixelAvatar
            skin={player.skin}
            size={2}
            walking={player.score > 0}
            crowned={player.isLeader}
            role={player.role}
            produtoFoco={player.produtoFoco}
          />
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '0.84rem', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {player.name.split(' ')[0]}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{player.role}</div>
        </div>

        {/* Tier badge */}
        <div style={{
          fontSize: '0.62rem', fontWeight: 800, whiteSpace: 'nowrap',
          padding: '3px 8px', borderRadius: 999,
          background: `${tier.glow}`,
          color: tier.color, border: `1px solid ${tier.color}33`,
        }}>
          {tier.label}
        </div>

        {/* Score */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 900, color: tier.color }}>{Math.round(clampedProgress)}%</div>
          <div style={{ fontSize: '0.62rem', color: '#475569' }}>{player.score} pts</div>
        </div>
      </div>

      {/* PISTA */}
      <div style={{ position: 'relative', height: 48, background: '#0a1628', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
        {/* Grama / chão */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 10, background: 'linear-gradient(to bottom, #1a3a1a, #0f2010)' }} />
        {/* Linha de pista */}
        <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, height: 2, background: 'rgba(255,255,255,0.04)' }} />

        {/* Checkpoints */}
        {CHECKPOINTS.map(cp => (
          <div key={cp} style={{
            position: 'absolute', left: `${cp}%`, top: 0, bottom: 0, width: 1,
            background: cp === 100 ? 'rgba(251,191,36,0.5)' : 'rgba(255,255,255,0.08)',
            zIndex: 1,
          }}>
            <span style={{
              position: 'absolute', top: 2, left: 3,
              fontSize: '0.5rem', color: cp === 100 ? '#fbbf24' : '#334155',
              fontWeight: 700, whiteSpace: 'nowrap',
            }}>
              {cp === 100 ? '🏁' : `${cp}%`}
            </span>
          </div>
        ))}

        {/* Trilha de progresso (sombra no chão) */}
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0,
          width: mounted ? `${clampedProgress}%` : '0%',
          height: '100%',
          background: `linear-gradient(to right, ${tier.glow}, transparent)`,
          transition: 'width 1.4s cubic-bezier(0.34,1.56,0.64,1)',
        }} />

        {/* AVATAR NA PISTA */}
        <div style={{
          position: 'absolute',
          bottom: 10,
          left: mounted ? `calc(${clampedProgress}% - 24px)` : '0%',
          transition: 'left 1.4s cubic-bezier(0.34,1.56,0.64,1)',
          zIndex: 5,
          filter: `drop-shadow(0 0 6px ${tier.color})`,
        }}>
          <PixelAvatar
            skin={player.skin}
            size={2}
            walking={player.score > 0 && mounted}
            crowned={player.isLeader}
            role={player.role}
            produtoFoco={player.produtoFoco}
            label={`${player.name} — ${Math.round(clampedProgress)}%`}
          />
        </div>

        {/* Linha de chegada */}
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 4,
          background: 'repeating-linear-gradient(to bottom, #fff 0px, #fff 4px, #000 4px, #000 8px)',
          opacity: 0.4,
        }} />
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        {[
          { label: 'Contratos', value: player.contratos, color: '#10b981' },
          { label: 'Fechados', value: player.leadsFechados, color: '#fbbf24' },
          { label: 'Ativos', value: player.leadsAtivos, color: '#3b82f6' },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{s.label}:</span>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface PixelRaceTrackProps {
  players: RacePlayer[]
  metaLabel?: string
}

export default function PixelRaceTrack({ players, metaLabel = '3 contratos' }: PixelRaceTrackProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score)

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 20,
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🕹️</span>
          <div>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.01em', margin: 0 }}>
              Arena dos Consultores
            </h2>
            <p style={{ fontSize: '0.7rem', color: '#475569', margin: 0 }}>
              Quem vai chegar primeiro à meta?
            </p>
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 999,
          background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
        }}>
          <span style={{ fontSize: '0.62rem', color: '#fbbf24', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Meta mensal
          </span>
          <span style={{ fontSize: '0.72rem', color: '#fcd34d', fontWeight: 900 }}>{metaLabel}</span>
        </div>
      </div>

      {/* Pistas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#334155', fontSize: '0.85rem' }}>
            Nenhum consultor para exibir.
          </div>
        ) : (
          sorted.map((player, i) => (
            <Lane key={player.id} player={player} rank={i} />
          ))
        )}
      </div>

      {/* Legenda */}
      <div style={{ marginTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[
          { label: 'Início', color: '#64748b' },
          { label: 'Aquecendo 25%', color: '#3b82f6' },
          { label: 'Forte 50%', color: '#10b981' },
          { label: 'Elite 75%', color: '#f97316' },
          { label: 'META! 100%', color: '#fbbf24' },
        ].map(t => (
          <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
            <span style={{ fontSize: '0.62rem', color: '#475569' }}>{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
