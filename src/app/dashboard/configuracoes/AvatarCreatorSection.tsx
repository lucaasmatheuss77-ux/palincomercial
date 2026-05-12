'use client'

import { useState, useTransition, useCallback } from 'react'
import { toast } from 'sonner'
import { Check, RefreshCw, Save, Eye, User, Shirt, RotateCcw } from 'lucide-react'
import AvatarSprite, {
  type SpriteConfig,
  type SkinTone,
  type HairStyle,
  type BeardStyle,
  type GlassesStyle,
  type OutfitStyle,
  type AccessoryType,
  DEFAULT_SPRITE_CONFIG,
  SKIN_TONES_DATA,
  HAIR_COLORS_DATA,
} from '@/components/AvatarSprite'
// Avatar3D.tsx replaced by AvatarSprite (pixel art)
import { saveAvatarSkin } from '@/app/actions/profile'
import type { AvatarSkin } from '@/components/avatar-utils'

// ── Data ──────────────────────────────────────────────────────────────────
const HAIRSTYLES: { id: HairStyle; label: string }[] = [
  { id: 0, label: 'Clássico' }, { id: 1, label: 'Curto'    },
  { id: 2, label: 'Ondulado' }, { id: 3, label: 'Raspado'  },
  { id: 4, label: 'Lateral'  }, { id: 5, label: 'Longo'    },
]
const BEARDS: { id: BeardStyle; label: string; emoji: string }[] = [
  { id: 'none',    label: 'Sem barba',   emoji: '🧑' },
  { id: 'stubble', label: 'Cavanhaque',  emoji: '🧔' },
  { id: 'full',    label: 'Barba cheia', emoji: '🧔‍♂️' },
]
const GLASSES: { id: GlassesStyle; label: string; emoji: string }[] = [
  { id: 'none',        label: 'Sem óculos',  emoji: '👀' },
  { id: 'round',       label: 'Redondo',     emoji: '🕶️' },
  { id: 'rectangular', label: 'Retangular',  emoji: '👓' },
]
const OUTFIT_TABS: { id: OutfitStyle; label: string; icon: string }[] = [
  { id: 'agro',        label: 'AGRO',       icon: '🌾' },
  { id: 'corporativo', label: 'CORPORATIVO', icon: '💼' },
]
const ACCESSORIES: Record<OutfitStyle | 'extra', { id: AccessoryType; label: string; emoji: string }[]> = {
  agro: [
    { id: 'chapeu-palha', label: 'Chapéu Palha',  emoji: '👒' },
    { id: 'chapeu-couro', label: 'Chapéu Couro',  emoji: '🤠' },
    { id: 'bone',         label: 'Boné',           emoji: '🧢' },
    { id: 'tablet',       label: 'Tablet Campo',   emoji: '📱' },
  ],
  corporativo: [
    { id: 'bone',    label: 'Boné',       emoji: '🧢' },
    { id: 'gravata', label: 'Gravata',    emoji: '👔' },
    { id: 'pasta',   label: 'Pasta Exec.',emoji: '🗂️' },
    { id: 'caneta',  label: 'Caneta Luxo',emoji: '🖊️' },
  ],
  extra: [
    { id: 'none', label: 'Sem acessório', emoji: '✖️' },
  ],
}

interface Props {
  initialSkin?: number | null
  initialAccessory?: string | null
  role?: string
  userName?: string
}

// ── Mini pill button ───────────────────────────────────────────────────────
function Pill({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 3,
      padding: '8px 6px', borderRadius: 10, minWidth: 56,
      background: active ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.02)',
      border: `1.5px solid ${active ? 'rgba(251,191,36,0.45)' : 'rgba(255,255,255,0.07)'}`,
      cursor: 'pointer', color: active ? '#fbbf24' : '#64748b',
      fontSize: '0.62rem', fontWeight: active ? 800 : 600,
      boxShadow: active ? '0 0 10px rgba(251,191,36,0.15)' : 'none',
      transition: 'all 0.15s ease',
    }}>
      {children}
      {active && <Check size={7} color="#fbbf24" strokeWidth={3}/>}
    </button>
  )
}

// ── Section label ──────────────────────────────────────────────────────────
function SLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '0.55rem', fontWeight: 900, color: '#475569',
      textTransform: 'uppercase' as const, letterSpacing: '0.13em', marginBottom: 8,
    }}>{children}</div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function AvatarCreatorSection({ initialSkin, userName }: Props) {
  const validSkin = (typeof initialSkin === 'number' && initialSkin >= 0 && initialSkin <= 6
    ? initialSkin : 0) as AvatarSkin

  const [cfg, setCfg]         = useState<SpriteConfig>({ ...DEFAULT_SPRITE_CONFIG })
  const [outfitTab, setTab]   = useState<OutfitStyle>('corporativo')
  const [accTab, setAccTab]   = useState<'items' | 'extra'>('items')
  const [walking, setWalking] = useState(true)
  const [saved, setSaved]     = useState(false)
  const [isPending, start]    = useTransition()

  const set = useCallback(<K extends keyof SpriteConfig>(k: K, v: SpriteConfig[K]) => {
    setCfg(p => ({ ...p, [k]: v }))
    setSaved(false)
  }, [])

  function handleSave() {
    start(async () => {
      const r = await saveAvatarSkin(validSkin, cfg.accessory)
      if (r.success) {
        setSaved(true)
        toast.success('Avatar salvo!', { description: `${cfg.outfit === 'agro' ? '🌾 Agro' : '💼 Corporativo'} · ${cfg.gender === 'male' ? 'Masculino' : 'Feminino'}` })
      } else {
        toast.error(r.error ?? 'Erro ao salvar avatar.')
      }
    })
  }

  const visibleAccs = [
    ...(accTab === 'items' ? ACCESSORIES[outfitTab] : ACCESSORIES.extra),
  ]

  const isAgro = cfg.outfit === 'agro'
  const accentColor = isAgro ? '#10b981' : '#3b82f6'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22 }}>🎨</span>
        <div>
          <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 900, color: 'var(--brand-primary)', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>
            Criador de Avatar
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--brand-muted)' }}>
            Personalize seu personagem — aparece no ranking, equipe e celebrações
          </p>
        </div>
      </div>

      {/* ── 3-Column Layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 220px', gap: 14, alignItems: 'start' }}>

        {/* ═══ LEFT PANEL — APARÊNCIA BASE ═══ */}
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16, padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 18,
        }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--brand-primary)', textTransform: 'uppercase' as const, letterSpacing: '0.13em', display: 'flex', gap: 5, alignItems: 'center' }}>
            <User size={10}/> APARÊNCIA BASE
          </div>

          {/* Gênero */}
          <div>
            <SLabel>Gênero</SLabel>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['male','female'] as const).map(g => (
                <Pill key={g} active={cfg.gender === g} onClick={() => set('gender', g)}>
                  <span style={{ fontSize: '1.1rem' }}>{g === 'male' ? '♂' : '♀'}</span>
                  <span>{g === 'male' ? 'Masculino' : 'Feminino'}</span>
                </Pill>
              ))}
            </div>
          </div>

          {/* Tom de pele */}
          <div>
            <SLabel>Tom de Pele</SLabel>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' as const }}>
              {SKIN_TONES_DATA.map(t => (
                <button key={t.id} type="button" title={t.label} onClick={() => set('skinTone', t.id as SkinTone)}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', background: t.color, padding: 0, cursor: 'pointer',
                    border: `2.5px solid ${cfg.skinTone === t.id ? '#fbbf24' : 'transparent'}`,
                    transform: cfg.skinTone === t.id ? 'scale(1.18)' : 'scale(1)',
                    boxShadow: cfg.skinTone === t.id ? '0 0 10px rgba(251,191,36,0.5)' : '0 2px 4px rgba(0,0,0,0.4)',
                    transition: 'all 0.15s ease',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Cor do cabelo */}
          <div>
            <SLabel>Cor do Cabelo</SLabel>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' as const }}>
              {HAIR_COLORS_DATA.map((c, i) => (
                <button key={i} type="button" title={`Cor ${i + 1}`} onClick={() => set('hairColor', i)}
                  style={{
                    width: 24, height: 24, borderRadius: '50%', background: c, padding: 0, cursor: 'pointer',
                    border: `2.5px solid ${cfg.hairColor === i ? '#fbbf24' : 'transparent'}`,
                    transform: cfg.hairColor === i ? 'scale(1.18)' : 'scale(1)',
                    boxShadow: cfg.hairColor === i ? '0 0 8px rgba(251,191,36,0.5)' : '0 2px 4px rgba(0,0,0,0.4)',
                    transition: 'all 0.15s ease',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Penteado */}
          <div>
            <SLabel>Penteado</SLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {HAIRSTYLES.map(h => (
                <Pill key={h.id} active={cfg.hairStyle === h.id} onClick={() => set('hairStyle', h.id)}>
                  <span style={{ fontSize: '0.9rem' }}>💇</span>
                  <span style={{ fontSize: '0.55rem' }}>{h.label}</span>
                </Pill>
              ))}
            </div>
          </div>

          {/* Barba */}
          <div>
            <SLabel>Barba / Facial</SLabel>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
              {BEARDS.map(b => (
                <Pill key={b.id} active={cfg.beard === b.id} onClick={() => set('beard', b.id)}>
                  <span style={{ fontSize: '0.9rem' }}>{b.emoji}</span>
                  <span style={{ fontSize: '0.55rem' }}>{b.label}</span>
                </Pill>
              ))}
            </div>
          </div>

          {/* Óculos */}
          <div>
            <SLabel>Óculos</SLabel>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
              {GLASSES.map(g => (
                <Pill key={g.id} active={cfg.glasses === g.id} onClick={() => set('glasses', g.id)}>
                  <span style={{ fontSize: '0.9rem' }}>{g.emoji}</span>
                  <span style={{ fontSize: '0.55rem' }}>{g.label}</span>
                </Pill>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ CENTER — AVATAR PREVIEW ═══ */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          padding: '24px 16px 20px', minHeight: 500,
          background: `radial-gradient(ellipse at 50% 25%, ${accentColor}0f 0%, rgba(13,17,23,0.96) 65%)`,
          border: `1px solid ${accentColor}20`,
          borderRadius: 20, position: 'relative', overflow: 'hidden',
          transition: 'border-color 0.4s ease, background 0.4s ease',
        }}>
          {/* Decorative bokeh bg */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            {[[12,20,40],[70,60,60],[88,80,35],[30,70,50],[55,40,30]].map(([x,y,s], i) => (
              <div key={i} style={{
                position: 'absolute', left: `${x}%`, top: `${y}%`,
                width: s, height: s, borderRadius: '50%',
                background: i % 2 === 0 ? `${accentColor}18` : 'rgba(251,191,36,0.08)',
                filter: 'blur(8px)',
              }}/>
            ))}
          </div>

          {/* Label */}
          <div style={{ fontSize: '0.55rem', fontWeight: 900, color: '#1e293b', textTransform: 'uppercase' as const, letterSpacing: '0.14em', zIndex: 1 }}>
            CRIADOR DE AVATAR · ANTIGRAVITY
          </div>

          {/* Avatar */}
          <div style={{
            zIndex: 1, cursor: 'pointer',
            filter: `drop-shadow(0 12px 32px ${accentColor}30)`,
            transition: 'filter 0.4s ease',
          }}
            onClick={() => setWalking(w => !w)}
            title="Clique para animar"
          >
            <AvatarSprite config={cfg} pixelSize={8} walking={walking} showPodium/>
          </div>

          {/* Name & badge */}
          <div style={{ textAlign: 'center', zIndex: 1 }}>
            <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#f8fafc', marginBottom: 4 }}>
              {userName || 'Colaborador'}
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 14px', borderRadius: 999,
              background: `${accentColor}18`,
              border: `1px solid ${accentColor}35`,
              fontSize: '0.65rem', fontWeight: 700, color: accentColor,
              transition: 'all 0.3s ease',
            }}>
              {isAgro ? '🌾 Setor Agro' : '💼 Setor Corporativo'}
            </div>
          </div>

          {/* Walk hint */}
          <div style={{ fontSize: '0.58rem', color: '#1e293b', marginTop: 'auto', zIndex: 1 }}>
            {walking ? '🚶 Clique para pausar' : '⏸️ Clique para animar'}
          </div>
        </div>

        {/* ═══ RIGHT PANEL — ROUPAS & ACESSÓRIOS ═══ */}
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16, padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 18,
        }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--brand-primary)', textTransform: 'uppercase' as const, letterSpacing: '0.13em', display: 'flex', gap: 5, alignItems: 'center' }}>
            <Shirt size={10}/> VESTUÁRIO &amp; ACESSÓRIOS
          </div>

          {/* Outfit tabs */}
          <div>
            <SLabel>Estilo de Roupa</SLabel>
            <div style={{ display: 'flex', gap: 6 }}>
              {OUTFIT_TABS.map(t => (
                <button key={t.id} type="button"
                  onClick={() => { set('outfit', t.id); setTab(t.id); setAccTab('items') }}
                  style={{
                    flex: 1, padding: '8px 6px', borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    background: outfitTab === t.id ? `${accentColor}15` : 'rgba(255,255,255,0.02)',
                    border: `1.5px solid ${outfitTab === t.id ? `${accentColor}45` : 'rgba(255,255,255,0.07)'}`,
                    cursor: 'pointer',
                    color: outfitTab === t.id ? accentColor : '#64748b',
                    fontSize: '0.62rem', fontWeight: outfitTab === t.id ? 900 : 600,
                    boxShadow: outfitTab === t.id ? `0 0 14px ${accentColor}20` : 'none',
                    transition: 'all 0.15s ease',
                  }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Accessory sub-tabs */}
          <div>
            <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
              {(['items', 'extra'] as const).map(tab => (
                <button key={tab} type="button" onClick={() => setAccTab(tab)}
                  style={{
                    flex: 1, padding: '5px 4px', borderRadius: 8,
                    fontSize: '0.58rem', fontWeight: accTab === tab ? 800 : 600,
                    background: accTab === tab ? 'rgba(251,191,36,0.1)' : 'transparent',
                    border: `1px solid ${accTab === tab ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.05)'}`,
                    color: accTab === tab ? '#fbbf24' : '#475569',
                    cursor: 'pointer', transition: 'all 0.15s ease',
                  }}>
                  {tab === 'items' ? (outfitTab === 'agro' ? '🌾 Itens Agro' : '💼 Itens Corp.') : '✖️ Sem Ac.'}
                </button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              {visibleAccs.map(a => (
                <Pill key={a.id} active={cfg.accessory === a.id} onClick={() => set('accessory', a.id)}>
                  <span style={{ fontSize: '1.1rem' }}>{a.emoji}</span>
                  <span style={{ fontSize: '0.52rem', textAlign: 'center' as const }}>{a.label}</span>
                </Pill>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div style={{
            padding: '12px', borderRadius: 12,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}>
            <SLabel>Configuração atual</SLabel>
            {[
              { label: 'Gênero',    val: cfg.gender === 'male' ? 'Masculino' : 'Feminino' },
              { label: 'Estilo',    val: cfg.outfit === 'agro' ? '🌾 Agro' : '💼 Corporativo' },
              { label: 'Acessório', val: [...ACCESSORIES.agro, ...ACCESSORIES.corporativo, ...ACCESSORIES.extra].find(a => a.id === cfg.accessory)?.label ?? 'Nenhum' },
              { label: 'Óculos',    val: GLASSES.find(g => g.id === cfg.glasses)?.label ?? '—' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.63rem', marginBottom: 4 }}>
                <span style={{ color: '#334155' }}>{row.label}</span>
                <span style={{ color: '#94a3b8', fontWeight: 700 }}>{row.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Action Buttons ── */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'center', marginTop: 16,
        paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)',
        flexWrap: 'wrap' as const,
      }}>
        <button type="button" onClick={() => setWalking(w => !w)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 12,
            background: 'transparent', border: '1px solid rgba(0,212,170,0.3)',
            cursor: 'pointer', color: '#00d4aa', fontWeight: 700, fontSize: '0.82rem',
          }}>
          <Eye size={15}/> VISUALIZAR
        </button>

        <button type="button" onClick={() => setWalking(false)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 12,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
            cursor: 'pointer', color: '#64748b', fontWeight: 700, fontSize: '0.82rem',
          }}>
          <RotateCcw size={14}/> PAUSAR
        </button>

        <button type="button" onClick={handleSave} disabled={isPending}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 12,
            background: saved ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#b8880a,#fbbf24 50%,#d4970c)',
            border: 'none', cursor: isPending ? 'wait' : 'pointer',
            color: '#0a0600', fontWeight: 900, fontSize: '0.88rem', opacity: isPending ? 0.7 : 1,
            boxShadow: saved ? '0 0 24px rgba(16,185,129,0.3)' : '0 0 24px rgba(251,191,36,0.25)',
            transition: 'all 0.2s ease',
          }}>
          {isPending ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }}/> : saved ? <Check size={15}/> : <Save size={15}/>}
          {isPending ? 'Salvando...' : saved ? 'Salvo!' : 'SALVAR AVATAR'}
        </button>

        <button type="button" onClick={() => { setCfg({ ...DEFAULT_SPRITE_CONFIG }); setSaved(false) }} disabled={isPending}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 12,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
            cursor: 'pointer', color: '#475569', fontWeight: 600, fontSize: '0.82rem',
          }}>
          <RefreshCw size={13}/> REDEFINIR
        </button>

        <p style={{ fontSize: '0.68rem', color: '#1e293b', marginLeft: 'auto' }}>
          Visível no ranking, equipe e celebrações
        </p>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
