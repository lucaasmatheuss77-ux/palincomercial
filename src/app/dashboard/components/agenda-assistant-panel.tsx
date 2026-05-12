'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { 
  Clock, X, 
  CalendarDays, Sparkles, Send
} from 'lucide-react'

interface Message {
  role: 'assistant' | 'user'
  content: string
  timestamp: Date
}

interface AgendaAssistantPanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function AgendaAssistantPanel({ isOpen, onClose }: AgendaAssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Olá! Sou a **PALIN AI**, sua assistente comercial da Palin & Martins.\n\nPosso te ajudar com:\n• Gerar pitch personalizado para um cliente\n• Escrever e-mail ou mensagem de WhatsApp\n• Quebrar objeções com argumentos prontos\n• Qualificar um novo lead\n• Preparar abordagem de renovação\n• Criar leads e eventos no CRM\n\nDigite o que precisa ou use um comando rápido como **/pitch**, **/email**, **/objecao** ou **/qualificar**.',
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isTyping])

  // Focar o input automaticamente quando o painel abre
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 300)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  const sendQuery = useCallback(async (msg: string) => {
    setIsTyping(true)
    try {
      const history = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/assistant/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history })
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply || 'Desculpe, tive um problema ao processar sua solicitação.',
        timestamp: new Date()
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Houve um erro de conexão. Tente novamente mais tarde.',
        timestamp: new Date()
      }])
    } finally {
      setIsTyping(false)
    }
  }, [messages])

  useEffect(() => {
    const handleRemoteQuery = (e: CustomEvent) => {
      const query = e.detail?.query
      if (query) {
        setMessages(prev => [...prev, { role: 'user', content: query, timestamp: new Date() }])
        void sendQuery(query)
      }
    }
    window.addEventListener('aura-query', handleRemoteQuery as EventListener)
    return () => window.removeEventListener('aura-query', handleRemoteQuery as EventListener)
  }, [sendQuery])

  const handleSend = async () => {
    if (!input.trim()) return
    const userMsg: Message = { role: 'user', content: input, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    const currentInput = input
    setInput('')
    await sendQuery(currentInput)
  }


  // Render simple markdown: **bold** and newlines
  const renderMessage = (content: string) => {
    return content.split('\n').map((line, i) => {
      const parts = line.split(/\*\*(.+?)\*\*/).map((part, j) =>
        j % 2 === 1 ? <strong key={j} style={{ color: 'var(--brand-primary)' }}>{part}</strong> : part
      )
      return <span key={i}>{parts}{i < content.split('\n').length - 1 && <br />}</span>
    })
  }

  if (!isOpen) return null

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div 
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '400px',
          height: '100%',
          boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.5)',
          background: 'linear-gradient(180deg, rgba(22, 27, 34, 0.98) 0%, rgba(13, 17, 23, 1) 100%)',
          borderLeft: '1px solid rgba(251, 191, 36, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          transform: 'translateX(0)',
          animation: 'auraSlideIn 0.3s ease-out',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(251, 191, 36, 0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px',
              background: 'rgba(251, 191, 36, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(251, 191, 36, 0.2)'
            }}>
              <Sparkles size={20} color="var(--brand-primary)" />
            </div>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--brand-text)', margin: 0 }}>PALIN AI</h2>
              <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                Assistente comercial ativa
              </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'rgba(255,255,255,0.04)', border: 'none',
              color: 'var(--brand-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div 
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}
        >
          {/* Quick Agenda Card */}
          <div className="glass-card" style={{ padding: '16px', background: 'rgba(251, 191, 36, 0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <CalendarDays size={16} color="var(--brand-primary)" />
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--brand-text)', textTransform: 'uppercase' }}>Hoje em resumo</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)' }}>
                <Clock size={14} color="var(--brand-muted)" />
                <span style={{ fontSize: '0.8rem', color: '#c9d1d9' }}>Carregando compromissos...</span>
              </div>
            </div>
          </div>

          {/* Chat Messages */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {messages.map((msg, i) => (
              <div 
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  gap: '6px',
                  maxWidth: '90%',
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '16px',
                  fontSize: '0.85rem',
                  lineHeight: 1.5,
                  background: msg.role === 'user' ? 'var(--brand-primary)' : 'rgba(255, 255, 255, 0.05)',
                  color: msg.role === 'user' ? '#0d1117' : 'var(--brand-text)',
                  border: msg.role === 'user' ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                  fontWeight: msg.role === 'user' ? 600 : 400,
                  borderBottomRightRadius: msg.role === 'user' ? '4px' : '16px',
                  borderBottomLeftRadius: msg.role === 'assistant' ? '4px' : '16px',
                }}>
                  {renderMessage(msg.content)}
                </div>
                <span style={{ fontSize: '0.65rem', color: 'var(--brand-muted)' }}>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
            {isTyping && (
              <div style={{ display: 'flex', gap: '4px', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '12px', width: 'fit-content' }}>
                <div className="typing-dot" style={{ background: 'var(--brand-primary)' }} />
                <div className="typing-dot" style={{ background: 'var(--brand-primary)' }} />
                <div className="typing-dot" style={{ background: 'var(--brand-primary)' }} />
              </div>
            )}
          </div>
        </div>

        {/* Footer / Input */}
        <div style={{
          padding: '20px 24px',
          background: 'rgba(13, 17, 23, 0.8)',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(251, 191, 36, 0.15)',
            borderRadius: '12px',
            padding: '4px 4px 4px 16px'
          }}>
            <input
              ref={inputRef}
              type="text"
              placeholder="Digite o número ou descreva o que precisa..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              autoComplete="off"
              style={{
                background: 'none', border: 'none', color: 'var(--brand-text)',
                fontSize: '0.85rem', flex: 1, outline: 'none', height: '40px',
                fontFamily: 'inherit',
              }}
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim()}
              style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: input.trim() ? 'var(--brand-primary)' : 'rgba(255,255,255,0.05)',
                border: 'none', color: '#0d1117', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
            >
              <Send size={18} />
            </button>
          </div>
          <p style={{ fontSize: '0.62rem', color: 'var(--brand-muted)', textAlign: 'center', marginTop: '12px' }}>
            PALIN AI — conectada ao CRM, Pipeline e dados em tempo real.
          </p>
        </div>

      </div>
    </div>
  )
}
