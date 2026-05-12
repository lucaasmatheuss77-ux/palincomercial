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
 * triggerSaleConfetti — Explosão épica de confetes para fechamento de venda.
 * Agora mais rápida (2.5s) e suporta temas rurais.
 */
export async function triggerSaleConfetti(isRural = false) {
  const confetti = await getConfetti()
  if (!confetti) return

  const duration = 2500 // Reduzido de 4s para 2.5s
  const end = Date.now() + duration

  const colors = isRural 
    ? ['#78350f', '#fbbf24', '#10b981', '#ffffff', '#a8922e'] // Tons terra/ouro/campo
    : ['#fbbf24', '#fcd34d', '#f59e0b', '#ffffff', '#10b981', '#34d399']

  // Se for rural, adiciona formas de chapéu e botina (via emojis)
  const scalar = isRural ? 2.5 : 1.2
  // Nota: canvas-confetti suporta emojis via "scalar" alto e renderização custom se necessário, 
  // mas a forma mais fácil é misturar confetes normais com partículas grandes que lembram o tema.
  // No v1.6+ podemos usar text as shape.

  const common = {
    colors,
    zIndex: 100000,
    gravity: 1.1,
    scalar,
  }

  // Chuva central imediata
  confetti({
    ...common,
    particleCount: 150,
    spread: 100,
    origin: { x: 0.5, y: 0.3 },
    startVelocity: 55,
  })

  // Se rural, lança "chapéus" e "botinas"
  if (isRural) {
    const ruralShapes = ['🤠', '👢', '🚜', '🌾']
    ruralShapes.forEach((emoji, i) => {
      setTimeout(() => {
        confetti({
          ...common,
          particleCount: 15,
          scalar: 4,
          shapes: [confetti.shapeFromText({ text: emoji })],
          origin: { x: Math.random(), y: 0.5 },
        })
      }, i * 200)
    })
  }

  // Explosão nos cantos após 100ms
  setTimeout(() => {
    confetti({
      ...common,
      particleCount: 80,
      angle: 60,
      spread: 80,
      origin: { x: 0, y: 0.6 },
    })
    confetti({
      ...common,
      particleCount: 80,
      angle: 120,
      spread: 80,
      origin: { x: 1, y: 0.6 },
    })
  }, 100)

  // Chuva contínua mais curta
  const frame = () => {
    if (Date.now() > end) return

    const timeLeft = end - Date.now()
    const count = Math.floor(40 * (timeLeft / duration))

    confetti({
      ...common,
      particleCount: count,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.65 },
    })
    confetti({
      ...common,
      particleCount: count,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.65 },
    })

    requestAnimationFrame(frame)
  }

  setTimeout(frame, 300)
}

/**
 * triggerSingleBoom — Micro-explosão dourada para avanço de etapa.
 * Mais rápido e discreto que o confetti de fechamento.
 */
export async function triggerSingleBoom() {
  const confetti = await getConfetti()
  if (!confetti) return

  confetti({
    particleCount: 60,
    spread: 70,
    origin: { x: 0.5, y: 0.6 },
    zIndex: 100000,
    ticks: 130,
    gravity: 1.3,
    colors: ['#fbbf24', '#fcd34d', '#ffffff', '#a8922e'],
    startVelocity: 35,
    scalar: 1.0,
  })
}
