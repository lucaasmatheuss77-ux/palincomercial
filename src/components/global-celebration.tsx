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
      top: '24px',
      right: '24px',
      zIndex: 200000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      pointerEvents: 'none',
    }}>
      {/* Celebration Card / Mega Toast */}
      <div style={{
        position: 'relative',
        background: celebration.isRural ? '#1a0f0a' : '#0d1117',
        border: `2px solid ${celebration.isRural ? '#b8880a' : '#fbbf24'}`,
        borderRadius: '24px',
        padding: '32px 32px 28px 32px',
        textAlign: 'center',
        width: '420px',
        boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 40px ${celebration.isRural ? 'rgba(184,136,10,0.3)' : 'rgba(251,191,36,0.25)'}, inset 0 0 20px rgba(255,255,255,0.03)`,
        animation: 'toastSlideIn 0.6s cubic-bezier(0.2, 1.2, 0.4, 1) forwards',
        pointerEvents: 'auto',
      }}>
        {/* Floating Icons */}
        <div style={{ position: 'absolute', top: '-25px', left: '8%', fontSize: '2.5rem', animation: 'float 3s ease-in-out infinite' }}>{celebration.isRural ? '🤠' : '💸'}</div>
        <div style={{ position: 'absolute', top: '-15px', right: '10%', fontSize: '2rem', animation: 'float 3.5s ease-in-out infinite reverse' }}>{celebration.isRural ? '🐂' : '🔥'}</div>

        {/* Badge Rural / Top */}
        <div style={{
          position: 'absolute',
          top: '-18px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: celebration.isRural ? 'linear-gradient(135deg, #78350f, #b8880a)' : 'linear-gradient(135deg, #fbbf24, #f59e0b)',
          color: celebration.isRural ? '#fff' : '#000',
          padding: '6px 20px',
          borderRadius: '999px',
          fontSize: '0.75rem',
          fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 6px 15px rgba(0,0,0,0.4)',
          whiteSpace: 'nowrap',
        }}>
          {celebration.isRural ? <MapPin size={14} fill="currentColor" /> : <Trophy size={14} fill="currentColor" />}
          {celebration.isRural ? 'CONTRATO RURAL DETECTADO' : 'FECHAMENTO ÉPICO!'}
        </div>

        {/* Avatar Area */}
        <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <div style={{ 
            padding: '12px', 
            background: 'rgba(255,255,255,0.03)', 
            borderRadius: '50%', 
            border: `1px solid ${celebration.isRural ? 'rgba(184,136,10,0.3)' : 'rgba(251,191,36,0.3)'}`,
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
          }}>
            <PixelAvatar
              skin={skin}
              size={4}
              walking
              crowned
              accessory={celebration.isRural ? 'cowboy' : 'briefcase'}
            />
          </div>
        </div>

        <h2 style={{ fontSize: '1.8rem', fontWeight: 950, color: '#fff', marginBottom: '6px', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          {celebration.consultantName.split(' ')[0]} <span style={{ color: celebration.isRural ? '#b8880a' : '#fbbf24' }}>BRILHOU!</span>
        </h2>
        
        <p style={{ fontSize: '1.05rem', color: '#94a3b8', fontWeight: 600, marginBottom: '20px', lineHeight: 1.3 }}>
          Acabou de fechar com<br />
          <strong style={{ color: '#f8fafc', fontSize: '1.15rem' }}>{celebration.clientName}</strong>
        </p>

        {celebration.value && (
          <div style={{
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.2)',
            padding: '10px 24px',
            borderRadius: '12px',
            display: 'inline-block',
            fontSize: '1.8rem',
            fontWeight: 950,
            color: '#10b981',
            textShadow: '0 0 15px rgba(16,185,129,0.3)',
          }}>
            {celebration.value}
          </div>
        )}

        <div style={{
          marginTop: '24px',
          padding: '10px',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: '10px',
          fontSize: '0.75rem',
          color: '#475569',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          fontWeight: 700,
        }}>
          <Zap size={14} color={celebration.isRural ? '#b8880a' : '#fbbf24'} />
          <span>ALERTA GLOBAL 🌍</span>
        </div>
      </div>

      <style>{`
        @keyframes toastSlideIn {
          0% { opacity: 0; transform: translateX(50px) scale(0.9); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  )

}
