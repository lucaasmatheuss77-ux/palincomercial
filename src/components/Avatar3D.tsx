'use client'

/**
 * Avatar3D — Personagem 3D cartoon corporativo em CSS puro.
 * Sem imagens externas, sem Canvas, sem SVG, sem dependências.
 * Representa consultores do ramo agro e corporativo da Antigravity.
 */

import { useEffect, useState, CSSProperties } from 'react'

export type AvatarGender    = 'male' | 'female'
export type AvatarHairstyle = 0 | 1 | 2 | 3 | 4 | 5
export type AvatarBeard     = 'none' | 'stubble' | 'full'
export type AvatarGlasses   = 'none' | 'round' | 'rectangular'
export type AvatarOutfit    = 'agro' | 'corporativo'
export type AvatarAccessory3D = 'none' | 'chapeu-palha' | 'chapeu-couro' | 'botas-rurais' | 'colete' | 'terno' | 'blazer' | 'gravata' | 'caneta' | 'tablet' | 'pasta'

export const SKIN_TONES: { id: string; color: string; label: string }[] = [
  { id: 'light',       color: '#fde8d0', label: 'Clara'     },
  { id: 'medium-light',color: '#f4c28a', label: 'Média-clara'},
  { id: 'medium',      color: '#d4956a', label: 'Média'     },
  { id: 'medium-dark', color: '#b07040', label: 'Média-escura'},
  { id: 'dark',        color: '#7d4c27', label: 'Escura'    },
  { id: 'deep',        color: '#4a2912', label: 'Profunda'  },
]

export interface Avatar3DConfig {
  gender:     AvatarGender
  skinTone:   string
  hairstyle:  AvatarHairstyle
  beard:      AvatarBeard
  glasses:    AvatarGlasses
  outfit:     AvatarOutfit
  accessory:  AvatarAccessory3D
}

export const DEFAULT_CONFIG: Avatar3DConfig = {
  gender:    'male',
  skinTone:  '#f4c28a',
  hairstyle: 0,
  beard:     'none',
  glasses:   'none',
  outfit:    'corporativo',
  accessory: 'none',
}

// ── Paletas de cabelo por gênero e estilo ──────────────────────────────────
const HAIR_COLORS = ['#1a1a1a', '#6b3a1f', '#c8922a', '#b4b4b4', '#8b2635', '#4a3728']
const HAIR_SHAPES: Record<AvatarGender, Record<AvatarHairstyle, CSSProperties>> = {
  male: {
    0: { borderRadius: '50% 50% 0 0', height: 24 },
    1: { borderRadius: '50% 50% 0 0', height: 20, borderBottom: '4px solid transparent' },
    2: { borderRadius: '40% 60% 0 0', height: 26 },
    3: { borderRadius: '50% 50% 0 0', height: 18 },
    4: { borderRadius: '50% 50% 0 0', height: 22, transform: 'skew(-5deg)' },
    5: { borderRadius: '50% 50% 0 0', height: 30 },
  },
  female: {
    0: { borderRadius: '50% 50% 0 0', height: 28 },
    1: { borderRadius: '60% 40% 0 0', height: 32 },
    2: { borderRadius: '50% 50% 0 0', height: 24 },
    3: { borderRadius: '40% 60% 0 0', height: 30 },
    4: { borderRadius: '50% 50% 0 0', height: 26 },
    5: { borderRadius: '50% 50% 0 0', height: 36 },
  },
}

// ── Cores de outfit ────────────────────────────────────────────────────────
const OUTFIT_COLORS: Record<AvatarOutfit, { primary: string; secondary: string; accent: string }> = {
  corporativo: { primary: '#1e3a5f', secondary: '#2d5580', accent: '#f8fafc' },
  agro:        { primary: '#3d5a1e', secondary: '#4e7028', accent: '#f5d16a' },
}

interface Props {
  config: Avatar3DConfig
  size?: number          // multiplicador de escala (1 = 120px base)
  walking?: boolean
  spinning?: boolean
  showPodium?: boolean
}

export default function Avatar3D({
  config,
  size = 1,
  walking = false,
  spinning = false,
  showPodium = true,
}: Props) {
  const [frame, setFrame] = useState(0)
  const [rotation, setRotation] = useState(0)
  const scale = size * 1.2

  // Walk cycle
  useEffect(() => {
    if (!walking) { setFrame(0); return }
    const id = setInterval(() => setFrame(f => (f + 1) % 2), 420)
    return () => clearInterval(id)
  }, [walking])

  // Spin cycle
  useEffect(() => {
    if (!spinning) { setRotation(0); return }
    const id = setInterval(() => setRotation(r => (r + 3) % 360), 16)
    return () => clearInterval(id)
  }, [spinning])

  const outfit  = OUTFIT_COLORS[config.outfit]
  const hairIdx = config.hairstyle % HAIR_COLORS.length
  const hairColor = HAIR_COLORS[hairIdx]
  const hairShape = HAIR_SHAPES[config.gender][config.hairstyle]

  const legOffset = walking && frame === 1 ? 4 : 0

  const s = (px: number) => px * scale
  const st = (obj: CSSProperties): CSSProperties => obj

  return (
    <div style={st({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: s(4),
      transform: `rotateY(${rotation}deg)`,
      transformStyle: 'preserve-3d',
      transition: spinning ? 'none' : 'transform 0.6s ease',
    })}>

      {/* ── Acessório de cabeça (chapéu) ── */}
      {(config.accessory === 'chapeu-palha' || config.accessory === 'chapeu-couro') && (
        <div style={st({
          position: 'relative',
          width: s(70), height: s(14),
          background: config.accessory === 'chapeu-palha'
            ? 'linear-gradient(135deg, #d4a853, #b8912e)'
            : 'linear-gradient(135deg, #5c3d1e, #3d2810)',
          borderRadius: s(4),
          boxShadow: `0 ${s(2)}px ${s(8)}px rgba(0,0,0,0.4)`,
          marginBottom: s(-10),
          zIndex: 10,
        })}>
          {/* Copa do chapéu */}
          <div style={st({
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: s(36),
            height: s(20),
            background: config.accessory === 'chapeu-palha'
              ? 'linear-gradient(135deg, #c49230, #a87a20)'
              : 'linear-gradient(135deg, #4a3020, #2d1e0e)',
            borderRadius: `${s(6)}px ${s(6)}px 0 0`,
          })} />
        </div>
      )}

      {/* ── Cabeça ── */}
      <div style={st({
        position: 'relative',
        width: s(54),
        height: s(60),
        zIndex: 2,
      })}>
        {/* Cabelo */}
        <div style={st({
          position: 'absolute',
          top: 0, left: '50%',
          transform: 'translateX(-50%)',
          width: s(50),
          background: hairColor,
          zIndex: 3,
          ...hairShape,
          height: s(Number(hairShape.height) || 24),
        })} />

        {/* Rosto */}
        <div style={st({
          position: 'absolute',
          bottom: 0, left: '50%',
          transform: 'translateX(-50%)',
          width: s(50),
          height: s(52),
          background: `radial-gradient(ellipse at 35% 35%, ${config.skinTone}ee, ${config.skinTone}cc)`,
          borderRadius: `${s(25)}px ${s(25)}px ${s(20)}px ${s(20)}px`,
          boxShadow: `inset -${s(6)}px -${s(4)}px ${s(12)}px rgba(0,0,0,0.15), inset ${s(3)}px ${s(3)}px ${s(8)}px rgba(255,255,255,0.3)`,
          zIndex: 2,
          overflow: 'hidden',
        })}>
          {/* Bochecha highlight */}
          <div style={st({ position:'absolute', bottom: s(14), left: s(6), width: s(10), height: s(6), borderRadius: '50%', background: 'rgba(255,150,120,0.25)' })} />
          <div style={st({ position:'absolute', bottom: s(14), right: s(6), width: s(10), height: s(6), borderRadius: '50%', background: 'rgba(255,150,120,0.25)' })} />

          {/* Olhos */}
          <div style={st({ position:'absolute', top: s(18), left: s(10), display:'flex', gap: s(12) })}>
            {[0,1].map(i => (
              <div key={i} style={st({ position:'relative', width: s(10), height: s(12) })}>
                <div style={st({ width: s(10), height: s(12), background: '#1a1a2e', borderRadius: '50%', boxShadow: `inset -${s(1)}px -${s(1)}px ${s(2)}px rgba(255,255,255,0.4)` })} />
                <div style={st({ position:'absolute', top: s(2), left: s(2), width: s(4), height: s(4), background: 'rgba(255,255,255,0.7)', borderRadius: '50%' })} />
              </div>
            ))}
          </div>

          {/* Óculos */}
          {config.glasses !== 'none' && (
            <div style={st({
              position:'absolute', top: s(16), left: s(6),
              display:'flex', gap: s(4), alignItems:'center',
            })}>
              {[0,1].map(i => (
                <div key={i} style={st({
                  width: s(16), height: s(16),
                  border: `${s(1.5)}px solid ${config.glasses === 'round' ? '#6b7280' : '#374151'}`,
                  borderRadius: config.glasses === 'round' ? '50%' : s(3),
                  background: 'rgba(147,197,253,0.15)',
                })} />
              ))}
              <div style={st({ position:'absolute', left: s(14), top: s(7), width: s(6), height: s(1.5), background: '#6b7280' })} />
            </div>
          )}

          {/* Nariz */}
          <div style={st({ position:'absolute', top: s(28), left: '50%', transform: 'translateX(-50%)', width: s(8), height: s(6), borderRadius: `0 0 ${s(4)}px ${s(4)}px`, background: `${config.skinTone}88`, border: `${s(0.5)}px solid rgba(0,0,0,0.1)` })} />

          {/* Boca */}
          <div style={st({ position:'absolute', bottom: s(10), left: '50%', transform: 'translateX(-50%)', width: s(18), height: s(5), borderRadius: `0 0 ${s(9)}px ${s(9)}px`, background: '#c45c5c', overflow:'hidden' })}>
            <div style={st({ position:'absolute', top: 0, left: 0, right: 0, height: s(2), background: '#e07070' })} />
          </div>

          {/* Barba */}
          {config.beard !== 'none' && (
            <div style={st({
              position:'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
              width: config.beard === 'full' ? s(38) : s(28),
              height: config.beard === 'full' ? s(18) : s(8),
              background: `${hairColor}bb`,
              borderRadius: `0 0 ${s(16)}px ${s(16)}px`,
            })} />
          )}
        </div>
      </div>

      {/* ── Pescoço ── */}
      <div style={st({
        width: s(18),
        height: s(10),
        background: config.skinTone,
        borderRadius: `0 0 ${s(4)}px ${s(4)}px`,
        marginTop: s(-8),
        zIndex: 1,
      })} />

      {/* ── Corpo (torso) ── */}
      <div style={st({
        position: 'relative',
        width: s(60),
        height: s(72),
        marginTop: s(-4),
        zIndex: 2,
      })}>
        {/* Camisa base / torso */}
        <div style={st({
          position: 'absolute', inset: 0,
          background: `linear-gradient(160deg, ${outfit.secondary}, ${outfit.primary})`,
          borderRadius: `${s(8)}px ${s(8)}px ${s(4)}px ${s(4)}px`,
          boxShadow: `inset -${s(6)}px 0 ${s(16)}px rgba(0,0,0,0.2), inset ${s(3)}px 0 ${s(8)}px rgba(255,255,255,0.1)`,
        })} />

        {/* Blazer / colete */}
        {config.outfit === 'corporativo' && (
          <>
            {/* Lapela esquerda */}
            <div style={st({
              position:'absolute', top: s(4), left: s(4),
              width: s(22), height: s(40),
              background: `linear-gradient(160deg, #0f2240, #1a3860)`,
              borderRadius: `${s(4)}px 0 ${s(20)}px 0`,
              boxShadow: `inset -${s(2)}px 0 ${s(4)}px rgba(255,255,255,0.05)`,
            })} />
            {/* Lapela direita */}
            <div style={st({
              position:'absolute', top: s(4), right: s(4),
              width: s(22), height: s(40),
              background: `linear-gradient(200deg, #0f2240, #1a3860)`,
              borderRadius: `0 ${s(4)}px 0 ${s(20)}px`,
            })} />
            {/* Gravata */}
            {config.accessory === 'gravata' && (
              <div style={st({
                position:'absolute', top: s(2), left: '50%',
                transform: 'translateX(-50%)',
                width: s(10), height: s(36),
                background: 'linear-gradient(180deg, #dc2626, #991b1b)',
                borderRadius: `${s(2)}px ${s(2)}px ${s(5)}px ${s(5)}px`,
                clipPath: 'polygon(30% 0, 70% 0, 100% 60%, 50% 100%, 0% 60%)',
              })} />
            )}
            {/* Botões */}
            {[0,1,2].map(i => (
              <div key={i} style={st({
                position:'absolute',
                top: s(12 + i * 14),
                left: '50%', transform: 'translateX(-50%)',
                width: s(5), height: s(5), borderRadius: '50%',
                background: '#c0cce0',
              })} />
            ))}
          </>
        )}

        {/* Colete agro */}
        {config.outfit === 'agro' && (
          <div style={st({
            position:'absolute', top: s(2), left: s(6), right: s(6), bottom: s(6),
            background: 'linear-gradient(160deg, #5c3d1e, #7a5228)',
            borderRadius: s(6),
            border: `${s(1)}px solid #a0722a`,
          })} />
        )}

        {/* Bolso lapela */}
        <div style={st({
          position:'absolute', top: s(16), left: s(8),
          width: s(14), height: s(10),
          border: `${s(1)}px solid rgba(255,255,255,0.15)`,
          borderRadius: s(2),
        })} />

        {/* Braço esquerdo */}
        <div style={st({
          position:'absolute',
          top: s(2),
          left: s(-18),
          width: s(18), height: s(52),
          background: `linear-gradient(160deg, ${outfit.secondary}, ${outfit.primary})`,
          borderRadius: `${s(6)}px ${s(6)}px ${s(8)}px ${s(8)}px`,
          transform: walking && frame === 1 ? `rotate(-12deg)` : `rotate(6deg)`,
          transformOrigin: 'top center',
          transition: 'transform 0.42s ease',
        })}>
          {/* Mão esq */}
          <div style={st({ position:'absolute', bottom: s(-6), left: '50%', transform: 'translateX(-50%)', width: s(14), height: s(14), borderRadius: '50%', background: config.skinTone })} />
        </div>

        {/* Braço direito */}
        <div style={st({
          position:'absolute',
          top: s(2),
          right: s(-18),
          width: s(18), height: s(52),
          background: `linear-gradient(200deg, ${outfit.secondary}, ${outfit.primary})`,
          borderRadius: `${s(6)}px ${s(6)}px ${s(8)}px ${s(8)}px`,
          transform: walking && frame === 1 ? `rotate(12deg)` : `rotate(-6deg)`,
          transformOrigin: 'top center',
          transition: 'transform 0.42s ease',
        })}>
          {/* Acessório na mão */}
          {config.accessory === 'pasta' && (
            <div style={st({
              position:'absolute', bottom: s(-14), left: s(-10),
              width: s(28), height: s(22),
              background: 'linear-gradient(135deg, #8b5e3c, #6b4528)',
              borderRadius: s(4),
              border: `${s(1)}px solid #a0784a`,
              boxShadow: `0 ${s(4)}px ${s(12)}px rgba(0,0,0,0.3)`,
            })}>
              <div style={st({ position:'absolute', top: '50%', left: 0, right: 0, height: s(1.5), background: '#a0784a', transform: 'translateY(-50%)' })} />
              <div style={st({ position:'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: s(6), height: s(6), borderRadius: '50%', background: '#c0965a' })} />
            </div>
          )}
          {config.accessory === 'caneta' && (
            <div style={st({
              position:'absolute', bottom: s(-16), left: '50%',
              transform: 'translateX(-50%) rotate(30deg)',
              width: s(4), height: s(30),
              background: 'linear-gradient(180deg, #d4af37, #b8941f)',
              borderRadius: s(2),
              boxShadow: `0 0 ${s(6)}px rgba(212,175,55,0.4)`,
            })}>
              <div style={st({ position:'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: `${s(2)}px solid transparent`, borderRight: `${s(2)}px solid transparent`, borderTop: `${s(6)}px solid #c0a030` })} />
            </div>
          )}
          {config.accessory === 'tablet' && (
            <div style={st({
              position:'absolute', bottom: s(-14), right: s(-4),
              width: s(26), height: s(34),
              background: '#1e293b',
              borderRadius: s(4),
              border: `${s(2)}px solid #334155`,
              boxShadow: `0 ${s(4)}px ${s(12)}px rgba(0,0,0,0.4)`,
              display:'flex', alignItems:'center', justifyContent:'center',
            })}>
              <div style={st({ width: '80%', height: '80%', borderRadius: s(2), background: 'linear-gradient(135deg, #065f46, #047857)', display:'flex', alignItems:'center', justifyContent:'center', fontSize: s(10) })}>🌾</div>
            </div>
          )}
          {/* Mão dir */}
          <div style={st({ position:'absolute', bottom: s(-6), left: '50%', transform: 'translateX(-50%)', width: s(14), height: s(14), borderRadius: '50%', background: config.skinTone })} />
        </div>
      </div>

      {/* ── Calça ── */}
      <div style={st({
        display: 'flex',
        gap: s(4),
        marginTop: s(-2),
        zIndex: 1,
      })}>
        {/* Perna esquerda */}
        <div style={st({
          width: s(26), height: s(52),
          background: config.outfit === 'agro'
            ? 'linear-gradient(160deg, #78350f, #92400e)'
            : 'linear-gradient(160deg, #1e3a5f, #0f2240)',
          borderRadius: `${s(4)}px ${s(4)}px ${s(6)}px ${s(6)}px`,
          transform: walking && frame === 1 ? `translateY(${s(legOffset)}px) rotate(-5deg)` : 'none',
          transformOrigin: 'top center',
          transition: 'transform 0.42s ease',
        })}>
          {/* Bota/Sapato esq */}
          <div style={st({
            position:'absolute', bottom: s(-8), left: s(-4),
            width: s(32), height: s(14),
            background: config.outfit === 'agro'
              ? 'linear-gradient(135deg, #4a2810, #3d2010)'
              : 'linear-gradient(135deg, #1a1a2e, #0d0d1a)',
            borderRadius: `${s(4)}px ${s(8)}px ${s(6)}px ${s(4)}px`,
            boxShadow: `0 ${s(4)}px ${s(8)}px rgba(0,0,0,0.4)`,
          })} />
          {config.outfit === 'agro' && config.accessory === 'botas-rurais' && (
            <div style={st({
              position:'absolute', bottom: s(0), left: s(-4), right: 0,
              height: s(20),
              background: 'linear-gradient(135deg, #6b3a1f, #4a2810)',
              borderRadius: `${s(4)}px ${s(4)}px 0 0`,
              border: `${s(1)}px solid #8b5a2b`,
            })} />
          )}
        </div>

        {/* Perna direita */}
        <div style={st({
          width: s(26), height: s(52),
          background: config.outfit === 'agro'
            ? 'linear-gradient(160deg, #92400e, #78350f)'
            : 'linear-gradient(160deg, #0f2240, #1e3a5f)',
          borderRadius: `${s(4)}px ${s(4)}px ${s(6)}px ${s(6)}px`,
          transform: walking && frame === 1 ? `translateY(${s(-legOffset)}px) rotate(5deg)` : 'none',
          transformOrigin: 'top center',
          transition: 'transform 0.42s ease',
        })}>
          {/* Bota/Sapato dir */}
          <div style={st({
            position:'absolute', bottom: s(-8), right: s(-4),
            width: s(32), height: s(14),
            background: config.outfit === 'agro'
              ? 'linear-gradient(135deg, #3d2010, #4a2810)'
              : 'linear-gradient(135deg, #0d0d1a, #1a1a2e)',
            borderRadius: `${s(8)}px ${s(4)}px ${s(4)}px ${s(6)}px`,
            boxShadow: `0 ${s(4)}px ${s(8)}px rgba(0,0,0,0.4)`,
          })} />
          {config.outfit === 'agro' && config.accessory === 'botas-rurais' && (
            <div style={st({
              position:'absolute', bottom: s(0), left: 0, right: s(-4),
              height: s(20),
              background: 'linear-gradient(135deg, #4a2810, #6b3a1f)',
              borderRadius: `${s(4)}px ${s(4)}px 0 0`,
              border: `${s(1)}px solid #8b5a2b`,
            })} />
          )}
        </div>
      </div>

      {/* ── Pódio / Sombra ── */}
      {showPodium && (
        <div style={st({
          marginTop: s(8),
          width: s(120),
          height: s(12),
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 70%, transparent)',
          borderRadius: s(6),
          position: 'relative',
        })}>
          <div style={st({
            position:'absolute', bottom: s(-6), left: '10%', right: '10%', height: s(6),
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '50%',
            filter: `blur(${s(4)}px)`,
          })} />
        </div>
      )}
    </div>
  )
}
