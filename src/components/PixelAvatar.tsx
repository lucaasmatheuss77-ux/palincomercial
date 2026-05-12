'use client'

/**
 * PixelAvatar — Avatar pixel art puro em CSS (técnica box-shadow).
 * 7 skins distintos. Walk cycle animado (2 frames).
 * Adereços automáticos por role: chapéu+botina (rural), calculadora (backoffice),
 * maleta (consultor), coroa (líder). Customizável por accessory manual.
 * Sem imagens externas, sem Canvas, sem SVG.
 */

import { useEffect, useState } from 'react'
import {
  type AvatarSkin,
  type AvatarAccessory,
  skinFromName,
  accessoryFromRole,
} from './avatar-utils'

// Re-exporta para compatibilidade com imports existentes
export type { AvatarSkin, AvatarAccessory }
export { skinFromName, accessoryFromRole }

// Paletas por skin
const PALETTES: Record<AvatarSkin, { hair: string; skin: string; shirt: string; pants: string; shoes: string; crown: string }> = {
  0: { hair: '#1a1a2e', skin: '#f4c28a', shirt: '#3b82f6', pants: '#1e3a5f', shoes: '#1a1a2e', crown: '#fbbf24' },
  1: { hair: '#c84b8f', skin: '#f4c28a', shirt: '#ec4899', pants: '#831843', shoes: '#1a0a12', crown: '#fbbf24' },
  2: { hair: '#2d4a2d', skin: '#c8956c', shirt: '#10b981', pants: '#064e3b', shoes: '#111', crown: '#fbbf24' },
  3: { hair: '#7c5c1a', skin: '#f4c28a', shirt: '#fbbf24', pants: '#78350f', shoes: '#3d1f00', crown: '#ff6b00' },
  4: { hair: '#111', skin: '#c8956c', shirt: '#f97316', pants: '#431407', shoes: '#111', crown: '#fbbf24' },
  5: { hair: '#6d28d9', skin: '#f4c28a', shirt: '#8b5cf6', pants: '#2e1065', shoes: '#1a0a30', crown: '#fbbf24' },
  6: { hair: '#b0b0c0', skin: '#e8d5c4', shirt: '#e2e8f0', pants: '#475569', shoes: '#1e293b', crown: '#ff4444' },
}

// Frame 0 (em pé) — 12×16 pixels
// 0=transparent 1=hair 2=skin 3=shirt 4=pants 5=shoes
const FRAME_0: number[][] = [
  [0,0,0,1,1,1,1,1,0,0,0,0],
  [0,0,1,1,1,1,1,1,1,0,0,0],
  [0,0,1,2,2,2,2,1,1,0,0,0],
  [0,0,1,2,2,2,2,2,1,0,0,0],
  [0,0,0,1,2,2,2,1,0,0,0,0],
  [0,0,0,0,1,1,1,0,0,0,0,0],
  [0,1,3,3,3,3,3,3,3,1,0,0],
  [0,1,3,3,3,3,3,3,3,1,0,0],
  [0,0,3,3,3,3,3,3,3,0,0,0],
  [0,0,3,3,3,3,3,3,3,0,0,0],
  [0,0,4,4,0,0,4,4,0,0,0,0],
  [0,0,4,4,0,0,4,4,0,0,0,0],
  [0,0,4,4,0,0,4,4,0,0,0,0],
  [0,0,5,5,0,0,5,5,0,0,0,0],
  [0,0,5,5,0,0,5,5,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0],
]

// Frame 1 (passo) — perna direita à frente
const FRAME_1: number[][] = [
  [0,0,0,1,1,1,1,1,0,0,0,0],
  [0,0,1,1,1,1,1,1,1,0,0,0],
  [0,0,1,2,2,2,2,1,1,0,0,0],
  [0,0,1,2,2,2,2,2,1,0,0,0],
  [0,0,0,1,2,2,2,1,0,0,0,0],
  [0,0,0,0,1,1,1,0,0,0,0,0],
  [0,1,3,3,3,3,3,3,3,1,0,0],
  [0,1,3,3,3,3,3,3,3,1,0,0],
  [0,0,3,3,3,3,3,3,3,0,0,0],
  [0,0,3,3,3,3,3,3,3,0,0,0],
  [0,0,4,4,4,0,4,4,0,0,0,0],
  [0,0,0,4,4,0,4,4,0,0,0,0],
  [0,0,0,4,0,0,0,4,4,0,0,0],
  [0,0,0,5,0,0,0,5,5,0,0,0],
  [0,0,0,5,0,0,0,5,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0],
]

// ─────────────────────────────────────────────
// ADEREÇOS PIXEL ART (coordenadas relativas ao corpo)
// ─────────────────────────────────────────────

// Coroa — 7×5 (offset X=2 sobre a cabeça)
const CROWN_PIXELS: number[][] = [
  [0,2,0,2,0,2,0],
  [2,2,2,2,2,2,2],
  [2,2,2,2,2,2,2],
  [2,2,2,2,2,2,2],
  [2,2,2,2,2,2,2],
]

// Chapéu cowboy — 10×5 (offset X=-1 sobre a cabeça)
// 1=aba, 2=copa
const COWBOY_PIXELS: { r: number; c: number; color: string }[] = [
  // copa (marrom escuro)
  { r:0, c:2, color:'#5c3d1a' }, { r:0, c:3, color:'#5c3d1a' }, { r:0, c:4, color:'#5c3d1a' }, { r:0, c:5, color:'#5c3d1a' }, { r:0, c:6, color:'#5c3d1a' },
  { r:1, c:2, color:'#6b4423' }, { r:1, c:3, color:'#6b4423' }, { r:1, c:4, color:'#6b4423' }, { r:1, c:5, color:'#6b4423' }, { r:1, c:6, color:'#6b4423' },
  { r:2, c:2, color:'#7a4d28' }, { r:2, c:3, color:'#7a4d28' }, { r:2, c:4, color:'#7a4d28' }, { r:2, c:5, color:'#7a4d28' }, { r:2, c:6, color:'#7a4d28' },
  // faixa decorativa
  { r:2, c:3, color:'#c8860a' }, { r:2, c:4, color:'#c8860a' }, { r:2, c:5, color:'#c8860a' },
  // aba
  { r:3, c:1, color:'#8b5e30' }, { r:3, c:2, color:'#8b5e30' }, { r:3, c:3, color:'#8b5e30' }, { r:3, c:4, color:'#8b5e30' }, { r:3, c:5, color:'#8b5e30' }, { r:3, c:6, color:'#8b5e30' }, { r:3, c:7, color:'#8b5e30' },
  // curva da aba
  { r:4, c:1, color:'#7a5228' }, { r:4, c:7, color:'#7a5228' },
]

// Botinas de cowboy — sobrepõem os sapatos (adicionam ponteira e cano)
const COWBOY_BOOTS_PIXELS: { r: number; c: number; color: string }[] = [
  // Bota esquerda — ponta
  { r:14, c:1, color:'#4a2f0a' }, { r:14, c:2, color:'#5c3d1a' }, { r:14, c:3, color:'#5c3d1a' },
  { r:15, c:1, color:'#4a2f0a' }, { r:15, c:2, color:'#5c3d1a' }, { r:15, c:3, color:'#6b4423' }, { r:15, c:4, color:'#4a2f0a' },
  // Bota direita — ponta
  { r:14, c:6, color:'#5c3d1a' }, { r:14, c:7, color:'#5c3d1a' }, { r:14, c:8, color:'#4a2f0a' },
  { r:15, c:5, color:'#4a2f0a' }, { r:15, c:6, color:'#6b4423' }, { r:15, c:7, color:'#5c3d1a' }, { r:15, c:8, color:'#4a2f0a' },
]

// Calculadora — 6×8 pixels ao lado do corpo (direita)
const CALCULATOR_PIXELS: { r: number; c: number; color: string }[] = [
  // corpo da calculadora
  { r:6, c:9, color:'#1e293b' }, { r:6, c:10, color:'#1e293b' }, { r:6, c:11, color:'#1e293b' },
  { r:7, c:9, color:'#1e293b' }, { r:7, c:10, color:'#1e293b' }, { r:7, c:11, color:'#1e293b' },
  { r:8, c:9, color:'#334155' }, { r:8, c:10, color:'#334155' }, { r:8, c:11, color:'#334155' },
  { r:9, c:9, color:'#334155' }, { r:9, c:10, color:'#334155' }, { r:9, c:11, color:'#334155' },
  { r:10, c:9, color:'#1e293b' }, { r:10, c:10, color:'#1e293b' }, { r:10, c:11, color:'#1e293b' },
  { r:11, c:9, color:'#1e293b' }, { r:11, c:10, color:'#1e293b' }, { r:11, c:11, color:'#1e293b' },
  // tela verde
  { r:6, c:9, color:'#10b981' }, { r:6, c:10, color:'#10b981' }, { r:6, c:11, color:'#10b981' },
  { r:7, c:9, color:'#059669' }, { r:7, c:10, color:'#34d399' }, { r:7, c:11, color:'#059669' },
  // botões
  { r:9, c:9, color:'#38bdf8' }, { r:9, c:11, color:'#f59e0b' },
  { r:10, c:9, color:'#6ee7b7' }, { r:10, c:10, color:'#6ee7b7' }, { r:10, c:11, color:'#6ee7b7' },
  { r:11, c:9, color:'#94a3b8' }, { r:11, c:10, color:'#94a3b8' }, { r:11, c:11, color:'#e2e8f0' },
]

// Maleta — 7×5 pixels ao lado do corpo
const BRIEFCASE_PIXELS: { r: number; c: number; color: string }[] = [
  // alça
  { r:7, c:9, color:'#92400e' }, { r:7, c:10, color:'#92400e' },
  // corpo
  { r:8, c:9, color:'#b45309' }, { r:8, c:10, color:'#b45309' }, { r:8, c:11, color:'#b45309' },
  { r:9, c:9, color:'#d97706' }, { r:9, c:10, color:'#d97706' }, { r:9, c:11, color:'#d97706' },
  { r:10, c:9, color:'#b45309' }, { r:10, c:10, color:'#92400e' }, { r:10, c:11, color:'#b45309' },
  { r:11, c:9, color:'#78350f' }, { r:11, c:10, color:'#78350f' }, { r:11, c:11, color:'#78350f' },
  // fechadura
  { r:9, c:10, color:'#fbbf24' },
]

// Estrela SDR — flutuante acima da cabeça
const STAR_PIXELS: { r: number; c: number; color: string }[] = [
  { r:0, c:4, color:'#fbbf24' },
  { r:1, c:3, color:'#fbbf24' }, { r:1, c:4, color:'#fde68a' }, { r:1, c:5, color:'#fbbf24' },
  { r:2, c:3, color:'#fbbf24' }, { r:2, c:4, color:'#fbbf24' }, { r:2, c:5, color:'#fbbf24' },
  { r:3, c:4, color:'#f59e0b' },
]

// ─────────────────────────────────────────────
// BUILD HELPERS
// ─────────────────────────────────────────────

function buildBoxShadow(frame: number[][], palette: typeof PALETTES[0], px: number): string {
  const colors = ['transparent', palette.hair, palette.skin, palette.shirt, palette.pants, palette.shoes]
  const shadows: string[] = []
  frame.forEach((row, r) => {
    row.forEach((v, c) => {
      if (v === 0) return
      shadows.push(`${c * px}px ${r * px}px 0 0 ${colors[v]}`)
    })
  })
  return shadows.join(',')
}

function buildCrownShadow(palette: typeof PALETTES[0], px: number, offsetX: number): string {
  const shadows: string[] = []
  CROWN_PIXELS.forEach((row, r) => {
    row.forEach((v, c) => {
      if (v === 0) return
      shadows.push(`${(c + offsetX) * px}px ${r * px}px 0 0 ${palette.crown}`)
    })
  })
  return shadows.join(',')
}

function buildCustomPixels(
  pixels: { r: number; c: number; color: string }[],
  px: number,
  offsetRow = 0,
  offsetCol = 0
): string {
  return pixels
    .map(p => `${(p.c + offsetCol) * px}px ${(p.r + offsetRow) * px}px 0 0 ${p.color}`)
    .join(',')
}

// ─────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────

interface PixelAvatarProps {
  skin?: AvatarSkin
  size?: number          // pixel size multiplier (default: 3)
  walking?: boolean      // enable walk animation
  crowned?: boolean      // show crown on top
  label?: string         // tooltip / aria-label
  role?: string          // detecta adereço automaticamente
  produtoFoco?: string   // texto adicional para detecção rural
  accessory?: AvatarAccessory  // override manual do adereço
}

export default function PixelAvatar({
  skin = 0,
  size = 3,
  walking = false,
  crowned = false,
  label = 'Avatar',
  role,
  produtoFoco,
  accessory: accessoryOverride,
}: PixelAvatarProps) {
  const [frame, setFrame] = useState(0)
  const palette = PALETTES[skin]
  const cols = 12
  const rows = 16
  const crownRows = 5
  const crownOffsetX = 2

  // Determina adereço ativo
  const activeAccessory: AvatarAccessory =
    accessoryOverride ?? accessoryFromRole(role, produtoFoco)

  useEffect(() => {
    if (!walking) { setFrame(0); return }
    const id = setInterval(() => setFrame(f => (f + 1) % 2), 220)
    return () => clearInterval(id)
  }, [walking])

  const currentShadow = frame === 0
    ? buildBoxShadow(FRAME_0, palette, size)
    : buildBoxShadow(FRAME_1, palette, size)

  const crownShadow = buildCrownShadow(palette, size, crownOffsetX)

  // Sombras dos adereços (relativas ao corpo, não à coroa)
  const accShadow: string | null = (() => {
    switch (activeAccessory) {
      case 'cowboy':
        return [
          buildCustomPixels(COWBOY_PIXELS, size, 0, 0),
          buildCustomPixels(COWBOY_BOOTS_PIXELS, size, 0, 0),
        ].join(',')
      case 'calculator':
        return buildCustomPixels(CALCULATOR_PIXELS, size, 0, 0)
      case 'briefcase':
        return buildCustomPixels(BRIEFCASE_PIXELS, size, 0, 0)
      case 'star':
        return buildCustomPixels(STAR_PIXELS, size, -4, 0)
      default:
        return null
    }
  })()

  const W = cols * size
  const H = rows * size
  const crownH = crownRows * size
  const extraTop = crowned ? crownH + size : 0

  return (
    <div
      aria-label={label}
      title={label}
      style={{
        position: 'relative',
        width: W,
        height: H + extraTop,
        flexShrink: 0,
      }}
    >
      {/* Coroa */}
      {crowned && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: size,
          height: size,
          boxShadow: crownShadow,
        }} />
      )}

      {/* Corpo */}
      <div
        style={{
          position: 'absolute',
          top: extraTop,
          left: 0,
          width: size,
          height: size,
          boxShadow: currentShadow,
          transition: 'box-shadow 0.05s',
          imageRendering: 'pixelated',
        }}
      />

      {/* Adereço sobreposto ao corpo */}
      {accShadow && (
        <div
          style={{
            position: 'absolute',
            top: extraTop,
            left: 0,
            width: size,
            height: size,
            boxShadow: accShadow,
            imageRendering: 'pixelated',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}
