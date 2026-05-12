'use client'
import { useEffect, useState } from 'react'

export type SkinTone = 'light'|'medium-light'|'medium'|'medium-dark'|'dark'|'deep'
export type HairStyle = 0|1|2|3|4|5
export type BeardStyle = 'none'|'stubble'|'full'
export type GlassesStyle = 'none'|'round'|'rectangular'
export type OutfitStyle = 'corporativo'|'agro'
export type AccessoryType = 'none'|'chapeu-palha'|'chapeu-couro'|'bone'|'gravata'|'caneta'|'tablet'|'pasta'

export interface SpriteConfig {
  gender: 'male'|'female'
  skinTone: SkinTone
  hairStyle: HairStyle
  hairColor: number
  beard: BeardStyle
  glasses: GlassesStyle
  outfit: OutfitStyle
  accessory: AccessoryType
}

export const DEFAULT_SPRITE_CONFIG: SpriteConfig = {
  gender:'male', skinTone:'medium-light', hairStyle:0, hairColor:0,
  beard:'none', glasses:'none', outfit:'corporativo', accessory:'none',
}

export const SKIN_TONES_DATA = [
  { id:'light'        as SkinTone, color:'#fde8d0', label:'Clara'       },
  { id:'medium-light' as SkinTone, color:'#f4c28a', label:'Média-clara' },
  { id:'medium'       as SkinTone, color:'#d4956a', label:'Média'       },
  { id:'medium-dark'  as SkinTone, color:'#b07040', label:'Média-esc.'  },
  { id:'dark'         as SkinTone, color:'#7d4c27', label:'Escura'      },
  { id:'deep'         as SkinTone, color:'#4a2912', label:'Profunda'    },
]

export const HAIR_COLORS_DATA = [
  '#1a1a1a','#3d2a1a','#6b3a1f','#c8922a','#b4b4b4','#8b2635','#c89060','#4a3728',
]

// ── Colour indices ─────────────────────────────────────────────────────────
// 0=transparent 1=hair 2=skin 3=pupil 4=outfit 5=outfitDark 6=pants 7=pantsDark
// 8=shoes 9=accent(button/belt) 10=blush 11=skinShadow 12=white(collar) 13=mouth

// ── Male base frame 0 (standing) — 16×24 ──────────────────────────────────
const M0: number[][] = [
  [0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,1,2,2,2,2,2,2,2,1,1,0,0,0,0],
  [0,0,1,2,3,2,2,2,2,3,2,1,0,0,0,0],
  [0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,0],
  [0,0,1,2,2,2,11,2,11,2,2,1,0,0,0,0],
  [0,0,1,2,10,2,13,13,2,10,2,1,0,0,0,0],
  [0,0,0,1,2,2,2,2,2,2,1,0,0,0,0,0],
  [0,0,0,0,2,2,2,2,2,0,0,0,0,0,0,0],
  [0,4,4,4,4,4,4,4,4,4,4,4,0,0,0,0],
  [0,4,5,4,4,12,12,12,4,4,5,4,0,0,0,0],
  [0,4,5,5,4,12,4,4,12,4,5,5,4,0,0,0,0],
  [0,4,5,4,4,4,4,4,4,4,4,5,4,0,0,0,0],
  [0,4,4,4,4,4,9,4,4,4,4,4,4,0,0,0,0],
  [0,4,4,4,4,4,4,4,4,4,4,4,4,0,0,0,0],
  [0,4,4,4,4,4,4,4,4,4,4,4,4,0,0,0,0],
  [0,0,6,6,6,6,0,0,6,6,6,6,0,0,0,0],
  [0,0,6,6,6,6,0,0,6,6,6,6,0,0,0,0],
  [0,0,7,6,6,0,0,0,0,6,6,7,0,0,0,0],
  [0,0,6,6,6,0,0,0,0,6,6,6,0,0,0,0],
  [0,0,6,6,6,0,0,0,0,6,6,6,0,0,0,0],
  [0,0,6,6,6,0,0,0,0,6,6,6,0,0,0,0],
  [0,0,8,8,8,0,0,0,0,8,8,8,0,0,0,0],
  [0,8,8,8,8,8,0,0,8,8,8,8,8,0,0,0],
]

// ── Male frame 1 (walk) ────────────────────────────────────────────────────
const M1: number[][] = [
  ...M0.slice(0,16),
  [0,0,6,6,6,6,6,0,6,6,6,0,0,0,0,0],
  [0,0,6,6,6,6,0,0,0,6,6,6,0,0,0,0],
  [0,0,7,6,6,0,0,0,0,0,6,7,0,0,0,0],
  [0,0,6,6,0,0,0,0,0,0,6,6,0,0,0,0],
  [0,0,6,6,0,0,0,0,0,0,6,6,0,0,0,0],
  [0,0,0,6,6,0,0,0,0,6,6,0,0,0,0,0],
  [0,0,0,8,8,0,0,0,0,8,8,0,0,0,0,0],
  [0,0,8,8,8,8,0,0,8,8,8,8,0,0,0,0],
]

// ── Female base frame 0 — 16×24 (saia + tranças + cílios) ───────────────
const F0: number[][] = [
  [0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],  // 0 hair top (wider)
  [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],  // 1 hair wider
  [1,1,1,2,2,2,2,2,2,2,1,1,1,1,0,0],  // 2 hair sides (pigtail starts col 0)
  [1,2,2,2,3,2,2,2,2,3,2,2,2,1,0,0],  // 3 eyelash row (3=dark above eye)
  [1,2,2,2,3,3,2,2,3,3,2,2,2,1,0,0],  // 4 eyes (double-pixel = bigger/feminine)
  [1,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0],  // 5 face
  [1,2,2,2,2,2,11,2,11,2,2,2,2,1,0,0],// 6 nose
  [1,2,10,2,2,13,13,13,2,2,10,2,2,1,0,0],// 7 blush+wide smile+lipstick
  [0,1,1,2,2,2,2,2,2,2,2,1,1,0,0,0],  // 8 chin
  [0,0,0,0,2,2,2,2,2,0,0,0,0,0,0,0],  // 9 neck
  [1,4,4,4,4,4,4,4,4,4,4,4,4,1,0,0],  // 10 shoulders (col 0,13 = pigtails)
  [1,4,5,4,4,12,12,12,4,4,5,4,4,1,0,0],// 11 collar
  [1,4,5,5,4,12,4,4,12,4,5,5,4,1,0,0],// 12 lapels
  [1,4,5,4,4,4,4,9,4,4,4,5,4,1,0,0],  // 13 button
  [1,4,4,4,4,4,4,4,4,4,4,4,4,1,0,0],  // 14 torso
  [0,4,4,4,4,4,4,4,4,4,4,4,4,0,0,0],  // 15 torso low (pigtail ends)
  // SAIA — silhueta A-line
  [0,0,4,4,4,4,4,4,4,4,4,4,0,0,0,0],  // 16 saia topo
  [0,0,4,4,4,4,4,4,4,4,4,4,4,0,0,0],  // 17 saia alarga
  [0,4,4,4,4,4,4,4,4,4,4,4,4,4,0,0],  // 18 saia larga
  [0,4,4,4,4,4,4,4,4,4,4,4,4,4,0,0],  // 19 saia larga
  [0,4,5,4,4,4,4,4,4,4,4,4,5,4,0,0],  // 20 saia barra (shadow)
  [0,0,6,6,0,0,0,0,0,0,6,6,0,0,0,0],  // 21 pernas saem da saia
  [0,0,6,6,0,0,0,0,0,0,6,6,0,0,0,0],  // 22 pernas
  [0,8,8,8,8,0,0,0,0,8,8,8,8,0,0,0],  // 23 sapatos (mais largos)
]


// ── Female frame 1 (walk — saia balança, pernas alternam) ─────────────────
const F1: number[][] = [
  ...F0.slice(0,16),
  // Saia igual (não muda)
  [0,0,4,4,4,4,4,4,4,4,4,4,0,0,0,0],
  [0,0,4,4,4,4,4,4,4,4,4,4,4,0,0,0],
  [0,4,4,4,4,4,4,4,4,4,4,4,4,4,0,0],
  [0,4,4,4,4,4,4,4,4,4,4,4,4,4,0,0],
  [0,4,5,4,4,4,4,4,4,4,4,4,5,4,0,0],
  // Pernas em posição alternada
  [0,0,6,6,6,0,0,0,0,0,6,0,0,0,0,0],
  [0,0,0,6,6,0,0,0,0,0,6,6,0,0,0,0],
  [0,0,8,8,8,8,0,0,0,8,8,8,8,0,0,0],
]


// ── Hairstyle overlays (rows 0-8, applied on top of base) ─────────────────
// Female long hair sides rows 2-7 extend to col 0 and col 12 (already in F0)
// Male variants rows 0-2 only
const HAIR_MALE: Record<HairStyle, number[][]> = {
  0: [ // classic side-part
    [0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
    [0,0,1,1,2,2,2,2,2,2,1,1,0,0,0,0],
  ],
  1: [ // short buzz
    [0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,1,1,2,2,2,2,2,2,1,1,0,0,0,0],
  ],
  2: [ // wavy
    [0,0,1,1,1,0,1,1,0,1,1,0,0,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,1,1,2,2,2,2,2,2,1,1,0,0,0,0],
  ],
  3: [ // bald / very short
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,1,1,2,2,2,2,2,2,1,1,0,0,0,0],
  ],
  4: [ // side sweep left
    [0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,1,1,2,2,2,2,2,2,1,1,0,0,0,0],
  ],
  5: [ // long (extra rows 3-7 hair on sides)
    [0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
    [0,1,1,2,2,2,2,2,2,2,1,1,1,0,0,0],
  ],
}

// ── Accessory overlays ─────────────────────────────────────────────────────
// Each is {r, c, color} relative to top of character (row 0)
type Px = { r:number; c:number; color:string }

const HAT_PALHA: Px[] = [
  // brim
  ...[0,1,2,3,4,5,6,7,8,9,10,11].map(c=>({r:-1,c,color:'#c49230'})),
  // crown
  ...[3,4,5,6,7,8].map(c=>({r:-4,c,color:'#b8841e'})),
  ...[3,4,5,6,7,8].map(c=>({r:-3,c,color:'#b8841e'})),
  ...[3,4,5,6,7,8].map(c=>({r:-2,c,color:'#c49230'})),
  {r:-2,c:3,color:'#a07820'},{r:-2,c:8,color:'#a07820'},
  // band
  ...[3,4,5,6,7,8].map(c=>({r:-1,c,color:'#c49230'})),
  {r:-2,c:4,color:'#8b6010'},{r:-2,c:5,color:'#8b6010'},{r:-2,c:6,color:'#8b6010'},{r:-2,c:7,color:'#8b6010'},
]

const HAT_COURO: Px[] = [
  ...[0,1,2,3,4,5,6,7,8,9,10,11].map(c=>({r:-1,c,color:'#4a2810'})),
  ...[3,4,5,6,7,8].map(c=>({r:-4,c,color:'#3d2010'})),
  ...[3,4,5,6,7,8].map(c=>({r:-3,c,color:'#3d2010'})),
  ...[3,4,5,6,7,8].map(c=>({r:-2,c,color:'#5c3420'})),
  {r:-2,c:4,color:'#8b5a2b'},{r:-2,c:5,color:'#8b5a2b'},{r:-2,c:6,color:'#8b5a2b'},{r:-2,c:7,color:'#8b5a2b'},
]

const BONE: Px[] = [
  // bill
  ...[2,3,4,5,6,7,8,9].map(c=>({r:1,c,color:'#1a1a2e'})),
  // crown
  ...[3,4,5,6,7,8].map(c=>({r:-2,c,color:'#2d3561'})),
  ...[3,4,5,6,7,8].map(c=>({r:-1,c,color:'#2d3561'})),
  ...[2,3,4,5,6,7,8,9].map(c=>({r:0,c,color:'#2d3561'})),
  {r:-1,c:5,color:'#fbbf24'},{r:-1,c:6,color:'#fbbf24'},
]

// Agro outfit overlay (rows 9-15): adds vest pattern over base
const AGRO_OVERLAY: Px[] = [
  // vest
  {r:10,c:1,color:'#5c3d1a'},{r:10,c:2,color:'#5c3d1a'},{r:10,c:9,color:'#5c3d1a'},{r:10,c:10,color:'#5c3d1a'},
  {r:11,c:1,color:'#5c3d1a'},{r:11,c:2,color:'#5c3d1a'},{r:11,c:9,color:'#5c3d1a'},{r:11,c:10,color:'#5c3d1a'},
  {r:12,c:1,color:'#6b4423'},{r:12,c:2,color:'#6b4423'},{r:12,c:9,color:'#6b4423'},{r:12,c:10,color:'#6b4423'},
  {r:13,c:1,color:'#6b4423'},{r:13,c:2,color:'#6b4423'},{r:13,c:9,color:'#6b4423'},{r:13,c:10,color:'#6b4423'},
  {r:14,c:1,color:'#5c3d1a'},{r:14,c:2,color:'#5c3d1a'},{r:14,c:9,color:'#5c3d1a'},{r:14,c:10,color:'#5c3d1a'},
  {r:15,c:1,color:'#5c3d1a'},{r:15,c:2,color:'#5c3d1a'},{r:15,c:9,color:'#5c3d1a'},{r:15,c:10,color:'#5c3d1a'},
]

const BEARD_STUBBLE: Px[] = [
  {r:6,c:4,color:'#0000003a'},{r:6,c:5,color:'#0000003a'},{r:6,c:6,color:'#0000003a'},{r:6,c:7,color:'#0000003a'},
  {r:7,c:3,color:'#0000003a'},{r:7,c:4,color:'#0000003a'},{r:7,c:7,color:'#0000003a'},{r:7,c:8,color:'#0000003a'},
]

const BEARD_FULL: Px[] = [
  ...[4,5,6,7].map(c=>({r:6,c,color:'#00000055'})),
  ...[3,4,5,6,7,8].map(c=>({r:7,c,color:'#00000055'})),
]

// ── Colour palette builder ─────────────────────────────────────────────────
function palette(cfg: SpriteConfig): Record<number,string> {
  const skinMap: Record<SkinTone,string> = {
    'light':'#fde8d0','medium-light':'#f4c28a','medium':'#d4956a',
    'medium-dark':'#b07040','dark':'#7d4c27','deep':'#4a2912',
  }
  const skinShadow: Record<SkinTone,string> = {
    'light':'#e8b48a','medium-light':'#c8845a','medium':'#a06040',
    'medium-dark':'#7a4820','dark':'#4e2e10','deep':'#2a1408',
  }
  const hair = HAIR_COLORS_DATA[cfg.hairColor] ?? '#1a1a1a'
  const sk = skinMap[cfg.skinTone]
  const ss = skinShadow[cfg.skinTone]
  const isCorp = cfg.outfit === 'corporativo'
  const outfitPrimary = isCorp ? '#1e3a5f' : '#4e7028'
  const outfitDark    = isCorp ? '#0f2240' : '#3d5a1e'
  const pantsPrimary  = isCorp ? '#1a2a40' : '#78350f'
  const pantsDark     = isCorp ? '#0d1a28' : '#5a2808'
  const shoeColor     = isCorp ? '#1a1a2e' : '#3d2010'
  const accent        = isCorp ? '#c0cce0' : '#d4a853'

  return {
    0:'transparent', 1:hair, 2:sk, 3:'#1a1010', 4:outfitPrimary,
    5:outfitDark, 6:pantsPrimary, 7:pantsDark, 8:shoeColor,
    9:accent, 10:'rgba(255,120,100,0.35)', 11:ss, 12:'#f0f4f8', 13:'#c45c5c',
  }
}

// ── Box-shadow builder ─────────────────────────────────────────────────────
function buildShadow(grid: number[][], pal: Record<number,string>, px: number): string {
  const parts: string[] = []
  grid.forEach((row, r) => row.forEach((v, c) => {
    if (v === 0) return
    parts.push(`${c*px}px ${r*px}px 0 0 ${pal[v] ?? 'transparent'}`)
  }))
  return parts.join(',')
}

function buildCustomShadow(pixels: Px[], px: number, rowOffset=0): string {
  return pixels.map(p =>
    `${p.c*px}px ${(p.r+rowOffset)*px}px 0 0 ${p.color}`
  ).join(',')
}

// ── Component ──────────────────────────────────────────────────────────────
interface Props {
  config: SpriteConfig
  pixelSize?: number
  walking?: boolean
  showPodium?: boolean
}

export default function AvatarSprite({ config, pixelSize=5, walking=false, showPodium=true }: Props) {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    if (!walking) { setFrame(0); return }
    const t = setInterval(() => setFrame(f => 1-f), 420)
    return () => clearInterval(t)
  }, [walking])

  const pal = palette(config)
  const px = pixelSize
  const baseFrames = config.gender === 'male' ? [M0,M1] : [F0,F1]
  const baseGrid = baseFrames[frame]
  const W = 16*px
  const H = 24*px
  const HAT_OFFSET = 6 // rows above character top

  // Main body shadow
  const bodyShadow = buildShadow(baseGrid, pal, px)

  // Hair override (only top 3 rows)
  const hairStyle = config.hairStyle
  const hairRows = config.gender === 'male' ? HAIR_MALE[hairStyle] : null
  const hairShadow = hairRows ? buildShadow(hairRows, pal, px) : ''

  // Agro overlay
  const agroShadow = config.outfit === 'agro' ? buildCustomShadow(AGRO_OVERLAY, px) : ''

  // Beard
  const beardShadow = config.beard === 'stubble' ? buildCustomShadow(BEARD_STUBBLE, px)
    : config.beard === 'full' ? buildCustomShadow(BEARD_FULL, px) : ''

  // Hat
  const hatPx: Px[] = config.accessory === 'chapeu-palha' ? HAT_PALHA
    : config.accessory === 'chapeu-couro' ? HAT_COURO
    : config.accessory === 'bone' ? BONE : []
  const hatShadow = hatPx.length > 0 ? buildCustomShadow(hatPx, px, HAT_OFFSET) : ''

  // Glasses overlay
  const glassesShadow = (() => {
    if (config.glasses === 'none') return ''
    const gc = '#4b5563'
    const gPx: Px[] = config.glasses === 'round'
      ? [{r:3,c:3,color:gc},{r:3,c:4,color:'rgba(147,197,253,0.3)'},{r:3,c:8,color:gc},{r:3,c:9,color:'rgba(147,197,253,0.3)'},{r:4,c:3,color:gc},{r:4,c:9,color:gc},{r:3,c:6,color:gc},{r:3,c:7,color:gc}]
      : [{r:3,c:3,color:gc},{r:3,c:4,color:'rgba(147,197,253,0.3)'},{r:3,c:5,color:'rgba(147,197,253,0.3)'},{r:3,c:8,color:gc},{r:3,c:9,color:'rgba(147,197,253,0.3)'},{r:3,c:10,color:'rgba(147,197,253,0.3)'},{r:4,c:3,color:gc},{r:4,c:10,color:gc},{r:3,c:6,color:gc},{r:3,c:7,color:gc}]
    return buildCustomShadow(gPx, px)
  })()

  const extraTop = HAT_OFFSET * px

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap: 8 }}>
      <div style={{ position:'relative', width:W, height:H + extraTop }}>
        {/* Hat */}
        {hatShadow && (
          <div style={{ position:'absolute', top:0, left:0, width:px, height:px, boxShadow:hatShadow, imageRendering:'pixelated' }}/>
        )}
        {/* Body */}
        <div style={{ position:'absolute', top:extraTop, left:0, width:px, height:px, boxShadow:bodyShadow, imageRendering:'pixelated' }}/>
        {/* Hair override */}
        {hairShadow && (
          <div style={{ position:'absolute', top:extraTop, left:0, width:px, height:px, boxShadow:hairShadow, imageRendering:'pixelated', pointerEvents:'none' }}/>
        )}
        {/* Agro vest */}
        {agroShadow && (
          <div style={{ position:'absolute', top:extraTop, left:0, width:px, height:px, boxShadow:agroShadow, imageRendering:'pixelated', pointerEvents:'none' }}/>
        )}
        {/* Beard */}
        {beardShadow && (
          <div style={{ position:'absolute', top:extraTop, left:0, width:px, height:px, boxShadow:beardShadow, imageRendering:'pixelated', pointerEvents:'none' }}/>
        )}
        {/* Glasses */}
        {glassesShadow && (
          <div style={{ position:'absolute', top:extraTop, left:0, width:px, height:px, boxShadow:glassesShadow, imageRendering:'pixelated', pointerEvents:'none' }}/>
        )}
      </div>
      {/* Podium */}
      {showPodium && (
        <div style={{ width: W+px*2, height: px*2, background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.1) 40%,rgba(255,255,255,0.18) 50%,rgba(255,255,255,0.1) 60%,transparent)', borderRadius:px }}/>
      )}
    </div>
  )
}
