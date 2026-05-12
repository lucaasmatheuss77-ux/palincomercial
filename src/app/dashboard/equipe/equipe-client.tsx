'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Briefcase, Mail, Phone, MessageCircle, Calendar, Search, Star, FileText, UserPlus, Trophy, Zap } from 'lucide-react'
import { toast } from 'sonner'
import ActionDialog from '@/components/action-dialog'
import { createUser, updateUser } from '@/app/actions/usuarios'
import type { AppUser } from '@/app/actions/usuarios'
import PixelRaceTrack from '@/components/PixelRaceTrack'
import PixelAvatar from '@/components/PixelAvatar'
import { skinFromName } from '@/components/PixelAvatar'
import type { RacePlayer } from '@/components/PixelRaceTrack'

type Product = { id: string; name: string }
type Props = { members: AppUser[]; products: Product[]; racePlayers?: RacePlayer[] }

const ROLES = ['Gestor','Consultor','Assistente Comercial','SDR','Administrador','Somente Leitura','Painel TV']

const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
  'Gestor':               { bg: 'rgba(88,166,255,0.15)',  color: '#93c5fd' },
  'Consultor':            { bg: 'rgba(16,185,129,0.15)',  color: '#6ee7b7' },
  'Assistente Comercial': { bg: 'rgba(196,132,252,0.15)', color: '#e9d5ff' },
  'SDR':                  { bg: 'rgba(251,191,36,0.15)',  color: '#fde68a' },
  'Administrador':        { bg: 'rgba(248,113,113,0.15)', color: '#fca5a5' },
  'Somente Leitura':      { bg: 'rgba(148,163,184,0.1)',  color: '#94a3b8' },
  'Painel TV':            { bg: 'rgba(148,163,184,0.1)',  color: '#94a3b8' },
}

const emptyForm = {
  full_name:'', email:'', role:'Consultor', cargo_titulo:'', phone:'',
  whatsapp:'', product_id:'', produto_foco:'', data_admissao:'', observacoes:'',
  avatar_skin: 0,
}

function getRoleStyle(role: string) { return ROLE_STYLE[role] ?? { bg: 'rgba(148,163,184,0.1)', color: '#94a3b8' } }

function RoleBadge({ role }: { role: string }) {
  const s = getRoleStyle(role)
  return <span style={{ display:'inline-block', padding:'3px 10px', borderRadius:'999px', fontSize:'0.72rem', fontWeight:700, background:s.bg, color:s.color, whiteSpace:'nowrap' }}>{role}</span>
}

function MemberCard({ member, onSelect, isLeader, score, progress }: {
  member: AppUser; onSelect: () => void; isLeader?: boolean; score?: number; progress?: number
}) {
  const skin = member.avatar_skin ?? skinFromName(member.full_name ?? member.id)
  const tier = (progress ?? 0) >= 75 ? { label:'🔥 Elite', color:'#f97316' }
    : (progress ?? 0) >= 50 ? { label:'⚡ Forte', color:'#10b981' }
    : (progress ?? 0) >= 25 ? { label:'📈 Aquecendo', color:'#3b82f6' }
    : { label:'🚀 Início', color:'#64748b' }

  return (
    <div style={{
      padding:'20px', borderRadius:16,
      background: isLeader ? 'linear-gradient(135deg,rgba(251,191,36,0.07),rgba(0,0,0,0.2))' : 'rgba(255,255,255,0.02)',
      border: isLeader ? '1px solid rgba(251,191,36,0.2)' : '1px solid rgba(255,255,255,0.05)',
      display:'flex', flexDirection:'column', gap:14, transition:'all 0.2s ease',
      cursor:'pointer',
    }} onClick={onSelect}>
      {/* Avatar + badge */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
          <PixelAvatar skin={skin as import('@/components/avatar-utils').AvatarSkin} size={3} walking={(score ?? 0) > 0} crowned={isLeader} label={member.full_name ?? ''} role={member.role ?? ''} produtoFoco={member.produto_foco ?? ''} />
          {isLeader && <span style={{ fontSize:'0.55rem', fontWeight:900, color:'#fbbf24', letterSpacing:'0.08em' }}>LÍDER</span>}
        </div>
        <RoleBadge role={member.role ?? 'Consultor'} />
      </div>

      {/* Info */}
      <div>
        <div style={{ fontWeight:900, fontSize:'0.9rem', color:'#f8fafc' }}>{member.full_name}</div>
        {member.cargo_titulo && <div style={{ fontSize:'0.72rem', color:'#64748b', marginTop:2 }}>{member.cargo_titulo}</div>}
        {member.produto_foco && <div style={{ fontSize:'0.72rem', color:'#93c5fd', marginTop:2 }}>{member.produto_foco}</div>}
      </div>

      {/* Progress bar */}
      {score !== undefined && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
            <span style={{ fontSize:'0.62rem', color:tier.color, fontWeight:800 }}>{tier.label}</span>
            <span style={{ fontSize:'0.62rem', color:'#475569' }}>{Math.round(progress ?? 0)}%</span>
          </div>
          <div style={{ height:5, background:'rgba(255,255,255,0.06)', borderRadius:3, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${Math.min(progress ?? 0, 100)}%`, background:`linear-gradient(90deg,${tier.color},${tier.color}88)`, borderRadius:3, transition:'width 1.2s cubic-bezier(0.34,1.56,0.64,1)' }} />
          </div>
          <div style={{ fontSize:'0.6rem', color:'#334155', marginTop:4 }}>{score} pts · meta 1500</div>
        </div>
      )}

      <button type="button" onClick={e=>{e.stopPropagation();onSelect()}} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:8, padding:'6px', fontSize:'0.72rem', color:'#94a3b8', cursor:'pointer', transition:'all 0.15s' }}>
        Ver perfil →
      </button>
    </div>
  )
}

export default function EquipeClient({ members: initialMembers, products, racePlayers = [] }: Props) {
  const router = useRouter()
  const [selectedMember, setSelectedMember] = useState<AppUser | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [showNewMember, setShowNewMember] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'arena'|'grid'|'list'>('arena')
  const [isPending, startTransition] = useTransition()

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return initialMembers
    return initialMembers.filter(m => [m.full_name, m.email, m.role, m.cargo_titulo ?? '', m.produto_foco ?? ''].join(' ').toLowerCase().includes(q))
  }, [initialMembers, query])

  const playerMap = useMemo(() => new Map(racePlayers.map(p => [p.id, p])), [racePlayers])

  function setField(key: keyof typeof emptyForm, value: string | number) { setForm(prev => ({ ...prev, [key]: value })) }
  function handleProductChange(productId: string) {
    const product = products.find(p => p.id === productId)
    setForm(prev => ({ ...prev, product_id: productId, produto_foco: product?.name ?? '' }))
  }
  function handleCloseNew() { setShowNewMember(false); setForm(emptyForm) }
  function handleCreate() {
    if (!form.full_name.trim() || !form.email.trim()) { toast.error('Nome e e-mail são obrigatórios.'); return }
    startTransition(async () => {
      const result = await createUser({
        full_name: form.full_name.trim(), email: form.email.trim(), role: form.role, permissions:[],
        phone: form.phone || undefined, whatsapp: form.whatsapp || undefined,
        cargo_titulo: form.cargo_titulo || undefined, data_admissao: form.data_admissao || undefined,
        produto_foco: form.produto_foco || undefined, product_id: form.product_id || undefined,
        observacoes: form.observacoes || undefined,
        avatar_skin: form.avatar_skin,
      })
      if (result.success) { toast.success('Membro cadastrado com sucesso.'); handleCloseNew(); router.refresh() }
      else { toast.error(result.error ?? 'Erro ao cadastrar membro.') }
    })
  }

  const topPlayer = racePlayers.length > 0 ? racePlayers.reduce((a,b) => b.score > a.score ? b : a) : null

  return (
    <div style={{ display:'grid', gap:24 }}>

      {/* ── HEADER ── */}
      <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:0 }}>
          <h1 style={{ fontSize:'1.35rem', fontWeight:900, color:'var(--brand-text)', letterSpacing:'-0.02em', display:'flex', alignItems:'center', gap:10 }}>
            <span>🕹️</span> Time
          </h1>
          <p style={{ color:'var(--brand-muted)', fontSize:'0.84rem', marginTop:4 }}>
            {initialMembers.length} colaboradores · Arena de performance dos consultores
          </p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          {/* Toggle de view */}
          {(['arena','grid','list'] as const).map(v => (
            <button key={v} type="button" onClick={() => setView(v)} style={{
              padding:'6px 14px', borderRadius:8, fontSize:'0.75rem', fontWeight:700, cursor:'pointer', border:'1px solid',
              background: view === v ? 'rgba(52,211,153,0.12)' : 'transparent',
              color: view === v ? '#34d399' : '#64748b',
              borderColor: view === v ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.06)',
            }}>
              {v === 'arena' ? '🏟️ Arena' : v === 'grid' ? '⬛ Cards' : '≡ Lista'}
            </button>
          ))}
          <div style={{ position:'relative' }}>
            <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--brand-muted)', pointerEvents:'none' }} />
            <input className="input-field" style={{ paddingLeft:32, width:200 }} placeholder="Buscar membro..." value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <button type="button" className="btn-primary" onClick={() => setShowNewMember(true)}>
            <UserPlus size={15} /> Novo membro
          </button>
        </div>
      </div>

      {/* ── ARENA VIEW ── */}
      {view === 'arena' && (
        <>
          {/* Pista de corrida */}
          {racePlayers.length > 0 && <PixelRaceTrack players={racePlayers} metaLabel="3 contratos" />}

          {/* Cards de consultores */}
          {racePlayers.length > 0 && (
            <div>
              <div style={{ marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
                <Trophy size={16} color="#fbbf24" />
                <span style={{ fontSize:'0.8rem', fontWeight:800, color:'#f8fafc' }}>Consultores</span>
                {topPlayer && <span style={{ fontSize:'0.72rem', color:'#fbbf24' }}>Líder: {topPlayer.name.split(' ')[0]}</span>}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12 }}>
                {[...racePlayers].sort((a,b) => b.score - a.score).map(p => {
                  const m = initialMembers.find(x => x.id === p.id)
                  if (!m) return null
                  return <MemberCard key={p.id} member={m} isLeader={p.isLeader} score={p.score} progress={p.progress} onSelect={() => setSelectedMember(m)} />
                })}
              </div>
            </div>
          )}

          {/* Demais membros sem score */}
          {initialMembers.filter(m => !playerMap.has(m.id)).length > 0 && (
            <div>
              <div style={{ marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
                <Zap size={16} color="#94a3b8" />
                <span style={{ fontSize:'0.8rem', fontWeight:800, color:'#64748b' }}>Outros colaboradores</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12 }}>
                {initialMembers.filter(m => !playerMap.has(m.id)).map(m => (
                  <MemberCard key={m.id} member={m} onSelect={() => setSelectedMember(m)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── GRID VIEW ── */}
      {view === 'grid' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12 }}>
          {filteredMembers.map(m => {
            const p = playerMap.get(m.id)
            return <MemberCard key={m.id} member={m} isLeader={p?.isLeader} score={p?.score} progress={p?.progress} onSelect={() => setSelectedMember(m)} />
          })}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <div className="glass-card" style={{ overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            {filteredMembers.length === 0 ? (
              <div style={{ padding:'48px', textAlign:'center', color:'var(--brand-muted)', fontSize:'0.88rem' }}>Nenhum membro encontrado.</div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                    {['Avatar','Membro','Função','Cargo','Performance','Contato',''].map(h => (
                      <th key={h} style={{ padding:'11px 16px', textAlign:'left', fontSize:'0.66rem', color:'var(--brand-muted)', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member, i) => {
                    const p = playerMap.get(member.id)
                    const skin = member.avatar_skin ?? skinFromName(member.full_name ?? member.id)
                    return (
                      <tr key={member.id} style={{ borderBottom: i < filteredMembers.length-1 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: p?.isLeader ? 'rgba(251,191,36,0.02)' : 'transparent' }}>
                        <td style={{ padding:'10px 16px', width:48 }}>
                          <PixelAvatar skin={skin as import('@/components/avatar-utils').AvatarSkin} size={2} walking={(p?.score ?? 0) > 0} crowned={p?.isLeader} label={member.full_name ?? ''} role={member.role ?? ''} produtoFoco={member.produto_foco ?? ''} />
                        </td>
                        <td style={{ padding:'10px 16px' }}>
                          <div style={{ fontWeight:800, fontSize:'0.84rem', color:'#f8fafc' }}>{member.full_name}</div>
                          <div style={{ fontSize:'0.7rem', color:'var(--brand-muted)' }}>{member.email}</div>
                        </td>
                        <td style={{ padding:'10px 16px' }}><RoleBadge role={member.role ?? ''} /></td>
                        <td style={{ padding:'10px 16px', fontSize:'0.8rem', color:'#cbd5e1' }}>{member.cargo_titulo ?? '—'}</td>
                        <td style={{ padding:'10px 16px', minWidth:120 }}>
                          {p ? (
                            <div>
                              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                                <span style={{ fontSize:'0.62rem', color:'#34d399', fontWeight:700 }}>{p.score} pts</span>
                                <span style={{ fontSize:'0.62rem', color:'#475569' }}>{Math.round(p.progress)}%</span>
                              </div>
                              <div style={{ height:4, background:'rgba(255,255,255,0.06)', borderRadius:2, overflow:'hidden' }}>
                                <div style={{ height:'100%', width:`${Math.min(p.progress,100)}%`, background:'#34d399', borderRadius:2 }} />
                              </div>
                            </div>
                          ) : <span style={{ color:'#334155', fontSize:'0.76rem' }}>—</span>}
                        </td>
                        <td style={{ padding:'10px 16px' }}>
                          <div style={{ display:'flex', gap:6 }}>
                            {member.whatsapp && <span title={member.whatsapp} style={{ color:'#6ee7b7' }}><MessageCircle size={14} /></span>}
                            {member.phone && <span title={member.phone} style={{ color:'#93c5fd' }}><Phone size={14} /></span>}
                            {!member.whatsapp && !member.phone && <span style={{ color:'#374151', fontSize:'0.78rem' }}>—</span>}
                          </div>
                        </td>
                        <td style={{ padding:'10px 16px' }}>
                          <button type="button" className="btn-ghost" style={{ padding:'5px 10px', fontSize:'0.72rem' }} onClick={() => setSelectedMember(member)}>Ver</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── DIALOG: Novo membro ── */}
      <ActionDialog open={showNewMember} title="Novo membro da equipe" subtitle="Preencha os dados do colaborador." width="720px" onClose={handleCloseNew}
        footer={<><button type="button" className="btn-ghost" onClick={handleCloseNew}>Cancelar</button><button type="button" className="btn-primary" onClick={handleCreate} disabled={isPending}>{isPending ? 'Salvando...' : 'Salvar'}</button></>}>
        <div style={{ display:'grid', gap:16 }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, marginBottom:10 }}>
            <PixelAvatar skin={form.avatar_skin as import('@/components/avatar-utils').AvatarSkin} size={4} label="Preview" />
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
              {[0,1,2,3,4,5,6].map(s => (
                <button key={s} type="button" onClick={() => setField('avatar_skin', s)} style={{
                  padding:4, border:'2px solid', borderRadius:8,
                  borderColor: form.avatar_skin === s ? '#34d399' : 'transparent',
                  background: form.avatar_skin === s ? 'rgba(52,211,153,0.1)' : 'transparent',
                  cursor:'pointer'
                }}>
                  <PixelAvatar skin={s as import('@/components/avatar-utils').AvatarSkin} size={2} />
                </button>
              ))}
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div><label style={{ display:'block', marginBottom:6, color:'#c9d1d9', fontSize:'0.8rem', fontWeight:700 }}>Nome *</label><input className="input-field" value={form.full_name} onChange={e => setField('full_name', e.target.value)} placeholder="Nome completo" /></div>
            <div><label style={{ display:'block', marginBottom:6, color:'#c9d1d9', fontSize:'0.8rem', fontWeight:700 }}>E-mail *</label><input className="input-field" type="email" value={form.email} onChange={e => setField('email', e.target.value)} placeholder="email@empresa.com.br" /></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div><label style={{ display:'block', marginBottom:6, color:'#c9d1d9', fontSize:'0.8rem', fontWeight:700 }}>Função *</label><select className="input-field" value={form.role} onChange={e => setField('role', e.target.value)}>{ROLES.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
            <div><label style={{ display:'block', marginBottom:6, color:'#c9d1d9', fontSize:'0.8rem', fontWeight:700 }}>Cargo / Título</label><input className="input-field" value={form.cargo_titulo} onChange={e => setField('cargo_titulo', e.target.value)} placeholder="Ex: Consultor Sênior" /></div>
          </div>
          <div>
            <label style={{ display:'block', marginBottom:6, color:'#c9d1d9', fontSize:'0.8rem', fontWeight:700 }}>Serviço foco</label>
            <select className="input-field" value={form.product_id} onChange={e => handleProductChange(e.target.value)}><option value="">— Sem vínculo —</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div><label style={{ display:'block', marginBottom:6, color:'#c9d1d9', fontSize:'0.8rem', fontWeight:700 }}>Telefone</label><input className="input-field" value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder="(00) 00000-0000" /></div>
            <div><label style={{ display:'block', marginBottom:6, color:'#c9d1d9', fontSize:'0.8rem', fontWeight:700 }}>WhatsApp</label><input className="input-field" value={form.whatsapp} onChange={e => setField('whatsapp', e.target.value)} placeholder="(00) 00000-0000" /></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div><label style={{ display:'block', marginBottom:6, color:'#c9d1d9', fontSize:'0.8rem', fontWeight:700 }}>Data de admissão</label><input className="input-field" type="date" value={form.data_admissao} onChange={e => setField('data_admissao', e.target.value)} /></div>
            <div><label style={{ display:'block', marginBottom:6, color:'#c9d1d9', fontSize:'0.8rem', fontWeight:700 }}>Observações</label><input className="input-field" value={form.observacoes} onChange={e => setField('observacoes', e.target.value)} placeholder="Informações adicionais" /></div>
          </div>
        </div>
      </ActionDialog>

      {/* ── DIALOG: Ver perfil ── */}
      <ActionDialog open={Boolean(selectedMember)} title={isEditing ? 'Editar Colaborador' : (selectedMember?.full_name ?? 'Perfil')} subtitle={isEditing ? 'Altere os dados do membro.' : 'Dados do colaborador.'} onClose={() => { setSelectedMember(null); setIsEditing(false); }}>
        {selectedMember && (() => {
          const p = playerMap.get(selectedMember.id)
          const skin = selectedMember.avatar_skin ?? skinFromName(selectedMember.full_name ?? selectedMember.id)
          
          if (isEditing) {
            return (
              <div style={{ display:'grid', gap:16 }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, marginBottom:10 }}>
                  <PixelAvatar skin={form.avatar_skin as import('@/components/avatar-utils').AvatarSkin} size={4} label="Preview" role={form.role} produtoFoco={form.produto_foco} />
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
                    {[0,1,2,3,4,5,6].map(s => (
                      <button key={s} type="button" onClick={() => setField('avatar_skin', s)} style={{
                        padding:4, border:'2px solid', borderRadius:8,
                        borderColor: form.avatar_skin === s ? '#34d399' : 'transparent',
                        background: form.avatar_skin === s ? 'rgba(52,211,153,0.1)' : 'transparent',
                        cursor:'pointer'
                      }}>
                        <PixelAvatar skin={s as import('@/components/avatar-utils').AvatarSkin} size={2} />
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div><label style={{ display:'block', marginBottom:6, color:'#c9d1d9', fontSize:'0.8rem', fontWeight:700 }}>Nome *</label><input className="input-field" value={form.full_name} onChange={e => setField('full_name', e.target.value)} /></div>
                  <div><label style={{ display:'block', marginBottom:6, color:'#c9d1d9', fontSize:'0.8rem', fontWeight:700 }}>E-mail *</label><input className="input-field" value={form.email} onChange={e => setField('email', e.target.value)} /></div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div><label style={{ display:'block', marginBottom:6, color:'#c9d1d9', fontSize:'0.8rem', fontWeight:700 }}>Função *</label><select className="input-field" value={form.role} onChange={e => setField('role', e.target.value)}>{ROLES.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                  <div><label style={{ display:'block', marginBottom:6, color:'#c9d1d9', fontSize:'0.8rem', fontWeight:700 }}>Cargo</label><input className="input-field" value={form.cargo_titulo} onChange={e => setField('cargo_titulo', e.target.value)} /></div>
                </div>
                <div>
                  <label style={{ display:'block', marginBottom:6, color:'#c9d1d9', fontSize:'0.8rem', fontWeight:700 }}>Serviço foco</label>
                  <select className="input-field" value={form.product_id} onChange={e => handleProductChange(e.target.value)}><option value="">— Sem vínculo —</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div><label style={{ display:'block', marginBottom:6, color:'#c9d1d9', fontSize:'0.8rem', fontWeight:700 }}>Telefone</label><input className="input-field" value={form.phone} onChange={e => setField('phone', e.target.value)} /></div>
                  <div><label style={{ display:'block', marginBottom:6, color:'#c9d1d9', fontSize:'0.8rem', fontWeight:700 }}>WhatsApp</label><input className="input-field" value={form.whatsapp} onChange={e => setField('whatsapp', e.target.value)} /></div>
                </div>
                
                <div style={{ display:'flex', gap:10, marginTop:10 }}>
                  <button type="button" className="btn-primary" style={{ flex:1 }} onClick={async () => {
                    if (!form.full_name || !form.email) { toast.error('Nome e email obrigatórios'); return }
                    startTransition(async () => {
                      const res = await updateUser(selectedMember.id, {
                        full_name: form.full_name,
                        email: form.email,
                        role: form.role,
                        cargo_titulo: form.cargo_titulo,
                        phone: form.phone,
                        whatsapp: form.whatsapp,
                        product_id: form.product_id,
                        produto_foco: form.produto_foco,
                        data_admissao: form.data_admissao,
                        observacoes: form.observacoes,
                        avatar_skin: form.avatar_skin,
                        permissions: []
                      })
                      if (res.success) {
                        toast.success('Perfil atualizado!')
                        setIsEditing(false)
                        setSelectedMember(null)
                        router.refresh()
                      } else {
                        toast.error(res.error || 'Erro ao atualizar')
                      }
                    })
                  }} disabled={isPending}>{isPending ? 'Salvando...' : 'Salvar Alterações'}</button>
                  <button type="button" className="btn-ghost" onClick={() => setIsEditing(false)}>Cancelar</button>
                </div>
              </div>
            )
          }

          return (
            <div style={{ display:'grid', gap:16 }}>
              <div className="glass-card" style={{ padding:20, background:'linear-gradient(135deg,rgba(52,211,153,0.06),rgba(0,0,0,0.2))', display:'flex', gap:20, alignItems:'center' }}>
                <PixelAvatar skin={skin as import('@/components/avatar-utils').AvatarSkin} size={4} walking={(p?.score ?? 0) > 0} crowned={p?.isLeader} label={selectedMember.full_name ?? ''} role={selectedMember.role ?? ''} produtoFoco={selectedMember.produto_foco ?? ''} />
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <RoleBadge role={selectedMember.role ?? ''} />
                    <button type="button" className="btn-ghost" style={{ padding:'4px 8px', fontSize:'0.7rem' }} onClick={() => {
                      setForm({
                        full_name: selectedMember.full_name,
                        email: selectedMember.email,
                        role: selectedMember.role,
                        cargo_titulo: selectedMember.cargo_titulo ?? '',
                        phone: selectedMember.phone ?? '',
                        whatsapp: selectedMember.whatsapp ?? '',
                        product_id: selectedMember.product_id ?? '',
                        produto_foco: selectedMember.produto_foco ?? '',
                        data_admissao: selectedMember.data_admissao ?? '',
                        observacoes: selectedMember.observacoes ?? '',
                        avatar_skin: selectedMember.avatar_skin ?? 0,
                      })
                      setIsEditing(true)
                    }}>Editar</button>
                  </div>
                  <h3 style={{ marginTop:8, color:'#f8fafc', fontSize:'1.1rem', fontWeight:900 }}>{selectedMember.full_name}</h3>
                  {selectedMember.cargo_titulo && <p style={{ color:'#94a3b8', marginTop:2, fontSize:'0.85rem' }}>{selectedMember.cargo_titulo}</p>}
                  {p && (
                    <div style={{ marginTop:10 }}>
                      <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                        {[{label:'Score', val:`${p.score} pts`, color:'#34d399'},{label:'Contratos', val:String(p.contratos), color:'#10b981'},{label:'Fechados', val:String(p.leadsFechados), color:'#fbbf24'},{label:'Ativos', val:String(p.leadsAtivos), color:'#3b82f6'}].map(s => (
                          <div key={s.label} style={{ textAlign:'center', padding:'6px 12px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontSize:'1rem', fontWeight:900, color:s.color }}>{s.val}</div>
                            <div style={{ fontSize:'0.6rem', color:'#475569' }}>{s.label}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop:10 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}><span style={{ fontSize:'0.65rem', color:'#34d399' }}>Meta mensal</span><span style={{ fontSize:'0.65rem', color:'#475569' }}>{Math.round(p.progress)}%</span></div>
                        <div style={{ height:6, background:'rgba(255,255,255,0.06)', borderRadius:3, overflow:'hidden' }}><div style={{ height:'100%', width:`${Math.min(p.progress,100)}%`, background:'linear-gradient(90deg,#34d399,#10b981)', borderRadius:3 }} /></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display:'grid', gap:10 }}>
                {[
                  { icon:<Mail size={14} color="#58a6ff" />, val: selectedMember.email },
                  selectedMember.phone && { icon:<Phone size={14} color="#93c5fd" />, val: selectedMember.phone },
                  selectedMember.whatsapp && { icon:<MessageCircle size={14} color="#6ee7b7" />, val: `WhatsApp: ${selectedMember.whatsapp}` },
                  selectedMember.produto_foco && { icon:<Briefcase size={14} color="#f59e0b" />, val: `Serviço foco: ${selectedMember.produto_foco}` },
                  selectedMember.data_admissao && { icon:<Calendar size={14} color="#c084fc" />, val: `Admitido em ${new Date(`${selectedMember.data_admissao}T00:00:00`).toLocaleDateString('pt-BR')}` },
                  { icon:<Star size={14} color="#10b981" />, val: `Status: ${selectedMember.is_active ? 'Ativo' : 'Inativo'}` },
                  selectedMember.observacoes && { icon:<FileText size={14} color="#64748b" />, val: selectedMember.observacoes },
                ].filter(Boolean).map((row, i) => row && (
                  <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                    <span style={{ flexShrink:0, marginTop:1 }}>{row.icon}</span>
                    <span style={{ color:'#94a3b8', fontSize:'0.84rem' }}>{row.val}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
      </ActionDialog>
    </div>
  )
}
