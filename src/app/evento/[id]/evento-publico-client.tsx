'use client'

import { useState, useTransition } from 'react'
import { Clock3, MapPin, Building2, User, Mail, Phone, CheckCircle, Ticket } from 'lucide-react'
import { toast } from 'sonner'
import confetti from 'canvas-confetti'
import { registrarInscricao } from '@/app/actions/inscricao'

interface EventData {
  id: string
  name: string
  description?: string
  date: string
  location: string
}

export default function EventoPublicoClient({ event }: { event: EventData }) {
  const [isPending, startTransition] = useTransition()
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: ''
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.name || !formData.email || !formData.phone) {
      toast.error('Preencha os campos obrigatorios (Nome, Email e WhatsApp).')
      return
    }

    startTransition(async () => {
      const result = await registrarInscricao(event.id, formData)
      if (result.success) {
        setSuccess(true)
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['var(--brand-primary)', '#f59e0b', '#3b82f6', '#ffffff']
        })
      } else {
        toast.error(result.error || 'Nao foi possivel confirmar sua inscricao. Tente novamente.')
      }
    })
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117', padding: '20px' }}>
        <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '40px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center', maxWidth: '400px', width: '100%', backdropFilter: 'blur(20px)' }}>
          <div style={{ width: '64px', height: '64px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
             <CheckCircle size={32} />
          </div>
          <h2 style={{ color: 'var(--brand-text)', fontSize: '1.5rem', fontWeight: 900, marginBottom: '12px' }}>Inscricao Confirmada!</h2>
          <p style={{ color: 'var(--brand-muted)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '24px' }}>
            Sua presenca no evento <strong>{event.name}</strong> esta confirmada. Em breve nossa equipe entrara em contato.
          </p>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'var(--brand-primary)' }}>
             <Ticket size={24} />
             <span style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.05em' }}>PASSE LIBERADO</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0d1117', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Gamified Hero Banner */}
      <div style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #0d1117 100%)', padding: '60px 20px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.1, backgroundImage: 'radial-gradient(circle at center, var(--brand-primary) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '600px', margin: '0 auto' }}>
          <div style={{display: 'inline-block', padding: '4px 12px', background: 'rgba(251, 191, 36, 0.1)', color: 'var(--brand-primary)', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.05em', marginBottom: '16px', textTransform: 'uppercase'}}>
            Convite Exclusivo
          </div>
          <h1 style={{ color: 'var(--brand-text)', fontSize: '2.5rem', fontWeight: 900, marginBottom: '16px', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            {event.name}
          </h1>
          {event.description && (
             <p style={{ color: '#c9d1d9', fontSize: '1rem', lineHeight: 1.5, marginBottom: '24px' }}>
               {event.description}
             </p>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
             <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', padding: '6px 14px', borderRadius: '100px', color: '#c9d1d9', fontSize: '0.85rem' }}>
               <Clock3 size={14} color="var(--brand-muted)" /> {new Date(event.date).toLocaleString('pt-BR')}
             </span>
             <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', padding: '6px 14px', borderRadius: '100px', color: '#c9d1d9', fontSize: '0.85rem' }}>
               <MapPin size={14} color="var(--brand-muted)" /> {event.location}
             </span>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '40px 20px', display: 'flex', justifyContent: 'center' }}>
        <form onSubmit={handleSubmit} style={{ background: 'rgba(22, 27, 34, 0.6)', padding: '32px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', maxWidth: '500px', width: '100%', backdropFilter: 'blur(20px)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
          
          <h2 style={{ color: 'var(--brand-text)', fontSize: '1.25rem', fontWeight: 800, marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
            Garanta sua participacao
          </h2>

          <div style={{ display: 'grid', gap: '20px' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--brand-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
                <User size={14} /> Nome completo *
              </label>
              <input 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                required
                placeholder="Seu nome"
                style={{ width: '100%', padding: '12px 16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'var(--brand-text)', outline: 'none' }} 
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--brand-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
                  <Phone size={14} /> WhatsApp *
                </label>
                <input 
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  required
                  placeholder="(00) 00000-0000"
                  style={{ width: '100%', padding: '12px 16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'var(--brand-text)', outline: 'none' }} 
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--brand-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
                  <Mail size={14} /> Email *
                </label>
                <input 
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  required
                  placeholder="seu@email.com"
                  style={{ width: '100%', padding: '12px 16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'var(--brand-text)', outline: 'none' }} 
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--brand-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
                <Building2 size={14} /> Empresa (Opcional)
              </label>
              <input 
                value={formData.company}
                onChange={e => setFormData({...formData, company: e.target.value})}
                placeholder="Sua empresa"
                style={{ width: '100%', padding: '12px 16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'var(--brand-text)', outline: 'none' }} 
              />
            </div>

            <button 
              type="submit" 
              disabled={isPending}
              style={{
                marginTop: '8px',
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '1rem',
                cursor: isPending ? 'not-allowed' : 'pointer',
                opacity: isPending ? 0.7 : 1,
                boxShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.39)',
                transition: 'all 0.2s ease',
              }}
            >
              {isPending ? 'PROCESSANDO...' : 'CONFIRMAR INSCRIÇÃO'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// SEO Helper: og: name="description" <title>
