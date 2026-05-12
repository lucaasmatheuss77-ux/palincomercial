import { Trophy, Zap, Target, Scroll, CheckCircle2 } from 'lucide-react'
import confetti from 'canvas-confetti'

export function triggerLevelUpConfetti() {
  const duration = 3 * 1000
  const animationEnd = Date.now() + duration
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }

  const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min

  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now()

    if (timeLeft <= 0) {
      return clearInterval(interval)
    }

    const particleCount = 50 * (timeLeft / duration)
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } })
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } })
  }, 250)
}

export function LevelProgressBar({ xp, level, nextLevelXp = 1000 }: { xp: number; level: number; nextLevelXp?: number }) {
  const currentCycleXp = xp % nextLevelXp
  const progress = Math.min((currentCycleXp / nextLevelXp) * 100, 100)
  const remainingXp = Math.max(nextLevelXp - currentCycleXp, 0)
  const performanceBands = [
    { min: 1, max: 1, label: 'Aquecimento', tone: '#94a3b8' },
    { min: 2, max: 2, label: 'Em tracao', tone: '#38bdf8' },
    { min: 3, max: 3, label: 'Ritmo forte', tone: '#10b981' },
    { min: 4, max: 4, label: 'Alta performance', tone: 'var(--brand-primary)' },
    { min: 5, max: 99, label: 'Elite comercial', tone: '#f97316' },
  ]
  const currentBand = performanceBands.find((band) => level >= band.min && level <= band.max) || performanceBands[0]

  return (
    <div className="glass-card" style={{ padding: '20px', marginBottom: '20px', background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.05), rgba(0, 0, 0, 0.2))' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '10px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontSize: '0.7rem', color: 'var(--brand-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Evolucao Comercial</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '2px' }}>
            <h2 style={{
              fontSize: '1.25rem', fontWeight: 900, color: 'var(--brand-text)',
              animation: 'pulse-neon 3s ease-in-out infinite'
            }}>
              {currentBand.label}
            </h2>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '999px',
                background: `${currentBand.tone}18`,
                border: `1px solid ${currentBand.tone}33`,
                color: currentBand.tone,
                fontSize: '0.72rem',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Faixa {level}
            </span>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--brand-muted)', marginTop: '4px' }}>
            Ritmo de crescimento do consultor lider no ciclo atual
          </p>
        </div>
        <div style={{ textAlign: 'right' }} aria-label={`Progresso atual: ${currentCycleXp} de ${nextLevelXp} pontos`}>
          <span style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--brand-primary)' }}>{Math.round(progress)}% do ciclo atual</span>
          <p style={{ fontSize: '0.7rem', color: 'var(--brand-muted)' }}>{currentCycleXp} de {nextLevelXp} pontos no ciclo</p>
          <p style={{ fontSize: '0.7rem', color: 'var(--brand-muted)' }}>Faltam {remainingXp} pontos para a proxima faixa</p>
          <p style={{ fontSize: '0.7rem', color: 'var(--brand-muted)' }}>Acumulado: {xp.toLocaleString('pt-BR')} pontos</p>
        </div>
      </div>

      <div style={{ width: '100%', height: '8px', background: 'rgba(251, 191, 36, 0.1)', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(251, 191, 36, 0.1)' }}>
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            background: 'linear-gradient(90deg, var(--brand-primary), #fcd34d)',
            boxShadow: `0 0 ${10 + progress / 10}px rgba(251, 191, 36, ${0.3 + progress / 200})`,
            transition: 'width 1s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  )
}

export function QuestLog() {
  const quests = [
    { id: 1, title: 'First Blood', desc: 'Feche seu primeiro contrato hoje', reward: '100 XP', progress: 0, target: 1, icon: Zap },
    { id: 2, title: 'The Prospector', desc: 'Adicione 5 novos leads no CRM', reward: '250 XP', progress: 3, target: 5, icon: Target },
    { id: 3, title: 'Deal Closer', desc: 'Mova um lead para estagio de Proposta', reward: '150 XP', progress: 1, target: 1, done: true, icon: Trophy }
  ]

  return (
    <div className="glass-card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <Scroll size={18} color="var(--brand-primary)" />
        <h3 style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--brand-text)', letterSpacing: '0.02em' }}>QUEST LOG (MISSOES)</h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {quests.map((quest) => (
          <div key={quest.id} style={{
            padding: '12px', borderRadius: '12px',
            background: quest.done ? 'rgba(16, 185, 129, 0.05)' : 'rgba(251, 191, 36, 0.03)',
            border: `1px solid ${quest.done ? 'rgba(16, 185, 129, 0.2)' : 'rgba(251, 191, 36, 0.1)'}`,
            display: 'flex', alignItems: 'center', gap: '12px',
            opacity: quest.done ? 0.7 : 1
          }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '8px',
              background: quest.done ? 'rgba(16, 185, 129, 0.1)' : 'rgba(251, 191, 36, 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }} aria-hidden="true">
              <quest.icon size={18} color={quest.done ? '#10b981' : 'var(--brand-primary)'} />
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 800, fontSize: '0.85rem', color: quest.done ? '#10b981' : 'var(--brand-text)' }}>{quest.title}</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--brand-primary)', background: 'rgba(251, 191, 36, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>+{quest.reward}</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--brand-muted)', marginTop: '2px' }}>{quest.desc}</p>

              {!quest.done && (
                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ flex: 1, height: '4px', background: 'rgba(251, 191, 36, 0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${(quest.progress / quest.target) * 100}%`, height: '100%', background: 'var(--brand-primary)' }} />
                  </div>
                  <span style={{ fontSize: '0.65rem', color: 'var(--brand-muted)', fontWeight: 700 }}>{quest.progress}/{quest.target}</span>
                </div>
              )}
            </div>

            {quest.done && <CheckCircle2 size={18} color="#10b981" />}
          </div>
        ))}
      </div>
    </div>
  )
}
