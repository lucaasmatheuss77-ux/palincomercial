'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ClubMember = {
  id: string
  client_id: string
  contract_start: string | null
  contract_end: string | null
  status: 'ativo' | 'em_renovacao' | 'inativo'
  tier: 'standard' | 'plus' | 'vip'
  mentor_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
  client?: {
    id: string
    name: string
    company_name: string | null
    email: string | null
    phone: string | null
    whatsapp: string | null
  }
  mentor?: {
    id: string
    full_name: string
    avatar_url: string | null
  } | null
}

export type ClubDeliverable = {
  id: string
  title: string
  description: string | null
  category: 'mentoria' | 'conteudo' | 'material' | 'evento'
  due_date: string | null
  status: 'pendente' | 'concluido' | 'atrasado'
  is_global: boolean
  member_id: string | null
  event_id: string | null
  created_at: string
  updated_at: string
  event?: {
    id: string
    name: string
    date: string
    location: string | null
    status: string | null
  } | null
}

// Conexão armazenada em JSON dentro do campo notes
export type ClubConnection = {
  id: string // uuid gerado no cliente
  name: string
  company: string | null
  type: 'parceiro' | 'indicacao' | 'networking' | 'cliente'
  date: string
  notes: string | null
}

// Estrutura interna do campo notes do membro
type NotesData = {
  text: string | null
  connections: ClubConnection[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseNotes(raw: string | null): NotesData {
  if (!raw) return { text: null, connections: [] }
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'object' && 'connections' in parsed) return parsed as NotesData
    // era string pura, preserva como texto
    return { text: raw, connections: [] }
  } catch {
    return { text: raw, connections: [] }
  }
}

function serializeNotes(data: NotesData): string {
  return JSON.stringify(data)
}

function isInsiderClubProduct(productName?: string | null, productSlug?: string | null): boolean {
  const terms = ['insider', 'clube', 'mentoria']
  const haystack = `${productName ?? ''} ${productSlug ?? ''}`.toLowerCase()
  return terms.some((t) => haystack.includes(t))
}

// ─── Members ──────────────────────────────────────────────────────────────────

export async function getClubMembers(): Promise<{ success: boolean; data: ClubMember[]; error?: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('club_members')
    .select(`
      *,
      client:clientes(id, name, company_name, email, phone, whatsapp),
      mentor:profiles(id, full_name, avatar_url)
    `)
    .order('created_at', { ascending: false })

  if (error) return { success: false, data: [], error: error.message }
  return { success: true, data: (data || []) as ClubMember[] }
}

export async function ensureClubMember(clientId: string): Promise<{ success: boolean; data?: ClubMember | null; isNew?: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('club_members')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle()

  if (existing) return { success: true, data: existing as ClubMember, isNew: false }

  const today = new Date().toISOString().split('T')[0]
  const oneYearLater = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('club_members')
    .insert({ client_id: clientId, contract_start: today, contract_end: oneYearLater, status: 'ativo', tier: 'standard' })
    .select('*')
    .maybeSingle()

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/clube')
  return { success: true, data: data as ClubMember | null, isNew: true }
}

export async function updateClubMember(
  id: string,
  fields: {
    contract_start?: string | null
    contract_end?: string | null
    status?: 'ativo' | 'em_renovacao' | 'inativo'
    tier?: 'standard' | 'plus' | 'vip'
    mentor_id?: string | null
    notes?: string | null
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('club_members')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/clube')
  return { success: true }
}

export async function maybeCreateClubMemberFromClient(clientId: string, productId?: string | null): Promise<{ created: boolean }> {
  if (!productId) return { created: false }

  const supabase = await createClient()
  const { data: product } = await supabase.from('products').select('name, slug').eq('id', productId).maybeSingle()

  if (!isInsiderClubProduct(product?.name, product?.slug)) return { created: false }

  const result = await ensureClubMember(clientId)
  return { created: result.isNew === true }
}

// ─── Connections (stored in notes JSON) ───────────────────────────────────────

export async function getMemberConnections(memberId: string): Promise<{ success: boolean; data: ClubConnection[]; notes: string | null }> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('club_members').select('notes').eq('id', memberId).maybeSingle()
  if (error) return { success: false, data: [], notes: null }
  const parsed = parseNotes((data as { notes: string | null } | null)?.notes ?? null)
  return { success: true, data: parsed.connections, notes: parsed.text }
}

export async function addMemberConnection(memberId: string, connection: Omit<ClubConnection, 'id'>): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: row } = await supabase.from('club_members').select('notes').eq('id', memberId).maybeSingle()
  const parsed = parseNotes((row as { notes: string | null } | null)?.notes ?? null)

  const newConn: ClubConnection = {
    ...connection,
    id: crypto.randomUUID(),
  }
  parsed.connections = [newConn, ...parsed.connections]

  const { error } = await supabase
    .from('club_members')
    .update({ notes: serializeNotes(parsed), updated_at: new Date().toISOString() })
    .eq('id', memberId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/clube')
  return { success: true }
}

export async function removeMemberConnection(memberId: string, connectionId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: row } = await supabase.from('club_members').select('notes').eq('id', memberId).maybeSingle()
  const parsed = parseNotes((row as { notes: string | null } | null)?.notes ?? null)

  parsed.connections = parsed.connections.filter((c) => c.id !== connectionId)

  const { error } = await supabase
    .from('club_members')
    .update({ notes: serializeNotes(parsed), updated_at: new Date().toISOString() })
    .eq('id', memberId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/clube')
  return { success: true }
}

// ─── Deliverables ─────────────────────────────────────────────────────────────

export async function getClubDeliverables(): Promise<{ success: boolean; data: ClubDeliverable[]; error?: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('club_deliverables')
    .select(`
      *,
      event:events(id, name, date, location, status)
    `)
    .order('due_date', { ascending: true })

  if (error) return { success: false, data: [], error: error.message }
  return { success: true, data: (data || []) as ClubDeliverable[] }
}

export async function upsertDeliverable(deliverable: {
  id?: string
  title: string
  description?: string | null
  category: 'mentoria' | 'conteudo' | 'material' | 'evento'
  due_date?: string | null
  status?: 'pendente' | 'concluido' | 'atrasado'
  is_global?: boolean
  member_id?: string | null
  event_id?: string | null
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const payload = {
    title: deliverable.title,
    description: deliverable.description ?? null,
    category: deliverable.category,
    due_date: deliverable.due_date ?? null,
    status: deliverable.status ?? 'pendente',
    is_global: deliverable.is_global ?? true,
    member_id: deliverable.member_id ?? null,
    event_id: deliverable.event_id ?? null,
  }

  const { error } = deliverable.id
    ? await supabase.from('club_deliverables').update(payload).eq('id', deliverable.id)
    : await supabase.from('club_deliverables').insert(payload)

  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/clube')
  return { success: true }
}

export async function toggleDeliverableDone(id: string, currentStatus: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const newStatus = currentStatus === 'concluido' ? 'pendente' : 'concluido'

  const { error } = await supabase
    .from('club_deliverables')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/clube')
  return { success: true }
}

export async function deleteDeliverable(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('club_deliverables').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/clube')
  return { success: true }
}

// ─── Events ───────────────────────────────────────────────────────────────────

type ClubEventRow = {
  id: string
  name: string
  date: string
  location?: string | null
  status?: string | null
  type?: string | null
  ends_at?: string | null
}

export async function getClubEvents(): Promise<{ success: boolean; data: ClubEventRow[]; error?: string }> {
  const supabase = await createClient()

  const { data: linkedEventIds } = await supabase
    .from('club_deliverables')
    .select('event_id')
    .not('event_id', 'is', null)

  const ids = (linkedEventIds || []).map((d) => d.event_id).filter(Boolean)

  const { data: products } = await supabase.from('products').select('id').ilike('name', '%insider%')
  const productIds = (products || []).map((p) => p.id)

  let query = supabase.from('events').select('*').order('date', { ascending: true })

  if (ids.length > 0 || productIds.length > 0) {
    const allEventIds = [...new Set(ids)]
    if (allEventIds.length > 0 && productIds.length > 0) {
      query = supabase
        .from('events')
        .select('*')
        .or(`id.in.(${allEventIds.join(',')}),product_id.in.(${productIds.join(',')})`)
        .order('date', { ascending: true })
    } else if (allEventIds.length > 0) {
      query = supabase.from('events').select('*').in('id', allEventIds).order('date', { ascending: true })
    } else if (productIds.length > 0) {
      query = supabase.from('events').select('*').in('product_id', productIds).order('date', { ascending: true })
    }
  }

  const { data, error } = await query
  if (error) return { success: false, data: [], error: error.message }
  return { success: true, data: data || [] }
}
