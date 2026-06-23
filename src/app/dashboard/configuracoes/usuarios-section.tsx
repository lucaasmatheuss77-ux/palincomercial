'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  UserPlus, Trash2, UserCheck, UserX, ChevronDown, ChevronUp,
  Pencil, Users, Check, X, AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  listUsers, createUser, updateUser, deleteUser, toggleUserStatus, getUserPermissions,
  type AppUser, type PermissionInput,
} from '@/app/actions/usuarios'

const MODULES = [
  { key: 'Home',          label: 'Dashboard' },
  { key: 'Equipe',        label: 'Equipe' },
  { key: 'Produtos',      label: 'Produtos' },
  { key: 'Metas',         label: 'Metas' },
  { key: 'Pipeline',      label: 'CRM' },
  { key: 'Clientes',      label: 'Clientes' },
  { key: 'Agenda',        label: 'Agenda' },
  { key: 'Comissoes',     label: 'Comissoes' },
  { key: 'Eventos',       label: 'Eventos' },
  { key: 'Ranking',       label: 'Ranking' },
  { key: 'Relatorios',    label: 'Relatorios' },
  { key: 'Planejamento',  label: 'Planej. Est.' },
  { key: 'Configuracoes', label: 'Configuracoes' },
]

const ROLES = ['Administrador', 'Gestor', 'Consultor', 'SDR', 'Somente Leitura', 'Painel TV'] as const
type Role = (typeof ROLES)[number]

function makePreset(role: Role): PermissionInput[] {
  return MODULES.map(({ key }) => {
    if (role === 'Administrador') return { module: key, can_view: true,  can_edit: true,  can_delete: true }
    if (role === 'Gestor')        return { module: key, can_view: true,  can_edit: true,  can_delete: key !== 'Configuracoes' }
    if (role === 'Consultor')     return {
      module: key,
      can_view: true,
      can_edit: ['Pipeline', 'Agenda', 'Comissoes', 'Eventos'].includes(key),
      can_delete: false,
    }
    if (role === 'SDR')           return {
      module: key,
      can_view:  ['Home', 'Pipeline', 'Clientes', 'Agenda', 'Ranking', 'Produtos', 'Eventos'].includes(key),
      can_edit:  ['Pipeline', 'Agenda'].includes(key),
      can_delete: false,
    }
    if (role === 'Painel TV')     return { module: key, can_view: key === 'Home', can_edit: false, can_delete: false }
    // Somente Leitura
    return { module: key, can_view: true, can_edit: false, can_delete: false }
  })
}

const ROLE_COLORS: Record<Role, string> = {
  Administrador:   '#ef4444',
  Gestor:          'var(--brand-primary)',
  Consultor:       '#38bdf8',
  SDR:             '#3b82f6',
  'Somente Leitura': '#6b7280',
  'Painel TV':     '#22d3ee',
}

const EMPTY_FORM = {
  full_name: '',
  email: '',
  role: 'Consultor' as Role,
  permissions: makePreset('Consultor'),
}

type FormState = typeof EMPTY_FORM

// I3 — Adicionado role="checkbox" e aria-checked para acessibilidade
function PermCheckbox({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={value}
      onClick={() => onChange(!value)}
      style={{
        width: '22px', height: '22px', borderRadius: '6px', border: '1px solid',
        borderColor: value ? 'var(--brand-primary)' : 'rgba(255,255,255,0.1)',
        background: value ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.02)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      {value && <Check size={13} color="var(--brand-primary)" />}
    </button>
  )
}

// I2 — UserRow recebe loadingEdit para desabilitar/mostrar spinner no botão Editar
function UserRow({
  user,
  onEdit,
  onDelete,
  onToggle,
  loadingEdit,
}: {
  user: AppUser
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  loadingEdit: string | null
}) {
  const [isPending, startTransition] = useTransition()
  const roleColor = ROLE_COLORS[user.role as Role] ?? 'var(--brand-muted)'
  const isEditLoading = loadingEdit === user.id

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto auto auto',
        alignItems: 'center',
        gap: '16px',
        padding: '14px 20px',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.05)',
        opacity: user.is_active ? 1 : 0.5,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%', background: `${roleColor}22`,
          border: `1.5px solid ${roleColor}44`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '0.85rem', fontWeight: 800, color: roleColor, flexShrink: 0,
        }}>
          {user.full_name.charAt(0).toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: 'var(--brand-text)', fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user.full_name}
          </div>
          <div style={{ color: 'var(--brand-muted)', fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user.email}
          </div>
        </div>
      </div>

      <span style={{
        fontSize: '0.72rem', fontWeight: 800, padding: '4px 10px', borderRadius: '999px',
        background: `${roleColor}18`, color: roleColor, border: `1px solid ${roleColor}33`,
        whiteSpace: 'nowrap',
      }}>
        {user.role}
      </span>

      <span style={{
        fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: '999px',
        background: user.is_active ? 'rgba(16,185,129,0.12)' : 'rgba(107,114,128,0.12)',
        color: user.is_active ? '#10b981' : '#6b7280',
        border: `1px solid ${user.is_active ? 'rgba(16,185,129,0.25)' : 'rgba(107,114,128,0.2)'}`,
        whiteSpace: 'nowrap',
      }}>
        {user.is_active ? 'Ativo' : 'Inativo'}
      </span>

      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          type="button"
          title={user.is_active ? 'Desativar' : 'Ativar'}
          disabled={isPending}
          onClick={() => startTransition(onToggle)}
          style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
            color: 'var(--brand-muted)', cursor: 'pointer', padding: '6px', display: 'flex',
          }}
        >
          {user.is_active ? <UserX size={15} /> : <UserCheck size={15} />}
        </button>
        {/* I2 — Botão Editar desabilitado e com feedback visual quando loadingEdit === user.id */}
        <button
          type="button"
          title="Editar"
          disabled={isEditLoading}
          onClick={onEdit}
          style={{
            background: 'none', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '8px',
            color: isEditLoading ? 'var(--brand-muted)' : 'var(--brand-primary)',
            cursor: isEditLoading ? 'not-allowed' : 'pointer',
            padding: '6px', display: 'flex',
            opacity: isEditLoading ? 0.6 : 1,
          }}
        >
          {isEditLoading ? <span style={{ fontSize: '0.7rem', lineHeight: '15px' }}>...</span> : <Pencil size={15} />}
        </button>
        <button
          type="button"
          title="Excluir"
          disabled={isPending}
          onClick={() => {
            if (confirm(`Excluir o usuário "${user.full_name}"? Esta ação não pode ser desfeita.`)) {
              startTransition(onDelete)
            }
          }}
          style={{
            background: 'none', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px',
            color: '#ef4444', cursor: 'pointer', padding: '6px', display: 'flex',
          }}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}

function UserForm({
  initial,
  editingId,
  onSuccess,
  onCancel,
}: {
  initial: FormState
  editingId: string | null
  onSuccess: () => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<FormState>(initial)
  const [isPending, startTransition] = useTransition()
  const [showPerms, setShowPerms] = useState(true)

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function applyPreset(role: Role) {
    setForm((f) => ({ ...f, role, permissions: makePreset(role) }))
  }

  function setPerm(module: string, field: 'can_view' | 'can_edit' | 'can_delete', value: boolean) {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.map((p) =>
        p.module === module
          ? {
              ...p,
              [field]: value,
              // Se desligar view, desliga os demais
              ...(field === 'can_view' && !value ? { can_edit: false, can_delete: false } : {}),
            }
          : p
      ),
    }))
  }

  function handleSubmit() {
    if (!form.full_name.trim()) { toast.error('Informe o nome completo.'); return }
    if (!form.email.trim() || !form.email.includes('@')) { toast.error('Informe um e-mail válido.'); return }

    startTransition(async () => {
      const result = editingId
        ? await updateUser(editingId, form)
        : await createUser(form)

      if (!result.success) {
        toast.error(result.error ?? 'Erro ao salvar usuário.')
      } else {
        toast.success(editingId ? 'Usuário atualizado!' : 'Usuário criado com sucesso!')
        onSuccess()
      }
    })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', color: 'var(--brand-text)', padding: '10px 14px', fontSize: '0.9rem',
    outline: 'none', boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.72rem', fontWeight: 900, color: 'var(--brand-primary)',
    textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px',
  }

  return (
    <div style={{
      background: 'rgba(13,17,23,0.7)', border: '1px solid rgba(251,191,36,0.15)',
      borderRadius: '16px', padding: '28px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h3 style={{ color: 'var(--brand-text)', fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>
          {editingId ? 'Editar Usuário' : 'Criar Novo Usuário'}
        </h3>
        <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--brand-muted)', cursor: 'pointer', padding: '4px' }}>
          <X size={18} />
        </button>
      </div>

      {/* Campos básicos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        <div>
          <label style={labelStyle}>Nome Completo *</label>
          <input
            style={inputStyle} type="text" placeholder="Ex: João Silva"
            value={form.full_name} onChange={(e) => setField('full_name', e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle}>E-mail *</label>
          <input
            style={inputStyle} type="email" placeholder="joao@empresa.com"
            value={form.email} onChange={(e) => setField('email', e.target.value)}
          />
        </div>
      </div>

      {/* Perfil rápido */}
      <div style={{ marginBottom: '24px' }}>
        <label style={labelStyle}>Perfil Rápido</label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {ROLES.map((role) => {
            const active = form.role === role
            const color = ROLE_COLORS[role]
            return (
              <button
                key={role} type="button" onClick={() => applyPreset(role)}
                style={{
                  padding: '8px 16px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700,
                  cursor: 'pointer', border: `1px solid ${active ? color : `${color}44`}`,
                  background: active ? `${color}22` : 'rgba(255,255,255,0.02)',
                  color: active ? color : 'var(--brand-muted)', transition: 'all 0.2s',
                }}
              >
                {role}
              </button>
            )
          })}
        </div>
        <p style={{ color: 'var(--brand-muted)', fontSize: '0.75rem', marginTop: '8px' }}>
          Selecionar um perfil preenche automaticamente as permissões abaixo.
        </p>
      </div>

      {/* Permissões por módulo */}
      <div style={{ marginBottom: '28px' }}>
        <button
          type="button"
          onClick={() => setShowPerms((v) => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none',
            color: 'var(--brand-primary)', cursor: 'pointer', padding: '0 0 12px 0', fontSize: '0.72rem',
            fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em',
          }}
        >
          Permissoes por Modulo
          {showPerms ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showPerms && (
          <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px',
              gap: '8px', padding: '10px 16px',
              background: 'rgba(251,191,36,0.06)', borderBottom: '1px solid rgba(255,255,255,0.07)',
            }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--brand-primary)', textTransform: 'uppercase' }}>Módulo</span>
              {(['VER', 'CRIAR/EDITAR', 'EXCLUIR'] as const).map((h) => (
                <span key={h} style={{ fontSize: '0.68rem', fontWeight: 900, color: 'var(--brand-muted)', textTransform: 'uppercase', textAlign: 'center' }}>{h}</span>
              ))}
            </div>

            {MODULES.map(({ key, label }, idx) => {
              const perm = form.permissions.find((p) => p.module === key)!
              return (
                <div
                  key={key}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px',
                    gap: '8px', padding: '10px 16px', alignItems: 'center',
                    borderBottom: idx < MODULES.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                  }}
                >
                  <span style={{ fontSize: '0.85rem', color: '#c9d1d9', fontWeight: 600 }}>{label}</span>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <PermCheckbox value={perm.can_view} onChange={(v) => setPerm(key, 'can_view', v)} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <PermCheckbox
                      value={perm.can_edit}
                      onChange={(v) => setPerm(key, 'can_edit', v)}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <PermCheckbox
                      value={perm.can_delete}
                      onChange={(v) => setPerm(key, 'can_delete', v)}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Nota informativa */}
      <div style={{
        display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '12px 16px',
        background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)',
        borderRadius: '10px', marginBottom: '24px',
      }}>
        <AlertCircle size={15} color="#38bdf8" style={{ flexShrink: 0, marginTop: '1px' }} />
        <p style={{ color: 'var(--brand-muted)', fontSize: '0.78rem', margin: 0, lineHeight: 1.5 }}>
          O acesso do novo usuário será criado automaticamente no sistema com a senha padrão <strong>Palin@123</strong>. As permissões abaixo definem o que ele poderá acessar.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          type="button"
          disabled={isPending}
          onClick={handleSubmit}
          style={{
            padding: '12px 24px', borderRadius: '10px', fontWeight: 800, fontSize: '0.9rem',
            background: 'linear-gradient(135deg, var(--brand-primary), #f59e0b)', color: '#0d1117',
            border: 'none', cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.7 : 1,
          }}
        >
          {isPending ? 'Salvando...' : editingId ? 'Salvar Alteracoes' : 'Criar Usuario'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '12px 24px', borderRadius: '10px', fontWeight: 700, fontSize: '0.9rem',
            background: 'rgba(255,255,255,0.04)', color: 'var(--brand-muted)',
            border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

export default function UsuariosSection() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState<AppUser | null>(null)
  const [editingPerms, setEditingPerms] = useState<PermissionInput[]>([])
  const [loadingEdit, setLoadingEdit] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // I1 — Adicionado .catch() e .finally() para tratar erros e garantir reset do loading
  function reload() {
    setLoading(true)
    listUsers()
      .then((data) => setUsers(data))
      .catch(() => toast.error('Erro ao carregar usuários.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [])

  // I2 — handleEdit com estado loadingEdit para feedback visual
  async function handleEdit(user: AppUser) {
    setLoadingEdit(user.id)
    try {
      const perms = await getUserPermissions(user.id)
      const mapped: PermissionInput[] = MODULES.map(({ key }) => {
        const found = perms.find((p) => p.module === key)
        return {
          module: key,
          can_view:   !!found?.can_view,
          can_edit:   !!found?.can_edit,
          can_delete: !!found?.can_delete,
        }
      })
      setEditingPerms(mapped)
      setEditingUser(user)
      setShowForm(true)
    } finally {
      setLoadingEdit(null)
    }
  }

  function handleFormSuccess() {
    setShowForm(false)
    setEditingUser(null)
    setEditingPerms([])
    reload()
  }

  function handleFormCancel() {
    setShowForm(false)
    setEditingUser(null)
    setEditingPerms([])
  }

  const activeUsers   = users.filter((u) => u.is_active).length
  const inactiveUsers = users.filter((u) => !u.is_active).length

  return (
    <div style={{ display: 'grid', gap: '28px' }}>
      {/* Stats header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {[
          { label: 'Total de Usuarios', value: users.length, color: 'var(--brand-primary)' },
          { label: 'Usuarios Ativos',   value: activeUsers,   color: '#10b981' },
          { label: 'Usuarios Inativos', value: inactiveUsers, color: '#6b7280' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            style={{
              padding: '16px 20px', background: 'rgba(255,255,255,0.02)',
              border: `1px solid ${color}22`, borderRadius: '12px',
            }}
          >
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color }}>{value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--brand-muted)', fontWeight: 600, marginTop: '2px' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Actions bar */}
      {!showForm && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => { setEditingUser(null); setEditingPerms([]); setShowForm(true) }}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 20px', borderRadius: '10px', fontWeight: 800, fontSize: '0.85rem',
              background: 'linear-gradient(135deg, var(--brand-primary), #f59e0b)', color: '#0d1117', border: 'none', cursor: 'pointer',
            }}
          >
            <UserPlus size={16} />
            Criar Novo Usuario
          </button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <UserForm
          initial={editingUser
            ? { full_name: editingUser.full_name, email: editingUser.email, role: editingUser.role as Role, permissions: editingPerms }
            : EMPTY_FORM
          }
          editingId={editingUser?.id ?? null}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      )}

      {/* User list */}
      <div>
        <label style={{
          display: 'block', fontSize: '0.72rem', fontWeight: 900, color: 'var(--brand-primary)',
          textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '14px',
        }}>
          <Users size={13} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
          Membros do Time
        </label>

        {loading ? (
          <div style={{ color: 'var(--brand-muted)', fontSize: '0.9rem', padding: '24px 0', textAlign: 'center' }}>
            Carregando usuarios...
          </div>
        ) : users.length === 0 ? (
          <div style={{
            padding: '40px 24px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.1)',
            borderRadius: '12px', color: 'var(--brand-muted)',
          }}>
            <Users size={32} style={{ marginBottom: '12px', opacity: 0.4 }} />
            <p style={{ margin: 0, fontSize: '0.9rem' }}>Nenhum usuario cadastrado ainda.</p>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem' }}>Clique em &quot;Criar Novo Usuario&quot; para começar.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {users.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                loadingEdit={loadingEdit}
                onEdit={() => handleEdit(user)}
                // I8 — onDelete verifica result.success antes de recarregar
                onDelete={() => startTransition(async () => {
                  const result = await deleteUser(user.id)
                  if (result.success) {
                    reload()
                    toast.success('Usuário removido.')
                  } else {
                    toast.error('Erro ao remover usuário.')
                  }
                })}
                // I8 — onToggle verifica result.success antes de recarregar
                onToggle={() => startTransition(async () => {
                  const result = await toggleUserStatus(user.id, !user.is_active)
                  if (result.success) {
                    reload()
                    toast.success(user.is_active ? 'Usuário desativado.' : 'Usuário ativado.')
                  } else {
                    toast.error('Erro ao alterar status do usuário.')
                  }
                })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
