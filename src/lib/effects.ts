/**
 * effects.ts — Efeitos visuais client-side para eventos do pipeline.
 * Usa import dinâmico para garantir segurança em SSR (Next.js).
 */

// Carrega canvas-confetti de forma lazy e segura
async function getConfetti() {
  try {
    const mod = await import('canvas-confetti')
    return mod.default
  } catch (err) {
    console.error('Falha ao carregar canvas-confetti:', err)
    return null
  }
}

/**
 * triggerSaleConfetti — Explosão ÉPICA (Gigante) de confetes para fechamento de contrato!
 * Uma festa muito maior e mais longa para celebrar a assinatura de contrato.
 */
export async function triggerSaleConfetti(isRural = false) {
  const confetti = await getConfetti()
  if (!confetti) return

  const duration = 5000 // Aumentado para 5s de festa
  const end = Date.now() + duration

  const colors = isRural 
    ? ['#78350f', '#fbbf24', '#10b981', '#ffffff', '#a8922e'] // Tons terra/ouro/campo
    : ['#fbbf24', '#fcd34d', '#f59e0b', '#ffffff', '#10b981', '#34d399', '#3b82f6', '#ef4444']

  const scalar = isRural ? 2.5 : 1.5

  const common = {
    colors,
    zIndex: 100000,
    gravity: 0.9, // Cai mais devagar
    scalar,
  }

  // 1. Explosão inicial gigante do centro
  confetti({
    ...common,
    particleCount: 250,
    spread: 160,
    origin: { x: 0.5, y: 0.4 },
    startVelocity: 65,
  })

  // Se for rural, adiciona formas de chapéu e botina (via emojis)
  if (isRural) {
    const ruralShapes = ['🤠', '🚜', '🌾', '🐂']
    ruralShapes.forEach((emoji, i) => {
      setTimeout(() => {
        confetti({
          ...common,
          particleCount: 25,
          scalar: 5,
          shapes: [confetti.shapeFromText({ text: emoji })],
          origin: { x: Math.random(), y: 0.5 },
        })
      }, i * 200)
    })
  }

  // 2. Canhões laterais sincronizados a cada 400ms
  const interval = setInterval(() => {
    if (Date.now() > end) {
      clearInterval(interval)
      return
    }
    confetti({
      ...common,
      particleCount: 80,
      angle: 60,
      spread: 80,
      origin: { x: 0, y: 0.7 },
      startVelocity: 60,
    })
    confetti({
      ...common,
      particleCount: 80,
      angle: 120,
      spread: 80,
      origin: { x: 1, y: 0.7 },
      startVelocity: 60,
    })
  }, 400)

  // 3. Chuva contínua caindo do topo
  const frame = () => {
    if (Date.now() > end) return

    confetti({
      ...common,
      particleCount: 6,
      angle: 90,
      spread: 180,
      origin: { x: Math.random(), y: -0.1 },
      startVelocity: 15,
      gravity: 0.8
    })

    requestAnimationFrame(frame)
  }

  setTimeout(frame, 200)
}

/**
 * triggerSingleBoom — Chuva de papel padrão (como era antes) para cada avanço de etapa.
 */
export async function triggerSingleBoom() {
  const confetti = await getConfetti()
  if (!confetti) return

  const duration = 1200 // 1.2s (Mais curto e discreto)
  const end = Date.now() + duration
  const colors = ['#fbbf24', '#fcd34d', '#f59e0b', '#ffffff']

  const common = {
    colors,
    zIndex: 100000,
    gravity: 1.2,
    scalar: 0.9,
  }

  // Explosão central menor
  confetti({
    ...common,
    particleCount: 40,
    spread: 60,
    origin: { x: 0.5, y: 0.5 },
    startVelocity: 35,
  })

  // Chuva contínua bem leve
  const frame = () => {
    if (Date.now() > end) return

    const timeLeft = end - Date.now()
    const count = Math.floor(10 * (timeLeft / duration))

    if (count > 0) {
      confetti({
        ...common,
        particleCount: count,
        angle: 60,
        spread: 45,
        origin: { x: 0, y: 0.6 },
      })
      confetti({
        ...common,
        particleCount: count,
        angle: 120,
        spread: 45,
        origin: { x: 1, y: 0.6 },
      })
    }

    requestAnimationFrame(frame)
  }

  setTimeout(frame, 150)
}
