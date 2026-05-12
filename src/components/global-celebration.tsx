'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { triggerSaleConfetti } from '@/lib/effects'
import PixelAvatar, { skinFromName } from './PixelAvatar'
import { Trophy, Zap, MapPin } from 'lucide-react'

interface CelebrationData {
  consultantName: string
  clientName: string
  value?: string
  isRural: boolean
  avatarSkin?: number
}

export default function GlobalCelebration() {
  const [celebration, setCelebration] = useState<CelebrationData | null>(null)

  useEffect(() => {
    const supabase = createClient()

    // Canal dedicado para celebrações globais (Broadcast)
    const channel = supabase.channel('global-celebration', {
      config: { broadcast: { self: true } }
    })

    channel.on('broadcast', { event: 'sale' }, (payload: { payload: CelebrationData }) => {
      const data = payload.payload
      showCelebration(data)
    })

    // Também escuta mudanças na tabela leads para capturar fechamentos via CRM
    const leadsChannel = supabase.channel('leads-celebration-backup')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, async (payload) => {
        const newData = payload.new as { stage: string; consultant_id: string; name: string; estimated_value?: number }
        const oldData = payload.old as { stage: string } | null

        if (newData.stage === 'Fechado' && (!oldData || oldData.stage !== 'Fechado')) {
          // Busca nome do consultor se possível
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_skin')
            .eq('id', newData.consultant_id)
            .single()

          const isRural = /rural|cat 153|agronegocio/i.test(newData.name || '')
          
          showCelebration({
            consultantName: profile?.full_name || 'Consultor',
            clientName: newData.name || 'Novo Cliente',
            value: newData.estimated_value ? `R$ ${newData.estimated_value}` : undefined,
            isRural,
            avatarSkin: profile?.avatar_skin
          })
        }
      })
      .subscribe()

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(leadsChannel)
    }
  }, [])

  function showCelebration(data: CelebrationData) {
    setCelebration(data)
    triggerSaleConfetti(data.isRural)
    
    // Auto-close after 6 seconds
    setTimeout(() => {
      setCelebration(null)
    }, 6000)
  }

  if (!celebration) return null

  const skin = (celebration.avatarSkin ?? skinFromName(celebration.consultantName)) as import('./avatar-utils').AvatarSkin

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      animation: 'fadeIn 0.4s ease-out forwards',
    }}>
      {/* Overlay Backdrop */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: celebration.isRural 
          ? 'radial-gradient(circle, rgba(67,20,7,0.6) 0%, rgba(0,0,0,0.9) 100%)'
          : 'radial-gradient(circle, rgba(251,191,36,0.2) 0%, rgba(0,0,0,0.92) 100%)',
        backdropFilter: 'blur(4px)',
      }} />

      {/* Celebration Card */}
      <div style={{
        position: 'relative',
        background: celebration.isRural ? '#1a0f0a' : '#0d1117',
        border: `3px solid ${celebration.isRural ? '#b8880a' : '#fbbf24'}`,
        borderRadius: '32px',
        padding: '50px 40px',
        textAlign: 'center',
        maxWidth: '540px',
        width: '92%',
        boxShadow: `0 0 80px ${celebration.isRural ? 'rgba(184,136,10,0.4)' : 'rgba(251,191,36,0.3)'}, inset 0 0 20px rgba(255,255,255,0.05)`,
        animation: 'cardPop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        pointerEvents: 'auto',
      }}>
        {/* Floating Icons */}
        <div style={{ position: 'absolute', top: '-40px', left: '10%', fontSize: '3rem', animation: 'float 3s ease-in-out infinite' }}>{celebration.isRural ? '🤠' : '💰'}</div>
        <div style={{ position: 'absolute', top: '-20px', right: '15%', fontSize: '2.5rem', animation: 'float 3.5s ease-in-out infinite reverse' }}>{celebration.isRural ? '🚜' : '✨'}</div>
        <div style={{ position: 'absolute', bottom: '20px', left: '-20px', fontSize: '2.5rem', animation: 'float 4s ease-in-out infinite' }}>{celebration.isRural ? '👢' : '🚀'}</div>

        {/* Badge Rural / Top */}
        <div style={{
          position: 'absolute',
          top: '-24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: celebration.isRural ? 'linear-gradient(135deg, #78350f, #b8880a)' : 'linear-gradient(135deg, #fbbf24, #f59e0b)',
          color: celebration.isRural ? '#fff' : '#000',
          padding: '10px 28px',
          borderRadius: '999px',
          fontSize: '0.85rem',
          fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
          whiteSpace: 'nowrap',
        }}>
          {celebration.isRural ? <MapPin size={16} fill="currentColor" /> : <Trophy size={16} fill="currentColor" />}
          {celebration.isRural ? 'CONTRATO RURAL DETECTADO' : 'FECHAMENTO ÉPICO!'}
        </div>

        {/* Avatar Area */}
        <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            padding: '15px', 
            background: 'rgba(255,255,255,0.03)', 
            borderRadius: '50%', 
            border: `1px solid ${celebration.isRural ? 'rgba(184,136,10,0.3)' : 'rgba(251,191,36,0.3)'}`,
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
          }}>
            <PixelAvatar
              skin={skin}
              size={5}
              walking
              crowned
              accessory={celebration.isRural ? 'cowboy' : 'briefcase'}
            />
          </div>
          <div style={{ 
            fontSize: '0.75rem', 
            fontWeight: 800, 
            color: celebration.isRural ? '#b8880a' : '#fbbf24',
            textTransform: 'uppercase',
            letterSpacing: '0.1em'
          }}>
            Consultor de Elite
          </div>
        </div>

        <h2 style={{ fontSize: '2.2rem', fontWeight: 950, color: '#fff', marginBottom: '8px', letterSpacing: '-0.03em' }}>
          {celebration.consultantName.split(' ')[0]} <span style={{ color: celebration.isRural ? '#b8880a' : '#fbbf24' }}>BRILHOU!</span>
        </h2>
        
        <p style={{ fontSize: '1.25rem', color: '#94a3b8', fontWeight: 600, marginBottom: '28px', lineHeight: 1.3 }}>
          Acabou de fechar com<br />
          <strong style={{ color: '#f8fafc', fontSize: '1.4rem' }}>{celebration.clientName}</strong>
        </p>

        {celebration.value && (
          <div style={{
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.2)',
            padding: '15px 30px',
            borderRadius: '16px',
            display: 'inline-block',
            fontSize: '2.4rem',
            fontWeight: 950,
            color: '#10b981',
            textShadow: '0 0 20px rgba(16,185,129,0.4)',
          }}>
            {celebration.value}
          </div>
        )}

        <div style={{
          marginTop: '35px',
          padding: '14px',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: '14px',
          fontSize: '0.8rem',
          color: '#475569',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          fontWeight: 600,
        }}>
          <Zap size={14} color={celebration.isRural ? '#b8880a' : '#fbbf24'} />
          <span>ESTA NOTIFICAÇÃO APARECEU PARA TODO O TIME!</span>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes cardPop {
          from { opacity: 0; transform: scale(0.7) translateY(40px) rotate(-2deg); }
          to { opacity: 1; transform: scale(1) translateY(0) rotate(0deg); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }
      `}</style>
    </div>
  )
}
