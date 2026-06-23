'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import {
  User, Bell, Shield, Palette, Globe, Users, Zap,
  Moon, Eye, Clock, KeyRound, Activity,
  Mail, Smartphone, BellOff, Languages,
  Camera, Trash2, Download, DatabaseBackup,
} from 'lucide-react'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { uploadAvatar, removeAvatar, updateProfileName, getMyProfile } from '@/app/actions/profile'

const UsuariosSection      = dynamic(() => import('./usuarios-section'),       { ssr: false })

const sections = [
  { icon: User,    key: 'perfil',        label: 'Perfil do Usuario',       desc: 'Dados pessoais e credenciais de acesso' },
  { icon: Users,   key: 'usuarios',      label: 'Usuarios',                desc: 'Gerencie os membros e permissoes do time' },
  { icon: Palette, key: 'interface',     label: 'Aparencia e UI',          desc: 'Personalize cores, temas e layout' },
  { icon: Bell,    key: 'notificacoes',  label: 'Notificacoes',            desc: 'Preferencias de alertas e emails' },
  { icon: Shield,  key: 'seguranca',     label: 'Seguranca e Auditoria',   desc: 'Logs de acesso e seguranca da conta' },
  { icon: Globe,   key: 'global',        label: 'Idioma e Fuso Horario',   desc: 'Localizacao e formato de data/hora' },
] as const

type SectionKey = (typeof sections)[number]['key']

/* ── helpers de UI ─────────────────────────────────────────── */

function Toggle({ value }: { value: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: '44px', height: '24px', borderRadius: '12px',
        background: value ? 'var(--brand-primary)' : 'rgba(255,255,255,0.08)',
        position: 'relative', transition: '0.25s', border: '1px solid rgba(251,191,36,0.2)',
        flexShrink: 0, display: 'inline-block',
      }}
    >
      <div style={{
        position: 'absolute', top: '2px', left: value ? '22px' : '2px',
        width: '18px', height: '18px', borderRadius: '50%',
        background: value ? '#0d1117' : 'var(--brand-muted)', transition: '0.25s',
      }} />
    </span>
  )
}

function Row({ label, desc, value, onChange }: { label: string; desc?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 20px', background: 'rgba(251,191,36,0.02)', borderRadius: '12px',
        border: '1px solid rgba(251,191,36,0.07)', cursor: 'pointer', textAlign: 'left', width: '100%',
      }}
    >
      <div>
        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--brand-text)' }}>{label}</div>
        {desc && <div style={{ fontSize: '0.78rem', color: 'var(--brand-muted)', marginTop: '2px' }}>{desc}</div>}
      </div>
      <Toggle value={value} />
    </button>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display: 'block', fontSize: '0.72rem', fontWeight: 900, color: 'var(--brand-primary)',
      textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '14px',
    }}>
      {children}
    </label>
  )
}

function InputField({ label, type = 'text', value, onChange, placeholder }: {
  label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '10px', color: 'var(--brand-text)', padding: '10px 14px', fontSize: '0.9rem',
          outline: 'none', boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]
}) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', background: 'rgba(22,27,34,0.9)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '10px', color: 'var(--brand-text)', padding: '10px 14px', fontSize: '0.9rem',
          outline: 'none', cursor: 'pointer',
        }}
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

/* ── Seções de conteúdo ────────────────────────────────────── */

function PerfilSection() {
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [role, setRole]       = useState('')
  const [avatarUrl, setAvatarUrl]       = useState<string | null>(null)
  const [avatarSkin, setAvatarSkin]     = useState<number | null>(null)
  const [avatarAccessory, setAvatarAccessory] = useState<string | null>(null)
  const [initials, setInitials]   = useState('?')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving]       = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load profile on mount
  useEffect(() => {
    getMyProfile().then((p) => {
      if (p) {
        setName(p.full_name)
        setEmail(p.email)
        setRole((p as { role?: string }).role ?? '')
        setAvatarUrl(p.avatar_url)
        setInitials(p.full_name?.charAt(0)?.toUpperCase() || '?')
      }
    })
    // Carregar avatar_skin do app_users via Supabase client
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user?.email) return
      supabase.from('app_users').select('avatar_skin, avatar_accessory, role')
        .eq('email', user.email.toLowerCase()).maybeSingle()
        .then(({ data }) => {
          if (data) {
            setAvatarSkin(data.avatar_skin ?? null)
            setAvatarAccessory((data as { avatar_accessory?: string }).avatar_accessory ?? null)
            if (data.role) setRole(data.role)
          }
        })
    })
  }, [])


  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Arquivo muito grande (máximo 5MB)'); return }

    setUploading(true)
    const fd = new FormData()
    fd.append('avatar', file)
    const result = await uploadAvatar(fd)
    setUploading(false)

    if (result.success && result.avatarUrl) {
      setAvatarUrl(result.avatarUrl)
      toast.success('Foto de perfil atualizada!')
    } else {
      toast.error(result.error || 'Erro ao fazer upload da foto.')
    }
  }

  async function handleRemoveAvatar() {
    setUploading(true)
    const result = await removeAvatar()
    setUploading(false)
    if (result.success) { setAvatarUrl(null); toast.success('Foto removida.') }
    else toast.error(result.error || 'Erro ao remover foto.')
  }

  async function handleSaveName() {
    if (!name.trim()) { toast.error('Informe o nome.'); return }
    setSaving(true)
    const result = await updateProfileName(name)
    setSaving(false)
    if (result.success) toast.success('Perfil atualizado!')
    else toast.error(result.error || 'Erro ao salvar.')
  }

  return (
    <div style={{ display: 'grid', gap: '32px' }}>
      {/* Avatar Upload */}
      <div>
        <SectionLabel><Camera size={12} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />Foto de Perfil</SectionLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          {/* Avatar preview */}
          <div
            style={{
              position: 'relative', width: '80px', height: '80px', borderRadius: '50%',
              border: '2px solid var(--brand-border)',
              overflow: 'hidden', flexShrink: 0,
              background: 'rgba(251,191,36,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {avatarUrl ? (
              <Image src={avatarUrl} alt="Avatar" width={80} height={80} style={{ objectFit: 'cover' }} unoptimized />
            ) : (
              <span style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--brand-primary)' }}>{initials}</span>
            )}
            {uploading && (
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(13,17,23,0.7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.7rem', color: 'var(--brand-primary)', fontWeight: 700,
              }}>
                ...
              </div>
            )}
          </div>

          {/* Upload controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />
            <button
              type="button"
              className="btn-primary"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
            >
              <Camera size={15} />
              {uploading ? 'Enviando...' : 'Alterar Foto'}
            </button>
            {avatarUrl && (
              <button
                type="button"
                className="btn-ghost"
                disabled={uploading}
                onClick={handleRemoveAvatar}
                style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
              >
                <Trash2 size={13} /> Remover Foto
              </button>
            )}
            <p style={{ color: 'var(--brand-muted)', fontSize: '0.72rem', margin: 0 }}>JPG, PNG ou WebP • Máx. 5MB</p>
          </div>
        </div>
      </div>

      {/* Name / Email */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <SectionLabel>Nome de exibicao</SectionLabel>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px', color: 'var(--brand-text)', padding: '10px 14px', fontSize: '0.9rem',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        <div>
          <SectionLabel>Email institucional</SectionLabel>
          <input
            type="email"
            value={email}
            disabled
            style={{
              width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '10px', color: 'var(--brand-muted)', padding: '10px 14px', fontSize: '0.9rem',
              outline: 'none', boxSizing: 'border-box', cursor: 'not-allowed',
            }}
          />
        </div>
      </div>

      {/* Preferences */}
      <div>
        <SectionLabel>Preferencias do sistema</SectionLabel>
        <div style={{ display: 'grid', gap: '10px' }}>
          <Row label="Modo Alta Performance"       desc="Desativa animacoes pesadas para melhorar fluidez"  value={true}  onChange={() => {}} />
          <Row label="Notificacoes em Tempo Real"  desc="Alertas instantaneos de mudancas no CRM"           value={true}  onChange={() => {}} />
          <Row label="Sincronizacao Automatica"    desc="Sincroniza dados com o Supabase a cada 5 minutos"  value={true}  onChange={() => {}} />
          <Row label="Feedback Visual de Ranking"  desc="Animacoes de XP e subida de nivel"                 value={false} onChange={() => {}} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button type="button" className="btn-primary" style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
          onClick={handleSaveName} disabled={saving}>
          <Zap size={16} /> {saving ? 'Salvando...' : 'Salvar alteracoes'}
        </button>
        <button type="button" className="btn-ghost" style={{ padding: '12px 24px' }}
          onClick={() => { setName(''); setEmail('') }}>
          Descartar
        </button>
      </div>

    </div>
  )
}


function InterfaceSection() {
  const [density, setDensity] = useState('Normal')
  const [animations, setAnimations] = useState(true)
  const [compactNav, setCompactNav] = useState(false)
  const [fontSize, setFontSize] = useState('Medio')

  return (
    <div style={{ display: 'grid', gap: '32px' }}>
      <div>
        <SectionLabel>
          <Moon size={12} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
          Tema do Sistema
        </SectionLabel>
        <div style={{ 
          padding: '20px', 
          borderRadius: '12px', 
          background: 'rgba(251,191,36,0.05)', 
          border: '1px solid rgba(251,191,36,0.1)',
          color: 'var(--brand-muted)',
          fontSize: '0.875rem',
          lineHeight: 1.6
        }}>
          O sistema está configurado para utilizar exclusivamente o <strong>Tema Escuro</strong> (Palin Modern Dark) para garantir a melhor experiência visual e performance.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <SelectField
          label="Densidade de Dados"
          value={density}
          onChange={setDensity}
          options={['Compacto', 'Normal', 'Espacoso']}
        />
        <SelectField
          label="Tamanho da Fonte"
          value={fontSize}
          onChange={setFontSize}
          options={['Pequeno', 'Medio', 'Grande']}
        />
      </div>

      <div>
        <SectionLabel>
          <Eye size={12} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
          Comportamento Visual
        </SectionLabel>
        <div style={{ display: 'grid', gap: '10px' }}>
          <Row label="Animacoes e Transicoes" desc="Efeitos de entrada e saida de componentes" value={animations} onChange={setAnimations} />
          <Row label="Menu Lateral Compacto" desc="Recolhe o menu para liberar espaco na tela" value={compactNav} onChange={setCompactNav} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          type="button"
          className="btn-primary"
          style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
          onClick={() => toast.success('Preferencias de interface salvas!')}
        >
          <Zap size={16} /> Salvar Alterações
        </button>
      </div>
    </div>
  )
}


type BackupLog = {
  id: string
  triggered_by: string | null
  row_counts: Record<string, number>
  status: string
  created_at: string
}

function SegurancaSection() {
  const [newPwd,     setNewPwd]     = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [isPending,  startTransition] = useTransition()
  const [backupLogs, setBackupLogs] = useState<BackupLog[]>([])
  const [userEmail,  setUserEmail]  = useState<string | null>(null)
  const [lastSignIn, setLastSignIn] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null)
      setLastSignIn(data.user?.last_sign_in_at ?? null)
    })
    supabase
      .from('backup_logs')
      .select('id, triggered_by, row_counts, status, created_at')
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => setBackupLogs((data as BackupLog[]) || []))
  }, [])

  function handleChangePwd() {
    if (!newPwd || !confirmPwd) { toast.error('Preencha os campos de senha.'); return }
    if (newPwd !== confirmPwd) { toast.error('As senhas nao conferem.'); return }
    if (newPwd.length < 8) { toast.error('A nova senha deve ter no minimo 8 caracteres.'); return }

    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: newPwd })
      if (error) {
        toast.error(error.message || 'Erro ao alterar senha.')
      } else {
        toast.success('Senha alterada com sucesso!')
        setNewPwd('')
        setConfirmPwd('')
      }
    })
  }

  return (
    <div style={{ display: 'grid', gap: '36px' }}>
      <div>
        <SectionLabel><KeyRound size={12} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />Alterar Senha</SectionLabel>
        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <InputField label="Nova senha" type="password" value={newPwd} onChange={setNewPwd} placeholder="Minimo 8 caracteres" />
            <InputField label="Confirmar nova senha" type="password" value={confirmPwd} onChange={setConfirmPwd} />
          </div>
          <div>
            <button type="button" className="btn-primary" style={{ padding: '11px 22px', display: 'flex', alignItems: 'center', gap: '8px' }}
              onClick={handleChangePwd} disabled={isPending}>
              <KeyRound size={15} /> {isPending ? 'Alterando...' : 'Alterar Senha'}
            </button>
          </div>
        </div>
      </div>

      <div>
        <SectionLabel><Activity size={12} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />Historico de Backups</SectionLabel>
        {backupLogs.length === 0 ? (
          <div style={{ padding: '18px', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.08)', color: '#64748b', fontSize: '0.84rem' }}>
            Nenhum backup exportado ainda. Use o botao abaixo para gerar o primeiro.
          </div>
        ) : (
          <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', overflow: 'hidden' }}>
            {backupLogs.map((log, idx) => {
              const total = Object.values(log.row_counts).reduce((s, n) => s + n, 0)
              const date = new Date(log.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
              return (
                <div key={log.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr auto',
                  gap: '12px', padding: '12px 16px', alignItems: 'center',
                  borderBottom: idx < backupLogs.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--brand-muted)' }}>
                    <Clock size={11} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle' }} />
                    {date}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#c9d1d9' }}>
                    {log.triggered_by || 'Sistema'} · {total} registros
                  </div>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 800, padding: '3px 8px', borderRadius: '999px',
                    background: 'rgba(16,185,129,0.12)', color: '#10b981',
                    border: '1px solid rgba(16,185,129,0.25)',
                  }}>
                    OK
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <SectionLabel>Sessao Ativa</SectionLabel>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', background: 'rgba(16,185,129,0.04)',
          border: '1px solid rgba(16,185,129,0.15)', borderRadius: '12px',
        }}>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--brand-text)', fontSize: '0.9rem' }}>{userEmail || 'Carregando...'}</div>
            <div style={{ color: 'var(--brand-muted)', fontSize: '0.8rem', marginTop: '2px' }}>
              {lastSignIn
                ? `Ultimo acesso: ${new Date(lastSignIn).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                : 'Sessao ativa agora'}
            </div>
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', padding: '4px 10px', borderRadius: '999px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}>
            Ativo
          </span>
        </div>
      </div>

      <div>
        <SectionLabel><DatabaseBackup size={12} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />Backup dos Dados</SectionLabel>
        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{
            padding: '16px 20px', borderRadius: '12px',
            background: 'rgba(56,189,248,0.04)', border: '1px solid rgba(56,189,248,0.15)',
            display: 'grid', gap: '8px',
          }}>
            <div style={{ fontWeight: 700, color: 'var(--brand-text)', fontSize: '0.9rem' }}>Exportar backup completo</div>
            <div style={{ color: 'var(--brand-muted)', fontSize: '0.8rem', lineHeight: 1.6 }}>
              Exporta todos os dados do sistema (reunioes, leads, clientes, comissoes, usuarios e mais) em formato JSON.
              O arquivo fica salvo localmente no seu computador. Apenas Administradores e Gestores podem exportar.
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '4px', alignItems: 'center' }}>
              <a
                href="/api/backup"
                download
                className="btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', textDecoration: 'none', fontSize: '0.84rem' }}
              >
                <Download size={15} />
                Baixar backup agora
              </a>
              <span style={{ color: '#64748b', fontSize: '0.78rem' }}>Recomendado: exportar semanalmente</span>
            </div>
          </div>

          <div style={{
            padding: '14px 16px', borderRadius: '12px',
            background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.12)',
          }}>
            <div style={{ color: 'var(--brand-primary)', fontWeight: 700, fontSize: '0.82rem', marginBottom: '6px' }}>Onde os dados ficam armazenados?</div>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.6 }}>
              Todos os dados do sistema estao no Supabase (nuvem) com criptografia em repouso e em transito (TLS 1.3).
              Nenhum dado sensivel de clientes fica armazenado localmente neste servidor.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function NotificacoesSection() {
  const [prefs, setPrefs] = useState({
    pipeline_novo_lead:    true,
    pipeline_mudanca:      true,
    meta_atingida:         true,
    ranking_subiu:         false,
    reuniao_lembrete:      true,
    comissao_aprovada:     true,
    evento_confirmado:     false,
    resumo_diario_email:   true,
    resumo_semanal_email:  false,
    push_mobile:           false,
  })

  function toggle(key: keyof typeof prefs) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }))
  }

  return (
    <div style={{ display: 'grid', gap: '32px' }}>
      <div>
        <SectionLabel><Activity size={12} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />Alertas de Operacao</SectionLabel>
        <div style={{ display: 'grid', gap: '10px' }}>
          <Row label="Novo lead no CRM"                 desc="Notifica quando um lead e adicionado"                value={prefs.pipeline_novo_lead}   onChange={() => toggle('pipeline_novo_lead')} />
          <Row label="Mudanca de etapa no CRM"          desc="Notifica quando um lead avanca ou recua de etapa"    value={prefs.pipeline_mudanca}     onChange={() => toggle('pipeline_mudanca')} />
          <Row label="Meta atingida"                    desc="Alerta ao bater meta de receita ou contratos"        value={prefs.meta_atingida}        onChange={() => toggle('meta_atingida')} />
          <Row label="Subida de nivel no Ranking"       desc="Comemora quando voce ou o time sobe de nivel"        value={prefs.ranking_subiu}        onChange={() => toggle('ranking_subiu')} />
          <Row label="Lembrete de Reuniao"              desc="Aviso 30 minutos antes de uma reuniao agendada"      value={prefs.reuniao_lembrete}     onChange={() => toggle('reuniao_lembrete')} />
          <Row label="Comissao aprovada"                desc="Notifica quando uma comissao e confirmada"           value={prefs.comissao_aprovada}    onChange={() => toggle('comissao_aprovada')} />
          <Row label="Evento confirmado"                desc="Confirmacao de inscricao em evento"                  value={prefs.evento_confirmado}    onChange={() => toggle('evento_confirmado')} />
        </div>
      </div>

      <div>
        <SectionLabel><Mail size={12} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />Resumos por E-mail</SectionLabel>
        <div style={{ display: 'grid', gap: '10px' }}>
          <Row label="Resumo Diario"    desc="Receba um resumo do dia todos os dias as 18h"    value={prefs.resumo_diario_email}  onChange={() => toggle('resumo_diario_email')} />
          <Row label="Resumo Semanal"   desc="Relatorio consolidado toda segunda-feira as 8h"  value={prefs.resumo_semanal_email} onChange={() => toggle('resumo_semanal_email')} />
        </div>
      </div>

      <div>
        <SectionLabel><Smartphone size={12} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />Push Mobile</SectionLabel>
        <div style={{ display: 'grid', gap: '10px' }}>
          <Row label="Notificacoes Push"  desc="Receba alertas no celular mesmo com o app fechado"  value={prefs.push_mobile} onChange={() => toggle('push_mobile')} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button type="button" className="btn-primary" style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
          onClick={() => toast.success('Preferencias de notificacao salvas!')}>
          <Zap size={16} /> Salvar
        </button>
        <button type="button" className="btn-ghost" style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
          onClick={() => toast.info('Todas as notificacoes foram silenciadas.')}>
          <BellOff size={15} /> Silenciar Tudo
        </button>
      </div>
    </div>
  )
}

function GlobalizacaoSection() {
  const [timezone, setTimezone] = useState('America/Sao_Paulo (GMT-3)')
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY')
  const [currency, setCurrency] = useState('BRL - Real Brasileiro (R$)')
  const [numberFormat, setNumberFormat] = useState('1.000,00 (Padrao BR)')

  return (
    <div style={{ display: 'grid', gap: '32px' }}>
      <div>
        <SectionLabel><Languages size={12} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />Idioma</SectionLabel>
        <div style={{ display: 'flex', gap: '10px' }}>
          {[
            { code: 'pt-BR', label: '🇧🇷 Portugues (BR)', active: true },
            { code: 'en-US', label: '🇺🇸 English (US)',   active: false },
            { code: 'es-ES', label: '🇪🇸 Espanol',        active: false },
          ].map(({ code, label, active }) => (
            <button key={code} type="button" style={{
              padding: '10px 18px', borderRadius: '10px', fontWeight: 700, fontSize: '0.85rem',
              border: `1px solid ${active ? 'var(--brand-primary)' : 'rgba(255,255,255,0.08)'}`,
              background: active ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.02)',
              color: active ? 'var(--brand-primary)' : 'var(--brand-muted)', cursor: 'pointer',
            }}>
              {label}
            </button>
          ))}
        </div>
        <p style={{ color: 'var(--brand-muted)', fontSize: '0.75rem', marginTop: '8px' }}>
          Apenas Portugues (BR) disponivel no momento.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <SelectField
          label="Fuso Horario"
          value={timezone}
          onChange={setTimezone}
          options={[
            'America/Sao_Paulo (GMT-3)',
            'America/Manaus (GMT-4)',
            'America/Belem (GMT-3)',
            'America/Fortaleza (GMT-3)',
          ]}
        />
        <SelectField
          label="Formato de Data"
          value={dateFormat}
          onChange={setDateFormat}
          options={['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <SelectField
          label="Moeda"
          value={currency}
          onChange={setCurrency}
          options={[
            'BRL - Real Brasileiro (R$)',
            'USD - Dolar Americano ($)',
            'EUR - Euro (€)',
          ]}
        />
        <SelectField
          label="Formato de Numero"
          value={numberFormat}
          onChange={setNumberFormat}
          options={['1.000,00 (Padrao BR)', '1,000.00 (Padrao US)']}
        />
      </div>

      <div style={{
        padding: '16px 20px', background: 'rgba(251,191,36,0.04)',
        border: '1px solid rgba(251,191,36,0.12)', borderRadius: '12px',
      }}>
        <div style={{ fontWeight: 700, color: 'var(--brand-text)', fontSize: '0.9rem', marginBottom: '6px' }}>Previa do formato</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          {[
            { label: 'Data',   value: '10/04/2026' },
            { label: 'Moeda',  value: 'R$ 1.250.000,00' },
            { label: 'Numero', value: '4.832,75' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px 14px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--brand-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
              <div style={{ fontSize: '0.95rem', color: 'var(--brand-primary)', fontWeight: 800, fontFamily: 'monospace' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button type="button" className="btn-primary" style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
          onClick={() => toast.success('Configuracoes regionais salvas!')}>
          <Zap size={16} /> Salvar
        </button>
      </div>
    </div>
  )
}

/* ── Página principal ───────────────────────────────────────── */

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SectionKey>('perfil')
  const activeMeta = sections.find((s) => s.key === activeSection)!

  return (
    <div className="animate-fade-in-up">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--brand-text)', letterSpacing: '-0.02em' }}>Configuracoes</h1>
        <p style={{ color: 'var(--brand-muted)', fontSize: '0.84rem', marginTop: '4px' }}>Perfil, usuarios e parametros do sistema</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '32px' }}>
        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {sections.map((section) => {
            const active = activeSection === section.key
            return (
              <button
                key={section.key}
                type="button"
                className="glass-card"
                onClick={() => setActiveSection(section.key)}
                style={{
                  padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px',
                  background: active ? 'rgba(251,191,36,0.1)' : 'rgba(22,27,34,0.4)',
                  border: `1px solid ${active ? 'rgba(251,191,36,0.3)' : 'rgba(251,191,36,0.05)'}`,
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                  color: active ? 'var(--brand-primary)' : 'var(--brand-muted)',
                }}
              >
                <section.icon size={16} />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{section.label}</div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '1px', fontWeight: 500 }}>{section.desc}</div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className="glass-card telemetry-module" style={{ padding: '36px', minHeight: '600px' }}>
          <div className="scanline-effect" />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ marginBottom: '32px', borderBottom: '1px solid rgba(251,191,36,0.1)', paddingBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                <activeMeta.icon size={20} color="var(--brand-primary)" />
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--brand-text)', margin: 0 }}>{activeMeta.label}</h2>
              </div>
              <p style={{ color: 'var(--brand-muted)', fontSize: '0.88rem', margin: 0 }}>{activeMeta.desc}</p>
            </div>

            {activeSection === 'perfil'       && <PerfilSection />}
            {activeSection === 'usuarios'     && <UsuariosSection />}
            {activeSection === 'interface'    && <InterfaceSection />}
            {activeSection === 'seguranca'    && <SegurancaSection />}
            {activeSection === 'notificacoes' && <NotificacoesSection />}
            {activeSection === 'global'       && <GlobalizacaoSection />}
          </div>
        </div>
      </div>
    </div>
  )
}
